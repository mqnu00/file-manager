import { Router, Request, Response } from 'express'
import { getSanitizedConfig, updateConfig, reloadConfig, getConfig } from '../config'
import { authMiddleware, clearAllSessions } from '../middleware/auth'
import { cleanOldLogs } from '../utils/logger'

const router = Router()
router.use(authMiddleware)

router.get('/', (_req: Request, res: Response) => {
  res.json(getSanitizedConfig())
})

router.put('/', (req: Request, res: Response) => {
  const { auth, storageRoot, log } = req.body
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

  if (log !== undefined) {
    updates.log = {}
    if (log.cleanupOnStartup !== undefined) {
      updates.log.cleanupOnStartup = log.cleanupOnStartup
    }
    if (log.retentionDays !== undefined) {
      updates.log.retentionDays = log.retentionDays
    }
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

router.post('/clean-logs', (_req: Request, res: Response) => {
  const cfg = getConfig()
  const maxDays = cfg.log?.retentionDays ?? 30
  const deleted = cleanOldLogs(maxDays)
  res.json({ success: true, deleted })
})

export default router