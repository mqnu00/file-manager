import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import fs from 'fs'
import fileRoutes from './routes/files'
import folderRoutes from './routes/folders'
import authRoutes from './routes/auth'
import configRoutes from './routes/config'
import systemRoutes from './routes/system'
import logRoutes from './routes/logs'
import taskRoutes from './routes/tasks'
import { errorHandler } from './middleware/errorHandler'
import { authMiddleware } from './middleware/auth'
import { isDefaultToken, getConfig } from './config'
import { cleanOldLogs } from './utils/logger'

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
          scriptSrc: ["'self'", 'https://unpkg.com'],
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

function createServer(port?: number): Promise<number> {
  const targetPort = port ?? PORT
  return new Promise((resolve) => {
    const tryListen = (p: number) => {
      const server = app.listen(p, HOST, () => {
        console.log(`🚀 服务器运行在 http://localhost:${p}`)
        if (isDefaultToken()) {
          console.warn(
            '\n⚠️  安全提示：您正在使用默认认证令牌 "admin123"，建议立即在 config.yml 中修改。\n'
          )
        }
        resolve(p)
      })
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`端口 ${p} 已被占用`)
          server.close()
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
  createServer()
}

export { app, createServer }
export default app
