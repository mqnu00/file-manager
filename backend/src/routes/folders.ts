import express, { Request, Response } from 'express'
import * as fileService from '../services/fileService'
import { CreateFolderRequest } from '../types'

const router = express.Router()

/**
 * 创建文件夹
 */
router.post('/', (req: Request<{}, {}, CreateFolderRequest>, res: Response) => {
  try {
    const { path: parentPath, name } = req.body

    if (!name) {
      return res.status(400).json({ message: '缺少文件夹名称' })
    }

    fileService.createFolder(parentPath, name)
    res.json({ success: true })
  } catch (e) {
    console.error('创建文件夹失败:', e)
    res.status(500).json({ message: e instanceof Error ? e.message : '创建失败' })
  }
})

export default router
