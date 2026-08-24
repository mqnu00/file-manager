import { Router, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getConfig } from '../config'
import { createSession, validateSession, destroySession, getTokenFromHeader, authMiddleware } from '../middleware/auth'
import * as sudoService from '../services/sudoService'
import { log } from '../utils/logger'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: '登录尝试次数过多，请 1 分钟后再试', remaining: 0 })
  }
})

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) {
    res.status(400).json({ error: '请输入令牌' })
    return
  }

  const config = getConfig()
  if (token !== config.auth.token) {
    const remaining = (req as any).rateLimit?.remaining ?? 0
    log('WARNING', 'login', `令牌错误 - ${req.ip}`)
    res.status(401).json({ error: '令牌错误', remaining })
    return
  }

  const sessionId = createSession()
  log('INFO', 'login', `登录成功 - ${req.ip}`)
  res.json({
    success: true,
    sessionToken: sessionId,
    expiresIn: config.auth.tokenExpiryHours * 3600
  })
})

router.post('/logout', (req: Request, res: Response) => {
  const sessionToken = getTokenFromHeader(req)
  if (sessionToken) {
    destroySession(sessionToken)
  }
  res.json({ success: true })
})

router.get('/check', (req: Request, res: Response) => {
  const sessionToken = getTokenFromHeader(req)
  if (!sessionToken || !validateSession(sessionToken)) {
    res.status(401).json({ valid: false })
    return
  }
  res.json({ valid: true })
})

// ===== sudo 提权：校验并缓存凭据（限时） =====
router.post('/elevate', authMiddleware, (req: Request, res: Response) => {
  if (!sudoService.isEnabled()) {
    return res.status(403).json({ error: '提权功能未启用' })
  }
  const { username, password, chownBack } = req.body as {
    username?: string
    password?: string
    chownBack?: boolean
  }
  if (!username || !password) {
    return res.status(400).json({ error: '缺少用户名或密码' })
  }
  const ok = sudoService.setCredentials(username, password, chownBack !== false)
  if (!ok) {
    return res.status(401).json({ error: '用户名或密码错误 / 系统不支持 sudo' })
  }
  log('INFO', 'auth', `sudo 提权凭据已缓存 - ${req.ip}`)
  res.json({ success: true })
})

router.post('/elevate-clear', authMiddleware, (req: Request, res: Response) => {
  sudoService.clearCredentials()
  res.json({ success: true })
})

export default router