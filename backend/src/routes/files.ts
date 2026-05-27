import express, { Request, Response, NextFunction } from 'express'
import * as fileService from '../services/fileService'
import { ArchiveLocals, MoveRequest, RenameRequest, DeleteRequest, BatchDeleteRequest, ZipCancelRequest } from '../types'
import { asyncHandler } from '../middleware/asyncHandler'

const router = express.Router()

/**
 * 获取文件列表
 */
router.get('/', asyncHandler((req: Request, res: Response) => {
  const { path } = req.query
  const queryPath = typeof path === 'string' ? path : undefined
  const result = fileService.getFileList(queryPath)
  res.json(result)
}))

/**
 * 压缩文件夹（使用 SSE 发送进度）
 */
router.get('/zip', (req: Request, res: Response) => {
  try {
    const folderPath = req.query.path as string

    if (!folderPath) {
      return res.status(400).json({ message: '缺少文件夹路径' })
    }

    const activeArchives = (req.app.locals as ArchiveLocals).activeArchives || {}
    if (!(req.app.locals as ArchiveLocals).activeArchives) {
      (req.app.locals as ArchiveLocals).activeArchives = activeArchives
    }

    fileService.zipFolder(folderPath, res, activeArchives)
  } catch (e) {
    console.error('压缩失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '压缩失败' })
  }
})

/**
 * 取消压缩任务
 */
router.post('/zip/cancel', asyncHandler((req: Request<{}, {}, ZipCancelRequest>, res: Response) => {
  const { path: folderPath } = req.body

  if (!folderPath) {
    return res.status(400).json({ message: '缺少文件夹路径' })
  }

  const archiveLocals = req.app.locals as ArchiveLocals
  if (!archiveLocals.activeArchives) {
    archiveLocals.activeArchives = {}
  }

  const success = fileService.cancelZip(folderPath, archiveLocals.activeArchives)

  if (!success) {
    return res.status(404).json({ message: '未找到正在进行的压缩任务' })
  }

  res.json({ success: true })
}))

/**
 * 移动文件（使用 SSE 发送进度）
 */
router.get('/move', (req: Request<{}, {}, MoveRequest>, res: Response) => {
  try {
    const { fromPath, toPath } = req.query as any

    if (!fromPath || !toPath) {
      return res.status(400).json({ message: '缺少必要参数' })
    }

    fileService.moveFile(fromPath, toPath, res)
  } catch (e) {
    console.error('移动文件失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '移动失败' })
  }
})

/**
 * 下载文件
 *
 * ⚠️ 通配符兜底路由 — 必须保持在所有具体 GET 路由之后
 * 否则 /zip、/move 等路由会被通配符捕获
 */
router.get('/download/*', asyncHandler((req: Request, res: Response) => {
  const filePath = req.params[0]
  fileService.downloadFile(filePath, res)
}))

/**
 * 重命名文件
 */
router.put('/rename', asyncHandler((req: Request<{}, {}, RenameRequest>, res: Response) => {
  const { path: filePath, newName } = req.body

  if (!filePath || !newName) {
    return res.status(400).json({ message: '缺少必要参数' })
  }

  fileService.renameFile(filePath, newName)
  res.json({ success: true })
}))

/**
 * 批量删除文件/文件夹
 */
router.post('/batch-delete', asyncHandler((req: Request<{}, {}, BatchDeleteRequest>, res: Response) => {
  const { paths } = req.body

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ message: '缺少文件路径列表' })
  }

  const result = fileService.deleteFiles(paths)
  res.json(result)
}))

/**
 * 删除文件/文件夹
 */
router.delete('/', asyncHandler((req: Request<{}, {}, DeleteRequest>, res: Response) => {
  const { path: filePath } = req.query as unknown as DeleteRequest

  if (!filePath) {
    return res.status(400).json({ message: '缺少文件路径' })
  }

  fileService.deleteFile(filePath)
  res.json({ success: true })
}))

export default router
