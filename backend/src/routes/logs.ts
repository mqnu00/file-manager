import { Router, Request, Response } from 'express'
import { readLogs } from '../utils/logger'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { date, level, action, keyword, page = '1', pageSize = '50' } = req.query as {
    date?: string
    level?: string
    action?: string
    keyword?: string
    page?: string
    pageSize?: string
  }

  const targetDate = date || new Date().toISOString().split('T')[0]
  const allLogs = readLogs(targetDate, { level, action, keyword })

  const p = Math.max(1, parseInt(page, 10) || 1)
  const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50))
  const start = (p - 1) * ps
  const logs = allLogs.slice(start, start + ps)

  res.json({ logs, total: allLogs.length })
})

export default router
