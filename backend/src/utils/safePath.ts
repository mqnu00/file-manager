import path from 'path'
import fs from 'fs'
import { getConfig } from '../config'
import { AppError } from './AppError'

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
  return process.cwd()
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

  if (path.normalize(BASE_DIR) === path.resolve('/')) {
    const normalizedPath = path.isAbsolute(userPath) ? userPath : path.posix.join('/', userPath)
    return path.normalize(normalizedPath)
  }
  const resolved = path.join(BASE_DIR, userPath)
  if (!resolved.startsWith(BASE_DIR)) {
    throw new AppError('非法路径')
  }
  return resolved
}

/**
 * 递归计算目录总大小（异步，不阻塞事件循环）
 * @param dir 目录路径
 * @returns 目录总字节数
 */
export const calculateDirSize = async (dir: string): Promise<number> => {
  let totalBytes = 0

  const walkDir = async (currentDir: string): Promise<void> => {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const filePath = path.join(currentDir, entry.name)
      try {
        const stat = await fs.promises.stat(filePath)
        if (stat.isDirectory()) {
          await walkDir(filePath)
        } else {
          totalBytes += stat.size
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') continue
        throw e
      }
    }
  }

  await walkDir(dir)
  return totalBytes
}
