import { Router, Request, Response } from 'express'
import { getSanitizedConfig, updateConfig, reloadConfig } from '../config'
import { authMiddleware, clearAllSessions } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/', (_req: Request, res: Response) => {
  res.json(getSanitizedConfig())
})

router.put('/', (req: Request, res: Response) => {
  const { auth, storageRoot } = req.body
  const updates: any = {}

  if (auth) {
    updates.auth = {}
    if (auth.token !== undefined && auth.token !== '') {
      updates.auth.token = auth.token
      clearAllSessions()
    }
    if (auth.tokenExpiryHours !== undefined) {
      updates.auth.tokenExpiryHours = auth.tokenExpiryHours
    }
  }

  if (storageRoot !== undefined) {
    updates.storageRoot = storageRoot
  }

  const updated = updateConfig(updates)
  const sanitized = getSanitizedConfig()

  res.json({
    success: true,
    config: sanitized,
    sessionsCleared: !!updates.auth?.token
  })
})

router.post('/reload', (_req: Request, res: Response) => {
  reloadConfig()
  res.json({ success: true, message: '配置已重新加载' })
})

export default router