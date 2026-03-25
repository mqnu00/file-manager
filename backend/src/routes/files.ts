import express, { Request, Response } from 'express'
import * as fileService from '../services/fileService'
import { ArchiveLocals, MoveRequest, RenameRequest, DeleteRequest, ZipCancelRequest } from '../types'

const router = express.Router()

// ========== 路由处理 ==========

/**
 * 获取文件列表
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { path } = req.query
    // 处理 ParsedQs 类型
    const queryPath = typeof path === 'string' ? path : undefined
    const result = fileService.getFileList(queryPath)
    res.json(result)
  } catch (e) {
    console.error('获取文件列表失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '获取文件列表失败' })
  }
})

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
router.post('/zip/cancel', (req: Request<{}, {}, ZipCancelRequest>, res: Response) => {
  try {
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
  } catch (e) {
    console.error('取消压缩失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '取消失败' })
  }
})

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
 */
router.get('/*', (req: Request, res: Response) => {
  try {
    const filePath = req.params[0]
    fileService.downloadFile(filePath, res)
  } catch (e) {
    console.error('下载文件失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '下载失败' })
  }
})

/**
 * 重命名文件
 */
router.put('/rename', (req: Request<{}, {}, RenameRequest>, res: Response) => {
  try {
    const { path: filePath, newName } = req.body

    if (!filePath || !newName) {
      return res.status(400).json({ message: '缺少必要参数' })
    }

    fileService.renameFile(filePath, newName)
    res.json({ success: true })
  } catch (e) {
    console.error('重命名失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '重命名失败' })
  }
})

/**
 * 删除文件/文件夹
 */
router.delete('/', (req: Request<{}, {}, DeleteRequest>, res: Response) => {
  try {
    const { path: filePath } = req.query as unknown as DeleteRequest

    if (!filePath) {
      return res.status(400).json({ message: '缺少文件路径' })
    }

    fileService.deleteFile(filePath)
    res.json({ success: true })
  } catch (e) {
    console.error('删除失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '删除失败' })
  }
})

export default router
