import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import mime from 'mime-types'
import { Response } from 'express'
import { FileInfo, SSEProgressMessage } from '../types'
import { safePath, calculateDirSize } from '../utils/safePath'
import { sendSSEProgress, sendSSEComplete, sendSSEError, setSSEHeaders } from '../utils/sse'

/**
 * 获取文件列表
 */
export const getFileList = (queryPath: string | undefined): { path: string; files: FileInfo[] } => {
  const userPath = queryPath || ''
  const targetPath = safePath(userPath)

  if (!fs.existsSync(targetPath)) {
    throw new Error('路径不存在')
  }

  const files = fs.readdirSync(targetPath, { withFileTypes: true })
  const fileList: FileInfo[] = files.map(file => {
    const filePath = path.join(targetPath, file.name)
    const stats = fs.statSync(filePath)
    const relativePath = path.relative(process.env.FILE_MANAGER_BASE_DIR || '/', filePath)

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

  return {
    path: userPath || '',
    files: fileList
  }
}

/**
 * 压缩文件夹（使用 SSE 发送进度）
 */
export const zipFolder = (folderPath: string, res: Response, activeArchives: Record<string, archiver.Archiver>): void => {
  const folderFullPath = safePath(folderPath)

  if (!fs.existsSync(folderFullPath)) {
    throw new Error('文件夹不存在')
  }

  const stats = fs.statSync(folderFullPath)
  if (!stats.isDirectory()) {
    throw new Error('只能压缩文件夹')
  }

  const zipFileName = `${path.basename(folderPath)}.zip`
  const zipPath = path.join(path.dirname(folderFullPath), zipFileName)
  const totalBytes = calculateDirSize(folderFullPath)

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
    const relativeZipPath = path.relative(process.env.FILE_MANAGER_BASE_DIR || '/', zipPath).replace(/\\/g, '/')
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
export const cancelZip = (folderPath: string, activeArchives: Record<string, archiver.Archiver>): boolean => {
  const archive = activeArchives[folderPath]
  if (!archive) {
    return false
  }
  archive.abort()
  delete activeArchives[folderPath]
  return true
}

/**
 * 移动文件（使用 SSE 发送进度）
 */
export const moveFile = (
  fromPath: string,
  toPath: string,
  res: Response
): void => {
  const decodedFromPath = decodeURIComponent(fromPath)
  const decodedToPath = decodeURIComponent(toPath)

  const fromFullPath = safePath(decodedFromPath)
  const toFullPath = safePath(decodedToPath)

  if (!fs.existsSync(fromFullPath)) {
    throw new Error('源文件不存在')
  }

  const stats = fs.statSync(fromFullPath)
  const fileSize = stats.size
  const isDirectory = stats.isDirectory()

  const toDir = path.dirname(toFullPath)
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true })
  }

  setSSEHeaders(res)

  const sendProgress = (progress: number, speed?: number) => {
    sendSSEProgress(res, progress, speed)
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
      sendProgress(progress, speed)
    })

    readStream.on('end', () => {
      sendProgress(100, 0)
      fs.unlinkSync(fromFullPath)
      sendComplete()
    })

    readStream.on('error', (err) => {
      writeStream.destroy()
      sendError(err.message)
    })

    writeStream.on('error', (err) => {
      readStream.destroy()
      sendError(err.message)
    })

    readStream.pipe(writeStream)
  } else {
    // 目录移动
    const copyDir = (src: string, dest: string): void => {
      const entries = fs.readdirSync(src, { withFileTypes: true })
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

      const total = countFiles(src)

      const copyRecursive = (srcDir: string, destDir: string) => {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        const entries = fs.readdirSync(srcDir, { withFileTypes: true })
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name)
          const destPath = path.join(destDir, entry.name)
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath)
          } else {
            const data = fs.readFileSync(srcPath)
            fs.writeFileSync(destPath, data)
            copied++
            const progress = Math.min(99, Math.floor((copied / total) * 100))
            sendProgress(progress)
          }
        }
      }

      copyRecursive(src, dest)
    }

    copyDir(fromFullPath, toFullPath)
    fs.rmSync(fromFullPath, { recursive: true, force: true })
    sendProgress(100, 0)
    sendComplete()
  }
}

/**
 * 下载文件
 */
export const downloadFile = (filePath: string, res: Response): void => {
  const fullPath = safePath(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error('文件不存在')
  }

  const stats = fs.statSync(fullPath)
  if (stats.isDirectory()) {
    throw new Error('不能下载文件夹')
  }

  const mimeType = mime.lookup(fullPath) || 'application/octet-stream'
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`)
  res.setHeader('Content-Length', stats.size)

  const stream = fs.createReadStream(fullPath)
  stream.pipe(res)
}

/**
 * 重命名文件
 */
export const renameFile = (filePath: string, newName: string): void => {
  const oldFullPath = safePath(filePath)
  const newFullPath = path.join(path.dirname(oldFullPath), newName)

  if (!fs.existsSync(oldFullPath)) {
    throw new Error('文件不存在')
  }

  fs.renameSync(oldFullPath, newFullPath)
}

/**
 * 删除文件/文件夹
 */
export const deleteFile = (filePath: string): void => {
  const fullPath = safePath(filePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error('文件不存在')
  }

  fs.rmSync(fullPath, { recursive: true, force: true })
}

/**
 * 创建文件夹
 */
export const createFolder = (parentPath: string | undefined, name: string): void => {
  const parentFullPath = safePath(parentPath || '')
  const newFolderPath = path.join(parentFullPath, name)

  if (fs.existsSync(newFolderPath)) {
    throw new Error('文件夹已存在')
  }

  fs.mkdirSync(newFolderPath, { recursive: true })
}
