import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app'

/**
 * 独立文件：express-rate-limit 是模块级内存计数，
 * 单独文件（独立 worker 进程）保证从 0 开始计数，避免与其他用例互相污染。
 */
describe('登录限流', () => {
  it('1 分钟内错误超过 5 次 → 429', async () => {
    let lastStatus = 0
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/api/auth/login').send({ token: 'wrong-token' })
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})
