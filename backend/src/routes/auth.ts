import { Router, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getConfig } from '../config'
import { createSession, validateSession, destroySession, getTokenFromHeader } from '../middleware/auth'

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
    res.status(401).json({ error: '令牌错误', remaining })
    return
  }

  const sessionId = createSession()
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

export default router