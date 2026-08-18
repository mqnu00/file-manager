/**
 * 路由挂载回归测试：验证 /api/file-office-viewer 下 /convert（auth）与
 * /stream（令牌）真实可达。修复与 file-viewer 相同的 auth 未挂载缺陷。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { install } from './backend'

let app: Express
let tmpRoot: string

function mockAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next()
  } else {
    res.status(401).json({ message: '未授权' })
  }
}

function mockSafe(p: string): string {
  if (p.includes('..')) throw new Error('非法路径')
  return path.join(tmpRoot, p)
}

beforeAll(() => {
  app = express()
  app.use(express.json())
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fo-routes-'))

  install({
    express,
    app,
    middleware: { auth: mockAuth },
    utils: {
      path: { safe: mockSafe },
      logger: { log: () => {} },
    } as never,
  } as never)
})

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

const auth = { Authorization: 'Bearer test-session' }

describe('路由挂载（回归：auth 未挂载导致 /convert 404）', () => {
  it('POST /convert 无鉴权 → 401', async () => {
    const res = await request(app).post('/api/file-office-viewer/convert').send({ path: 'a.pptx' })
    expect(res.status).toBe(401)
  })

  it('POST /convert 带鉴权且文件不存在 → 404', async () => {
    const res = await request(app)
      .post('/api/file-office-viewer/convert')
      .set(auth)
      .send({ path: 'no-such.pptx' })
    expect(res.status).toBe(404)
  })

  it('POST /convert 支持格式校验（txt 不被当作 office）', async () => {
    fs.writeFileSync(path.join(tmpRoot, 'note.txt'), 'plain')
    const res = await request(app)
      .post('/api/file-office-viewer/convert')
      .set(auth)
      .send({ path: 'note.txt' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toContain('不支持的预览格式')
  })

  it('GET /stream 无 token → 400；伪造 token → 403', async () => {
    const missing = await request(app).get('/api/file-office-viewer/stream')
    expect(missing.status).toBe(400)

    const forged = await request(app).get('/api/file-office-viewer/stream?token=forged')
    expect(forged.status).toBe(403)
  })
})