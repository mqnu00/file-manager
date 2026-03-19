const express = require('express')
const cors = require('cors')
const path = require('path')
const fileRoutes = require('./routes/files')
const folderRoutes = require('./routes/folders')

const app = express()
const PORT = process.env.PORT || 3000

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

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
})

module.exports = app
