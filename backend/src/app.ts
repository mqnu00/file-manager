import express, { Router } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { WebSocketServer, WebSocket } from 'ws'
import { URL } from 'url'
import fileRoutes from './routes/files'
import folderRoutes from './routes/folders'
import authRoutes from './routes/auth'
import configRoutes from './routes/config'
import systemRoutes from './routes/system'
import logRoutes from './routes/logs'
import taskRoutes from './routes/tasks'
import smbRoutes from './routes/smb'
import { errorHandler } from './middleware/errorHandler'
import { authMiddleware, validateSession } from './middleware/auth'
import { isDefaultToken, getConfig } from './config'
import { cleanOldLogs } from './utils/logger'
import { createSession, attachViewer } from './services/terminalManager'
import { clearSambaCache } from './utils/sambaDetect'
import { loadPlugins, startPluginWatchers } from './plugin/loader'
import pluginRoutes from './routes/plugins'

const app = express()
const PORT = Number(process.env.PORT) || 3000
const isElectron = !!process.env.ELECTRON
const HOST = process.env.HOST || (isElectron ? '127.0.0.1' : '0.0.0.0')

// Helmet 配置：Electron 环境下禁用 CSP 以避免限制
const helmetConfig: Record<string, unknown> = {
  hsts: { maxAge: 0 },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: isElectron
    ? false
    : {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://unpkg.com', 'blob:'],
          upgradeInsecureRequests: null,
        },
      },
}

app.use(helmet(helmetConfig))
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/config', configRoutes)
app.use('/api/files', authMiddleware, fileRoutes)
app.use('/api/folders', authMiddleware, folderRoutes)
app.use('/api/system', authMiddleware, systemRoutes)
app.use('/api/logs', authMiddleware, logRoutes)
app.use('/api/tasks', authMiddleware, taskRoutes)
app.use('/api/smb', authMiddleware, smbRoutes)

// 插件信息（无需认证，前端运行时需要获取插件列表）
app.use('/api/plugins', pluginRoutes)

// 插件路由挂载点（预注册，确保优先于静态文件 catch-all）
export const pluginApp = Router()
app.use(pluginApp)

// ===== 插件静态资源 =====
app.use('/plugins-assets', express.static(path.join(path.resolve(__dirname, '..', '..'), 'plugins')))

// ===== 静态文件 =====

const distPath = path.join(__dirname, '../dist')
try {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }
} catch {
  console.log('静态文件目录不存在，跳过')
}

// ===== 统一错误处理中间件（必须放在所有路由之后） =====
app.use(errorHandler)

// 启动时日志清理（根据配置决定）
const logCfg = getConfig().log
if (logCfg.cleanupOnStartup) {
  const deleted = cleanOldLogs(logCfg.retentionDays)
  if (deleted > 0) {
    console.log(`已清理 ${deleted} 个过期日志文件`)
  }
}

function setupWebSocket(httpServer: http.Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' })

  wss.on('connection', (ws: WebSocket, req) => {
    // 认证：从 URL 参数中提取 token
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token || !validateSession(token)) {
      ws.send(JSON.stringify({ type: 'error', message: '认证失败，请刷新页面后重试' }))
      ws.close()
      return
    }

    const command = url.searchParams.get('cmd') || ''
    const argsStr = url.searchParams.get('args') || ''

    if (command) {
      // 模式 A：提供了命令 → 创建新会话（安装等一次性操作）
      const args = argsStr ? argsStr.split(' ') : []
      console.log(`Terminal (new session): ${command} ${args.join(' ')}`)

      createSession(command, args, (exitCode) => {
        if (exitCode === 0) {
          clearSambaCache()
        }
        console.log(`Terminal exit: ${exitCode}`)
      })

      // 将会话创建者关联的 WS 附加为 viewer
      attachViewer(ws)
    } else {
      // 模式 B：无命令 → 附加到现有会话作为 viewer（SMB 等持久化会话）
      if (!attachViewer(ws)) {
        ws.send(JSON.stringify({ type: 'error', message: '没有运行中的终端会话' }))
        ws.close()
      }
    }
  })
}

function createServer(port?: number): Promise<number> {
  const targetPort = port ?? PORT
  return new Promise((resolve) => {
    const tryListen = (p: number) => {
      const httpServer = http.createServer(app)
      httpServer.listen(p, HOST, () => {
        console.log(`🚀 服务器运行在 http://localhost:${p}`)

        // WebSocket 终端服务
        setupWebSocket(httpServer)

        if (isDefaultToken()) {
          console.warn(
            '\n⚠️  安全提示：您正在使用默认认证令牌 "admin123"，建议立即在 config.yml 中修改。\n'
          )
        }
        resolve(p)
      })
      httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`端口 ${p} 已被占用`)
          httpServer.close()
          tryListen(p + 1)
        } else {
          throw err
        }
      })
    }
    tryListen(targetPort)
  })
}

// 直接运行时自动启动（非 import/require 场景）
if (require.main === module) {
  loadPlugins()
    .then(() => createServer())
    .then(() => startPluginWatchers())
    .catch((err) => {
      console.error('Plugin loading failed:', err)
      createServer()
    })
}

export { app, createServer }
export default app
