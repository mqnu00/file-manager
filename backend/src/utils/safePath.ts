import path from 'path'
import fs from 'fs'

/**
 * 基础目录 - 限制只能在此目录下操作
 * 默认使用系统根目录，可通过环境变量自定义
 */
export const BASE_DIR = process.env.FILE_MANAGER_BASE_DIR || '/'

/**
 * 确保基础目录存在
 */
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true })
}

/**
 * 安全路径检查 - 防止路径遍历攻击
 * @param userPath 用户提供的路径
 * @returns 解析后的安全路径
 */
export const safePath = (userPath: string): string => {
  // 如果 BASE_DIR 是 '/'，直接使用用户路径（确保以 / 开头）
  if (BASE_DIR === '/') {
    const normalizedPath = userPath.startsWith('/') ? userPath : '/' + userPath
    return path.normalize(normalizedPath)
  }
  // 否则，将用户路径连接到 BASE_DIR
  const resolved = path.join(BASE_DIR, userPath)
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error('非法路径')
  }
  return resolved
}

/**
 * 递归计算目录总大小
 * @param dir 目录路径
 * @returns 目录总字节数
 */
export const calculateDirSize = (dir: string): number => {
  let totalBytes = 0

  const walkDir = (currentDir: string): void => {
    const files = fs.readdirSync(currentDir)
    for (const file of files) {
      const filePath = path.join(currentDir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        walkDir(filePath)
      } else {
        totalBytes += stat.size
      }
    }
  }

  walkDir(dir)
  return totalBytes
}
