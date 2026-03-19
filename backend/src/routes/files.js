const fs = require('fs')
const path = require('path')
const express = require('express')
const archiver = require('archiver')
const mime = require('mime-types')

const router = express.Router()

// 基础目录 - 限制只能在此目录下操作
// 默认使用系统根目录，可通过环境变量自定义
const BASE_DIR = process.env.FILE_MANAGER_BASE_DIR || '/'

// 确保基础目录存在
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true })
}

// 安全路径检查
const safePath = (userPath) => {
  const resolved = path.resolve(BASE_DIR, userPath || '')
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error('非法路径')
  }
  return resolved
}

// 获取文件列表
router.get('/', (req, res) => {
  try {
    const userPath = req.query.path || ''
    const targetPath = safePath(userPath)
    
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ message: '路径不存在' })
    }
    
    const files = fs.readdirSync(targetPath, { withFileTypes: true })
    const fileList = files.map(file => {
      const filePath = path.join(targetPath, file.name)
      const stats = fs.statSync(filePath)
      const relativePath = path.relative(BASE_DIR, filePath)
      
      return {
        name: file.name,
        path: relativePath.replace(/\\/g, '/'),
        isDirectory: file.isDirectory(),
        size: stats.size,
        modified: stats.mtime.toISOString()
      }
    })
    
    // 排序：文件夹在前，文件在后
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
    
    res.json({
      path: userPath || '',
      files: fileList
    })
  } catch (e) {
    console.error('获取文件列表失败:', e)
    res.status(500).json({ message: e.message || '获取文件列表失败' })
  }
})

// 压缩文件夹（使用 SSE 发送进度）- 必须在 /* 之前定义
router.get('/zip', (req, res) => {
  try {
    const folderPath = req.query.path
    
    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径' })
    }
    
    const folderFullPath = safePath(folderPath)
    
    if (!fs.existsSync(folderFullPath)) {
      return res.status(404).json({ message: '文件夹不存在' })
    }
    
    const stats = fs.statSync(folderFullPath)
    if (!stats.isDirectory()) {
      return res.status(400).json({ message: '只能压缩文件夹' })
    }
    
    const zipFileName = `${path.basename(folderPath)}.zip`
    const zipPath = path.join(path.dirname(folderFullPath), zipFileName)
    
    // 计算总大小用于进度
    let totalBytes = 0
    
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          walkDir(filePath)
        } else {
          totalBytes += stat.size
        }
      }
    }
    walkDir(folderFullPath)
    
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    let processedBytes = 0
    
    // 监听数据添加以跟踪进度
    archive.on('entry', (entry) => {
      if (!entry.stats.isDirectory()) {
        processedBytes += entry.stats.size
        const progress = Math.round((processedBytes / totalBytes) * 100)
        res.write(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`)
      }
    })
    
    output.on('close', () => {
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        zipPath: path.relative(BASE_DIR, zipPath).replace(/\\/g, '/')
      })}\n\n`)
      res.end()
    })
    
    archive.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
      res.end()
    })
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Archive-Path', folderPath)
    
    archive.pipe(output)
    archive.directory(folderFullPath, path.basename(folderPath))
    archive.finalize()
    
    // 存储 archive 实例以便取消
    if (!req.app.locals.activeArchives) {
      req.app.locals.activeArchives = {}
    }
    req.app.locals.activeArchives[folderPath] = archive
    
    // 清理完成的 archive
    output.on('close', () => {
      delete req.app.locals.activeArchives[folderPath]
    })
    
  } catch (e) {
    console.error('压缩失败:', e)
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`)
    res.end()
  }
})

// 取消压缩
router.post('/zip/cancel', (req, res) => {
  try {
    const { path: folderPath } = req.body
    
    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径' })
    }
    
    const archives = req.app.locals.activeArchives || {}
    const archive = archives[folderPath]
    
    if (!archive) {
      return res.status(404).json({ message: '未找到正在进行的压缩任务' })
    }
    
    archive.abort()
    delete archives[folderPath]
    
    res.json({ success: true })
  } catch (e) {
    console.error('取消压缩失败:', e)
    res.status(500).json({ message: e.message || '取消失败' })
  }
})

// 下载文件 - 必须在最后，避免拦截其他路由
router.get('/*', (req, res) => {
  try {
    const filePath = safePath(req.params[0])
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: '文件不存在' })
    }
    
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      return res.status(400).json({ message: '不能下载文件夹' })
    }
    
    const mimeType = mime.lookup(filePath) || 'application/octet-stream'
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`)
    res.setHeader('Content-Length', stats.size)
    
    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  } catch (e) {
    console.error('下载文件失败:', e)
    res.status(500).json({ message: e.message || '下载失败' })
  }
})

// 移动文件
router.put('/move', (req, res) => {
  try {
    const { fromPath, toPath } = req.body
    
    if (!fromPath || !toPath) {
      return res.status(400).json({ message: '缺少必要参数' })
    }
    
    const fromFullPath = safePath(fromPath)
    const toFullPath = safePath(toPath)
    
    if (!fs.existsSync(fromFullPath)) {
      return res.status(404).json({ message: '源文件不存在' })
    }
    
    // 确保目标目录存在
    const toDir = path.dirname(toFullPath)
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true })
    }
    
    fs.renameSync(fromFullPath, toFullPath)
    
    res.json({ success: true })
  } catch (e) {
    console.error('移动文件失败:', e)
    res.status(500).json({ message: e.message || '移动失败' })
  }
})

// 重命名文件
router.put('/rename', (req, res) => {
  try {
    const { path: filePath, newName } = req.body
    
    if (!filePath || !newName) {
      return res.status(400).json({ message: '缺少必要参数' })
    }
    
    const oldFullPath = safePath(filePath)
    const newFullPath = path.join(path.dirname(oldFullPath), newName)
    
    if (!fs.existsSync(oldFullPath)) {
      return res.status(404).json({ message: '文件不存在' })
    }
    
    fs.renameSync(oldFullPath, newFullPath)
    
    res.json({ success: true })
  } catch (e) {
    console.error('重命名失败:', e)
    res.status(500).json({ message: e.message || '重命名失败' })
  }
})

// 删除文件/文件夹
router.delete('/', (req, res) => {
  try {
    const { path: filePath } = req.query
    
    if (!filePath) {
      return res.status(400).json({ message: '缺少文件路径' })
    }
    
    const fullPath = safePath(filePath)
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: '文件不存在' })
    }
    
    fs.rmSync(fullPath, { recursive: true, force: true })
    
    res.json({ success: true })
  } catch (e) {
    console.error('删除失败:', e)
    res.status(500).json({ message: e.message || '删除失败' })
  }
})

module.exports = router
