import { Request, Response, NextFunction } from 'express'
import { getConfig } from '../config'

interface SessionEntry {
  createdAt: number
  expiresAt: number
}

const sessions = new Map<string, SessionEntry>()

export function createSession(): string {
  const sessionId = generateToken(32)
  const now = Date.now()
  const expiryMs = getConfig().auth.tokenExpiryHours * 3600 * 1000
  sessions.set(sessionId, {
    createdAt: now,
    expiresAt: now + expiryMs
  })
  return sessionId
}

export function validateSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId)
    return false
  }
  return true
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function clearAllSessions(): void {
  sessions.clear()
}

function generateToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' })
    return
  }
  const token = authHeader.slice(7)
  if (!validateSession(token)) {
    res.status(401).json({ error: '令牌无效或已过期，请重新登录' })
    return
  }
  next()
}

export function getTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}