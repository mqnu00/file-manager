const fs = require('fs')
const path = require('path')
const express = require('express')

const router = express.Router()

// 基础目录
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

// 创建文件夹
router.post('/', (req, res) => {
  try {
    const { path: parentPath, name } = req.body
    
    if (!name) {
      return res.status(400).json({ message: '缺少文件夹名称' })
    }
    
    const parentFullPath = safePath(parentPath)
    const newFolderPath = path.join(parentFullPath, name)
    
    if (fs.existsSync(newFolderPath)) {
      return res.status(400).json({ message: '文件夹已存在' })
    }
    
    fs.mkdirSync(newFolderPath, { recursive: true })
    
    res.json({ success: true })
  } catch (e) {
    console.error('创建文件夹失败:', e)
    res.status(500).json({ message: e.message || '创建失败' })
  }
})

module.exports = router
