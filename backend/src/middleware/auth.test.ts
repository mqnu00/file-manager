import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import type { Request, Response } from 'express'
import app from '../app'
import {
  createSession,
  validateSession,
  destroySession,
  clearAllSessions,
  authMiddleware,
} from './auth'

const VALID_TOKEN = 'test-token-123'

/** 构造最小 mock Response，供 authMiddleware 直测 */
function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = { statusCode: 0, body: null } as Response & { statusCode: number; body: unknown }
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: unknown) => {
    res.body = body
    return res
  }
  return res
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ip: '127.0.0.1', ...overrides } as Request
}

describe('session 管理（单元）', () => {
  beforeEach(() => clearAllSessions())

  it('createSession 生成可用 token', () => {
    const token = createSession()
    expect(token).toBeTruthy()
    expect(validateSession(token)).toBe(true)
  })

  it('无效 token 校验失败', () => {
    expect(validateSession('no-such-token')).toBe(false)
    expect(validateSession('')).toBe(false)
  })

  it('过期 session 被拒绝并清理', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const token = createSession()
      expect(validateSession(token)).toBe(true)

      // 超过 tokenExpiryHours(1h) 后失效
      vi.setSystemTime(new Date('2026-01-01T02:00:00Z'))
      expect(validateSession(token)).toBe(false)
      // 再次校验同样失败（已被清理）
      expect(validateSession(token)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('destroySession 使 token 失效', () => {
    const token = createSession()
    destroySession(token)
    expect(validateSession(token)).toBe(false)
  })

  it('clearAllSessions 清空所有会话', () => {
    createSession()
    createSession()
    clearAllSessions()
    expect(validateSession(createSession())).toBe(true)
  })
})

describe('authMiddleware（单元）', () => {
  beforeEach(() => clearAllSessions())

  it('无 Authorization 头 → 401', () => {
    const res = mockRes()
    const next = vi.fn()
    authMiddleware(mockReq(), res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('非 Bearer 头 → 401', () => {
    const res = mockRes()
    authMiddleware(mockReq({ headers: { authorization: 'Basic abc' } }), res, vi.fn())
    expect(res.statusCode).toBe(401)
  })

  it('无效 token → 401', () => {
    const res = mockRes()
    authMiddleware(mockReq({ headers: { authorization: 'Bearer invalid' } }), res, vi.fn())
    expect(res.statusCode).toBe(401)
  })

  it('有效 token → 放行', () => {
    const sessionId = createSession()
    const res = mockRes()
    const next = vi.fn()
    authMiddleware(mockReq({ headers: { authorization: `Bearer ${sessionId}` } }), res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(0)
  })
})

describe('认证 API（集成）', () => {
  it('登录成功返回 sessionToken', async () => {
    const res = await request(app).post('/api/auth/login').send({ token: VALID_TOKEN })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.sessionToken).toBeTruthy()
    expect(res.body.expiresIn).toBe(3600)
  })

  it('错误令牌 → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ token: 'wrong-token' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('令牌错误')
  })

  it('缺少令牌 → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(400)
  })

  it('GET /api/auth/check：有效 token → valid:true', async () => {
    const login = await request(app).post('/api/auth/login').send({ token: VALID_TOKEN })
    const res = await request(app)
      .get('/api/auth/check')
      .set('Authorization', `Bearer ${login.body.sessionToken}`)
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
  })

  it('GET /api/auth/check：无 token → 401 valid:false', async () => {
    const res = await request(app).get('/api/auth/check')
    expect(res.status).toBe(401)
    expect(res.body.valid).toBe(false)
  })

  it('logout 后 token 失效', async () => {
    const login = await request(app).post('/api/auth/login').send({ token: VALID_TOKEN })
    const sessionToken = login.body.sessionToken

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`)
    expect(logout.status).toBe(200)

    const check = await request(app)
      .get('/api/auth/check')
      .set('Authorization', `Bearer ${sessionToken}`)
    expect(check.status).toBe(401)
    expect(check.body.valid).toBe(false)
  })
})
