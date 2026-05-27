import path from 'path'
import fs from 'fs'
import { getConfig } from '../config'

function getBaseDir(): string {
  const configured = getConfig().storageRoot
  if (configured && configured.trim()) {
    const resolved = path.resolve(configured)
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true })
    }
    return resolved
  }
  const envDir = process.env.FILE_MANAGER_BASE_DIR
  if (envDir) {
    const resolved = path.resolve(envDir)
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true })
    }
    return resolved
  }
  return '/'
}

export function getStorageRoot(): string {
  return getBaseDir()
}

/**
 * 安全路径检查 - 防止路径遍历攻击
 * @param userPath 用户提供的路径
 * @returns 解析后的安全路径
 */
export const safePath = (userPath: string): string => {
  const BASE_DIR = getBaseDir()

  if (BASE_DIR === '/') {
    const normalizedPath = userPath.startsWith('/') ? userPath : '/' + userPath
    return path.normalize(normalizedPath)
  }
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
      try {
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          walkDir(filePath)
        } else {
          totalBytes += stat.size
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') continue
        throw e
      }
    }
  }

  walkDir(dir)
  return totalBytes
}
