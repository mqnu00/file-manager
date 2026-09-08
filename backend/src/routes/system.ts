import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getAppInfo, checkForUpdate } from '../utils/version'

const router = Router()
router.use(authMiddleware)

// 应用信息：当前版本 + 项目地址（纯本地读取，无网络请求）
router.get('/info', (_req: Request, res: Response) => {
  res.json(getAppInfo())
})

// 检测更新：查询 npm registry 的 latest 版本并与当前版本比较（10s 超时）
router.get('/check-update', async (_req: Request, res: Response) => {
  try {
    res.json(await checkForUpdate())
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'AbortError' || name === 'TimeoutError') {
      res.status(504).json({ error: 'npm registry request timed out' })
      return
    }
    res.status(502).json({ error: `Failed to check update: ${err}` })
  }
})

export default router
