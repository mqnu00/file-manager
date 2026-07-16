import express, { Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { MoveTaskRequest, CompressTaskRequest } from '../types'
import {
  createMoveTask,
  createCompressTask,
  getTask,
  getAllTasks,
  cancelTask,
  subscribe,
} from '../services/taskManager'

const router = express.Router()

/**
 * 创建移动任务
 */
router.post(
  '/move',
  asyncHandler(async (req: Request, res: Response) => {
    const { sourcePaths, targetPath } = req.body as MoveTaskRequest

    if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length === 0) {
      return res.status(400).json({ message: '缺少源文件路径列表' })
    }
    if (!targetPath) {
      return res.status(400).json({ message: '缺少目标路径' })
    }

    // 提取文件名用于显示
    const sourceNames = sourcePaths.map((p: string) => {
      const parts = p.split('/')
      return parts[parts.length - 1]
    })

    try {
      const task = createMoveTask(sourcePaths, sourceNames, targetPath)
      res.json({ taskId: task.id })
    } catch (e: any) {
      if (e.code === 'TASK_CONFLICT') {
        return res.status(409).json({ message: e.message })
      }
      throw e
    }
  })
)

/**
 * 创建压缩任务
 */
router.post(
  '/compress',
  asyncHandler(async (req: Request, res: Response) => {
    const { sourcePath } = req.body as CompressTaskRequest

    if (!sourcePath) {
      return res.status(400).json({ message: '缺少源文件夹路径' })
    }

    try {
      const task = createCompressTask(sourcePath)
      res.json({ taskId: task.id })
    } catch (e: any) {
      if (e.code === 'TASK_CONFLICT') {
        return res.status(409).json({ message: e.message })
      }
      throw e
    }
  })
)

/**
 * 获取所有任务
 */
router.get(
  '/',
  asyncHandler((_req: Request, res: Response) => {
    const tasks = getAllTasks()
    res.json({ tasks })
  })
)

/**
 * 获取单个任务
 */
router.get(
  '/:id',
  asyncHandler((req: Request, res: Response) => {
    const task = getTask(req.params.id as string)
    if (!task) {
      return res.status(404).json({ message: '任务不存在' })
    }
    res.json({ task })
  })
)

/**
 * 取消任务
 */
router.post(
  '/:id/cancel',
  asyncHandler((req: Request, res: Response) => {
    const success = cancelTask(req.params.id as string)
    if (!success) {
      return res.status(400).json({ message: '无法取消该任务（可能已进入删除阶段或已完成）' })
    }
    res.json({ success: true })
  })
)

/**
 * SSE 流：订阅任务进度
 */
router.get(
  '/:id/stream',
  (req: Request, res: Response) => {
    const taskId = req.params.id as string
    subscribe(taskId, res)
  }
)

export default router
