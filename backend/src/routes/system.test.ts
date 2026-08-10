import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
})

describe('系统信息 API（冒烟）', () => {
  it('未认证访问 → 401', async () => {
    const res = await request(app).get('/api/system')
    expect(res.status).toBe(401)
  })

  it('GET /api/system 返回完整结构字段', async () => {
    const res = await request(app).get('/api/system').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    const body = res.body

    expect(body.os).toBeDefined()
    expect(body.os.type).toBeTruthy()
    expect(typeof body.os.uptimeFormatted).toBe('string')

    expect(body.cpu).toBeDefined()
    expect(body.cpu.cores).toBeGreaterThan(0)
    expect(typeof body.cpu.usage).toBe('number')

    expect(body.memory).toBeDefined()
    expect(body.memory.total).toBeGreaterThan(0)
    expect(body.memory.usagePercent).toBeGreaterThanOrEqual(0)

    expect(body.disk).toBeDefined()
    expect(body.disks).toBeInstanceOf(Array)

    expect(body.node.version).toMatch(/^v\d+\./)
    expect(body.node.pid).toBeGreaterThan(0)
  })
})
