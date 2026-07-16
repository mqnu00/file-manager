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
import { errorHandler } from './middleware/errorHandler'
import { authMiddleware } from './middleware/auth'
import { isDefaultToken } from './config'
import { cleanOldLogs } from './utils/logger'

// 启动时清理超过 30 天的旧日志
const deletedLogs = cleanOldLogs(30)
if (deletedLogs > 0) {
  console.log(`已清理 ${deletedLogs} 个过期日志文件`)
}

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

app.use(
  helmet({
    hsts: { maxAge: 0 },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        upgradeInsecureRequests: null,
      },
    },
  })
)
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/config', configRoutes)
app.use('/api/files', authMiddleware, fileRoutes)
app.use('/api/folders', authMiddleware, folderRoutes)
app.use('/api/system', authMiddleware, systemRoutes)
app.use('/api/logs', authMiddleware, logRoutes)

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

const startServer = (port: number): void => {
  app
    .listen(port, HOST, () => {
      console.log(`🚀 服务器运行在 http://localhost:${port}`)
      if (isDefaultToken()) {
        console.warn(
          '\n⚠️  安全提示：您正在使用默认认证令牌 "admin123"，建议立即在 config.yml 中修改。\n'
        )
      }
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`端口 ${port} 已被占用`)
        startServer(port + 1)
      } else {
        throw err
      }
    })
}

startServer(Number(PORT))

export default app
