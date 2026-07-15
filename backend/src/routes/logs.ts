import { Router, Request, Response } from 'express'
import { readLogs, readLogsByRange, getAvailableDates } from '../utils/logger'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { date, startDate, endDate, level, action, keyword, page = '1', pageSize = '50' } = req.query as {
    date?: string
    startDate?: string
    endDate?: string
    level?: string
    action?: string
    keyword?: string
    page?: string
    pageSize?: string
  }

  let allLogs: string[]

  if (startDate) {
    // 区间查询
    allLogs = readLogsByRange(startDate, endDate || startDate, { level, action, keyword })
  } else {
    // 向后兼容：单日期查询
    const targetDate = date || new Date().toISOString().split('T')[0]
    allLogs = readLogs(targetDate, { level, action, keyword })
  }

  const p = Math.max(1, parseInt(page, 10) || 1)
  const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50))
  const start = (p - 1) * ps
  const logs = allLogs.slice(start, start + ps)

  res.json({ logs, total: allLogs.length })
})

/**
 * 获取有日志的日期列表
 */
router.get('/dates', (_req: Request, res: Response) => {
  const dates = getAvailableDates()
  res.json({ dates })
})

export default router
