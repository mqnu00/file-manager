const fs = require('fs')
const path = require('path')
const express = require('express')
const archiver = require('archiver')
const mime = require('mime-types')

const router = express.Router()

// 基础目录 - 限制只能在此目录下操作
const BASE_DIR = process.env.FILE_MANAGER_BASE_DIR || path.join(__dirname, '../../files')

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

// 下载文件
router.get('/*', (req, res) => {
  try {
    const filePath = safePath(req.params[0])
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: '文件不存在' })
    }
    
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      return res.status(400).json({ message: '不能下载文件夹')
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

// 压缩文件夹
router.post('/zip', (req, res) => {
  try {
    const { path: folderPath } = req.body
    
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
    
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    output.on('close', () => {
      res.json({ 
        success: true, 
        zipPath: path.relative(BASE_DIR, zipPath).replace(/\\/g, '/')
      })
    })
    
    archive.on('error', (err) => {
      throw err
    })
    
    archive.pipe(output)
    archive.directory(folderFullPath, path.basename(folderPath))
    archive.finalize()
  } catch (e) {
    console.error('压缩失败:', e)
    res.status(500).json({ message: e.message || '压缩失败' })
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
