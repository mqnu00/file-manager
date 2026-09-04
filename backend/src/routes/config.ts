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
  const { auth, storageRoot, log, pluginInstallDir, npmRegistry } = req.body
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

  if (pluginInstallDir !== undefined) {
    updates.pluginInstallDir = pluginInstallDir
  }

  if (npmRegistry !== undefined) {
    updates.npmRegistry = {}
    if (npmRegistry.url !== undefined) updates.npmRegistry.url = npmRegistry.url
    if (npmRegistry.enabled !== undefined) updates.npmRegistry.enabled = npmRegistry.enabled
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

router.post('/test-registry', async (req: Request, res: Response) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: '缺少 url 参数' })
    return
  }

  const start = Date.now()
  try {
    // 请求一个已知的小型包元数据来测试连通性 + 测延迟
    const response = await fetch(`${url}/lodash`, {
      signal: AbortSignal.timeout(10000),
    })
    const latency = Date.now() - start
    if (response.ok) {
      res.json({ ok: true, latency })
    } else {
      res.json({ ok: false, latency, error: `HTTP ${response.status}` })
    }
  } catch (err: unknown) {
    const latency = Date.now() - start
    const error = err instanceof Error ? err.message : String(err)
    res.json({ ok: false, latency, error })
  }
})

export default router