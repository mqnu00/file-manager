const express = require('express')
const cors = require('cors')
const path = require('path')
const fileRoutes = require('./routes/files')
const folderRoutes = require('./routes/folders')

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

// 中间件
app.use(cors())
app.use(express.json())

// API 路由
app.use('/api/files', fileRoutes)
app.use('/api/folders', folderRoutes)

// 生产环境提供静态文件
const distPath = path.join(__dirname, '../dist')
try {
  const fs = require('fs')
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))

    // SPA 路由回退
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }
} catch (e) {
  console.log('静态文件目录不存在，跳过')
}

// 尝试使用指定端口，如果被占用则自动选择下一个端口
const startServer = (port) => {
  app.listen(port, HOST, () => {
    console.log(`🚀 服务器运行在 http://localhost:${port}`)
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用`)
    } else {
      throw err
    }
  })
}

startServer(PORT)

module.exports = app
