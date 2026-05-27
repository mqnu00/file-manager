import { Router, Request, Response } from 'express'
import { getConfig } from '../config'
import { createSession, validateSession, destroySession, getTokenFromHeader } from '../middleware/auth'

const router = Router()

router.post('/login', (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) {
    res.status(400).json({ error: '请输入令牌' })
    return
  }

  const config = getConfig()
  if (token !== config.auth.token) {
    res.status(401).json({ error: '令牌错误' })
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