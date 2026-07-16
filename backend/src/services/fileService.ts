import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import archiver from 'archiver'
import mime from 'mime-types'
import { Response } from 'express'
import { FileInfo, SSEProgressMessage } from '../types'
import { safePath, calculateDirSize, getStorageRoot, isVirtualFs } from '../utils/safePath'
import { sendSSEProgress, sendSSEComplete, sendSSEError, setSSEHeaders } from '../utils/sse'
import { AppError } from '../utils/AppError'
import { log } from '../utils/logger'

/**
 * 获取安全的文件大小
 * - 非普通文件（设备文件、FIFO、socket 等）返回 0
 * - 虚拟文件系统中的文件返回 0（大小无实际意义）
 * - 符号链接指向虚拟文件系统的也返回 0
 */
const getSafeSize = (filePath: string, stats: fs.Stats): number => {
  // 目录：返回目录条目本身的大小（正常行为）
  if (stats.isDirectory()) return stats.size
  // 非普通文件（设备、FIFO、socket 等）：大小无意义
  if (!stats.isFile()) return 0
  // 检查真实路径（跟随符号链接后）是否在虚拟文件系统中
  try {
    const realPath = fs.realpathSync(filePath)
    if (isVirtualFs(realPath)) return 0
  } catch {
    // realpathSync 失败时保持原大小
  }
  return stats.size
}

/**
 * 获取文件列表
 */
export const getFileList = (queryPath: string | undefined): { path: string; files: FileInfo[] } => {
  const userPath = queryPath || ''
  const targetPath = safePath(userPath)

  if (!fs.existsSync(targetPath)) {
    throw new AppError('路径不存在')
  }

  const files = fs.readdirSync(targetPath, { withFileTypes: true })
  const fileList: FileInfo[] = files.map((file) => {
    const filePath = path.join(targetPath, file.name)
    const relativePath = path.relative(getStorageRoot(), filePath)
    const lstat = fs.lstatSync(filePath)

    try {
      const stats = fs.statSync(filePath)
      return {
        name: file.name,
        path: relativePath.replace(/\\/g, '/'),
        isDirectory: file.isDirectory(),
        size: getSafeSize(filePath, stats),
        modified: stats.mtime.toISOString(),
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return {
          name: file.name,
          path: relativePath.replace(/\\/g, '/'),
          isDirectory: file.isDirectory(),
          size: lstat.size,
          modified: lstat.mtime.toISOString(),
          broken: true,
        }
      }
      throw e
    }
  })

  // 排序：文件夹在前，文件在后
  fileList.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return {
    path: userPath || '',
    files: fileList,
  }
}

/**
 * 压缩文件夹（使用 SSE 发送进度）
 */
export const zipFolder = async (
  folderPath: string,
  res: Response,
  activeArchives: Record<string, archiver.Archiver>
): Promise<void> => {
  const folderFullPath = safePath(folderPath)

  if (!fs.existsSync(folderFullPath)) {
    throw new AppError('文件夹不存在')
  }

  const stats = fs.statSync(folderFullPath)
  if (!stats.isDirectory()) {
    throw new AppError('只能压缩文件夹')
  }

  const zipFileName = `${path.basename(folderPath)}.zip`
  const zipPath = path.join(path.dirname(folderFullPath), zipFileName)
  const totalBytes = await calculateDirSize(folderFullPath)

  const output = fs.createWriteStream(zipPath)
  const archive = archiver.create('zip', { zlib: { level: 9 } })

  let processedBytes = 0

  setSSEHeaders(res)

  archive.on('entry', (entry) => {
    if (entry.stats && !entry.stats.isDirectory()) {
      processedBytes += entry.stats.size
      const progress = Math.round((processedBytes / totalBytes) * 100)
      const message: SSEProgressMessage = { type: 'progress', progress }
      res.write(`data: ${JSON.stringify(message)}\n\n`)
    }
  })

  output.on('close', () => {
    const relativeZipPath = path.relative(getStorageRoot(), zipPath).replace(/\\/g, '/')
    sendSSEComplete(res, relativeZipPath)
    if (activeArchives[folderPath]) {
      delete activeArchives[folderPath]
    }
  })

  archive.on('error', (err) => {
    sendSSEError(res, err.message)
    if (activeArchives[folderPath]) {
      delete activeArchives[folderPath]
    }
  })

  archive.pipe(output)
  archive.directory(folderFullPath, path.basename(folderPath))
  archive.finalize()

  activeArchives[folderPath] = archive
}

/**
 * 取消压缩任务
 */
export const cancelZip = (
  folderPath: string,
  activeArchives: Record<string, archiver.Archiver>
): boolean => {
  const archive = activeArchives[folderPath]
  if (!archive) {
    return false
  }
  archive.abort()
  delete activeArchives[folderPath]
  return true
}

/**
 * 带取消信号的压缩（供后台任务系统使用）
 * @param sourcePath 源文件夹路径
 * @param targetPath zip 文件目标路径
 * @param abortSignal 取消信号
 * @param onProgress 进度回调 (percent, processedBytes, totalBytes)
 */
export const compressWithCancel = async (
  sourcePath: string,
  targetPath: string,
  abortSignal: AbortSignal,
  onProgress?: (percent: number, processedBytes: number, totalBytes: number) => void
): Promise<void> => {
  const sourceFullPath = safePath(sourcePath)
  const targetFullPath = safePath(targetPath)
  const totalBytes = await calculateDirSize(sourceFullPath)

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetFullPath)
    const archive = archiver.create('zip', { zlib: { level: 9 } })
    let processedBytes = 0
    let settled = false

    const cleanup = () => {
      try {
        if (fs.existsSync(targetFullPath)) {
          fs.unlinkSync(targetFullPath)
        }
      } catch { /* ignore */ }
    }

    const onAbort = () => {
      if (settled) return
      settled = true
      archive.abort()
      cleanup()
      reject(new Error('CANCELLED'))
    }

    if (abortSignal.aborted) {
      onAbort()
      return
    }

    abortSignal.addEventListener('abort', onAbort, { once: true })

    archive.on('entry', (entry) => {
      if (abortSignal.aborted || settled) return
      if (entry.stats && !entry.stats.isDirectory()) {
        try {
          const safeSize = getSafeSize(entry.name, entry.stats)
          if (safeSize > 0) {
            processedBytes += safeSize
          }
        } catch {
          // 无法获取安全大小时使用原始大小
          processedBytes += entry.stats.size
        }
        const percent = totalBytes > 0 ? Math.min(99, Math.round((processedBytes / totalBytes) * 100)) : 0
        onProgress?.(percent, processedBytes, totalBytes)
      }
    })

    output.on('close', () => {
      if (settled) return
      settled = true
      abortSignal.removeEventListener('abort', onAbort)
      resolve()
    })

    archive.on('error', (err) => {
      if (settled) return
      settled = true
      abortSignal.removeEventListener('abort', onAbort)
      cleanup()
      reject(err)
    })

    archive.pipe(output)
    archive.directory(sourceFullPath, path.basename(sourcePath))
    archive.finalize()
  })
}

/**
 * 移动文件（使用 SSE 发送进度）
 */
export const moveFile = (fromPath: string, toPath: string, res: Response): void => {
  const decodedFromPath = decodeURIComponent(fromPath)
  const decodedToPath = decodeURIComponent(toPath)

  const fromFullPath = safePath(decodedFromPath)
  const toFullPath = safePath(decodedToPath)

  if (fromFullPath === toFullPath) {
    log('WARNING', 'move', `源和目标路径相同: ${decodedFromPath}`)
    throw new AppError('源文件和目标路径相同')
  }

  if (!fs.existsSync(fromFullPath)) {
    throw new AppError('源文件不存在')
  }

  log('INFO', 'move', `${decodedFromPath} → ${decodedToPath}`)

  const stats = fs.statSync(fromFullPath)
  const fileSize = stats.size
  const isDirectory = stats.isDirectory()

  const toDir = path.dirname(toFullPath)
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true })
  }

  setSSEHeaders(res)

  const sendProgress = (progress: number, speed?: number, totalSize?: number) => {
    sendSSEProgress(res, progress, speed, totalSize)
  }

  const sendComplete = () => {
    sendSSEComplete(res)
    res.end()
  }

  const sendError = (message: string) => {
    sendSSEError(res, message)
    res.end()
  }

  if (!isDirectory) {
    // 文件移动，使用流式复制
    const readStream = fs.createReadStream(fromFullPath)
    const writeStream = fs.createWriteStream(toFullPath)

    let copiedBytes = 0
    const startTime = Date.now()

    readStream.on('data', (chunk) => {
      copiedBytes += chunk.length
      const elapsed = (Date.now() - startTime) / 1000
      const speed = elapsed > 0 ? copiedBytes / elapsed / 1024 / 1024 : 0
      const progress = Math.min(99, Math.floor((copiedBytes / fileSize) * 100))
      sendProgress(progress, speed, fileSize)
    })

    readStream.on('error', (err) => {
      writeStream.destroy()
      sendError(err.message)
    })

    writeStream.on('finish', () => {
      sendProgress(100, 0)
      fs.unlinkSync(fromFullPath)
      sendComplete()
    })

    writeStream.on('error', (err) => {
      readStream.destroy()
      sendError(err.message)
    })

    readStream.pipe(writeStream)
  } else {
    // 目录移动（异步流式复制）
    ;(async () => {
      let copied = 0

      const countFiles = (dir: string): number => {
        let count = 0
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const srcPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            count += countFiles(srcPath)
          } else {
            count++
          }
        }
        return count
      }

      const total = countFiles(fromFullPath)

      const copyRecursive = async (srcDir: string, destDir: string): Promise<void> => {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        const entries = fs.readdirSync(srcDir, { withFileTypes: true })
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name)
          const destPath = path.join(destDir, entry.name)
          if (entry.isDirectory()) {
            await copyRecursive(srcPath, destPath)
          } else {
            const readStream = fs.createReadStream(srcPath)
            const writeStream = fs.createWriteStream(destPath)
            await pipeline(readStream, writeStream)
            copied++
            const progress = Math.min(99, Math.floor((copied / total) * 100))
            sendProgress(progress)
          }
        }
      }

      copyRecursive(fromFullPath, toFullPath)
        .then(() => {
          fs.rmSync(fromFullPath, { recursive: true, force: true })
          sendProgress(100, 0)
          sendComplete()
        })
        .catch((err) => {
          sendError(err.message)
        })
    })()
  }
}

// ===== 后台任务：两阶段移动 =====

/**
 * 递归统计目录内文件数量
 */
function countFilesInDir(dir: string): number {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += countFilesInDir(p)
    } else {
      count++
    }
  }
  return count
}

/**
 * 流式复制单个文件（支持取消）
 * 在 on('data') 事件中检查 abortSignal，取消时清理目标半成品
 */
function copyFileStream(
  fromFullPath: string,
  toFullPath: string,
  fileSize: number,
  abortSignal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new Error('CANCELLED'))
      return
    }

    const readStream = fs.createReadStream(fromFullPath)
    const writeStream = fs.createWriteStream(toFullPath)

    const cleanup = () => {
      readStream.destroy()
      writeStream.destroy()
      try {
        if (fs.existsSync(toFullPath)) {
          fs.unlinkSync(toFullPath)
        }
      } catch { /* ignore cleanup errors */ }
    }

    readStream.on('data', () => {
      if (abortSignal.aborted) {
        cleanup()
        reject(new Error('CANCELLED'))
      }
    })

    readStream.on('error', (err) => {
      cleanup()
      reject(err)
    })

    writeStream.on('error', (err) => {
      cleanup()
      reject(err)
    })

    writeStream.on('finish', () => resolve())

    readStream.pipe(writeStream)
  })
}

/**
 * 复制（仅复制，不删除源文件），支持 AbortSignal 取消。
 *
 * @param fromPath  源路径（URL 编码形式）
 * @param toPath    目标路径（URL 编码形式）
 * @param abortSignal  取消信号
 * @param onProgress   进度回调 (0-99)
 * @returns 已复制的叶子文件数量
 */
export const copyWithCancel = async (
  fromPath: string,
  toPath: string,
  abortSignal: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<number> => {
  const decodedFromPath = decodeURIComponent(fromPath)
  const decodedToPath = decodeURIComponent(toPath)

  const fromFullPath = safePath(decodedFromPath)
  const toFullPath = safePath(decodedToPath)

  if (!fs.existsSync(fromFullPath)) {
    throw new AppError('源文件不存在: ' + decodedFromPath)
  }

  const stats = fs.statSync(fromFullPath)
  const isDirectory = stats.isDirectory()

  // 确保目标父目录存在
  const toParentDir = path.dirname(toFullPath)
  if (!fs.existsSync(toParentDir)) {
    fs.mkdirSync(toParentDir, { recursive: true })
  }

  if (!isDirectory) {
    // ----- 单文件复制 -----
    if (abortSignal.aborted) throw new Error('CANCELLED')

    const fileSize = stats.size
    const readStream = fs.createReadStream(fromFullPath)
    const writeStream = fs.createWriteStream(toFullPath)
    let copiedBytes = 0
    const startTime = Date.now()

    return new Promise<number>((resolve, reject) => {
      const cleanup = () => {
        readStream.destroy()
        writeStream.destroy()
        try {
          if (fs.existsSync(toFullPath)) fs.unlinkSync(toFullPath)
        } catch { /* ignore */ }
      }

      readStream.on('data', (chunk: Buffer) => {
        if (abortSignal.aborted) {
          cleanup()
          reject(new Error('CANCELLED'))
          return
        }
        copiedBytes += chunk.length
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? copiedBytes / elapsed / 1024 / 1024 : 0
        const percent = fileSize > 0 ? Math.min(99, Math.floor((copiedBytes / fileSize) * 100)) : 99
        onProgress?.(percent)
      })

      readStream.on('error', (err) => { cleanup(); reject(err) })
      writeStream.on('error', (err) => { cleanup(); reject(err) })

      writeStream.on('finish', () => {
        onProgress?.(100)
        resolve(1)
      })

      readStream.pipe(writeStream)
    })
  }

  // ----- 目录递归复制 -----
  const totalFiles = countFilesInDir(fromFullPath)
  let copied = 0

  const copyRecursive = async (srcDir: string, destDir: string): Promise<void> => {
    if (abortSignal.aborted) throw new Error('CANCELLED')

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true })
    for (const entry of entries) {
      if (abortSignal.aborted) throw new Error('CANCELLED')

      const srcPath = path.join(srcDir, entry.name)
      const destPath = path.join(destDir, entry.name)

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath)
      } else {
        const fileStats = fs.statSync(srcPath)
        await copyFileStream(srcPath, destPath, fileStats.size, abortSignal)
        copied++
        const percent = totalFiles > 0 ? Math.min(99, Math.floor((copied / totalFiles) * 100)) : 99
        onProgress?.(percent)
      }
    }
  }

  await copyRecursive(fromFullPath, toFullPath)
  onProgress?.(100)
  return totalFiles
}

/**
 * 删除源文件/目录（Phase 2，不可取消）
 */
export const removeSources = (paths: string[]): void => {
  for (const p of paths) {
    const decoded = decodeURIComponent(p)
    const fullPath = safePath(decoded)

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
      log('INFO', 'move', `已删除源: ${decoded}`)
    }
  }
}

/**
 * 下载文件
 */
export const downloadFile = (filePath: string, res: Response): void => {
  const fullPath = safePath(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new AppError('文件不存在')
  }

  const stats = fs.statSync(fullPath)
  if (stats.isDirectory()) {
    throw new AppError('不能下载文件夹')
  }

  const mimeType = mime.lookup(fullPath) || 'application/octet-stream'
  const filename = path.basename(fullPath)
  const encodedFilename = encodeURIComponent(filename)
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
  res.setHeader('Content-Length', stats.size)

  const stream = fs.createReadStream(fullPath)
  stream.pipe(res)
}

/**
 * 重命名文件
 */
export const renameFile = (filePath: string, newName: string): void => {
  if (newName.includes('/') || newName.includes('\\') || newName === '..' || newName === '.') {
    throw new AppError('非法文件名')
  }

  const oldFullPath = safePath(filePath)
  const newFullPath = path.join(path.dirname(oldFullPath), newName)

  if (!fs.existsSync(oldFullPath)) {
    throw new AppError('文件不存在')
  }

  fs.renameSync(oldFullPath, newFullPath)
  log('INFO', 'rename', `${filePath} → ${newName}`)
}

/**
 * 删除文件/文件夹
 */
export const deleteFile = (filePath: string): void => {
  const fullPath = safePath(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new AppError('文件不存在')
  }

  fs.rmSync(fullPath, { recursive: true, force: true })
  log('INFO', 'delete', filePath)
}

export const deleteFiles = (
  filePaths: string[]
): { success: number; failed: { path: string; message: string }[] } => {
  let success = 0
  const failed: { path: string; message: string }[] = []

  for (const filePath of filePaths) {
    try {
      const fullPath = safePath(filePath)
      if (!fs.existsSync(fullPath)) {
        failed.push({ path: filePath, message: '文件不存在' })
        continue
      }
      fs.rmSync(fullPath, { recursive: true, force: true })
      success++
    } catch (e) {
      failed.push({ path: filePath, message: e instanceof Error ? e.message : '删除失败' })
    }
  }

  if (success > 0) log('INFO', 'delete', `批量删除 ${success} 个文件`)
  if (failed.length > 0)
    log(
      'WARNING',
      'delete',
      `批量删除失败 ${failed.length} 个: ${failed.map((f) => f.path).join(', ')}`
    )
  return { success, failed }
}

/**
 * 创建文件夹
 */
export const createFolder = (parentPath: string | undefined, name: string): void => {
  if (name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
    throw new AppError('非法文件夹名称')
  }

  const parentFullPath = safePath(parentPath || '')
  const newFolderPath = path.join(parentFullPath, name)

  if (fs.existsSync(newFolderPath)) {
    throw new AppError('文件夹已存在')
  }

  fs.mkdirSync(newFolderPath, { recursive: true })
  log('INFO', 'createFolder', `${parentPath || '/'}/${name}`)
}
