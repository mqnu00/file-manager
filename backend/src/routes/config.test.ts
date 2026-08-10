import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
})

describe('配置 API（集成）', () => {
  it('未认证访问 → 401', async () => {
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(401)
  })

  it('GET /api/config 返回脱敏配置（token 打码）', async () => {
    const res = await request(app).get('/api/config').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.auth.token).toBe('tes***') // test-token-123 → 前 3 位 + ***
    expect(res.body.storageRoot).toBeTruthy()
    expect(res.body.log.retentionDays).toBe(1)
  })

  it('PUT 更新 log 配置并回读一致', async () => {
    const res = await request(app)
      .put('/api/config')
      .send({ log: { retentionDays: 7, cleanupOnStartup: false } })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.sessionsCleared).toBe(false)
    expect(res.body.config.log.retentionDays).toBe(7)

    const read = await request(app).get('/api/config').set('Authorization', authHeader)
    expect(read.body.log.retentionDays).toBe(7)
  })

  it('PUT 部分更新不覆盖未提交字段', async () => {
    const res = await request(app)
      .put('/api/config')
      .send({ log: { retentionDays: 3 } })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    // storageRoot 未提交应保持不变
    expect(res.body.config.storageRoot).toBeTruthy()
  })

  it('POST /api/config/reload 重新加载配置', async () => {
    const res = await request(app).post('/api/config/reload').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('更新 token 清除所有会话（sessionsCleared: true）', async () => {
    const res = await request(app)
      .put('/api/config')
      .send({ auth: { token: 'new-token-456' } })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.sessionsCleared).toBe(true)

    // 旧 session 已失效
    const check = await request(app).get('/api/config').set('Authorization', authHeader)
    expect(check.status).toBe(401)
  })
})
