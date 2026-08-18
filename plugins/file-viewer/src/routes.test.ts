/**
 * 路由层集成测试：验证 install() 挂载后各路由真实可达。
 *
 * 覆盖此前遗漏的挂载缺陷：auth 子路由未挂到 router 导致
 * /read /write /bytes /write-range /token 全部 404 的问题。
 * 使用真实 express + supertest，并 mock 主应用鉴权与路径安全校验。
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
let textFile: string
let binFile: string

/** 模拟主应用 ctx.middleware.auth：Bearer 头通过，否则 401 */
function mockAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next()
  } else {
    res.status(401).json({ message: '未授权' })
  }
}

/** 模拟主应用 ctx.utils.path.safe：拒绝穿越，解析到临时根目录 */
function mockSafe(p: string): string {
  if (p.includes('..')) throw new Error('非法路径')
  return path.join(tmpRoot, p)
}

beforeAll(() => {
  app = express()
  app.use(express.json())
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-routes-'))
  textFile = path.join(tmpRoot, 'hello.txt')
  binFile = path.join(tmpRoot, 'data.bin')
  fs.writeFileSync(textFile, 'Hello 中文\nsecond line\n')
  fs.writeFileSync(binFile, Buffer.from([0x00, 0x01, 0x02, 0xff]))

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
const P = 'hello.txt'

describe('路由挂载（回归：router.use(auth) 缺失导致 404）', () => {
  it('GET /read 无鉴权 → 401', async () => {
    const res = await request(app).get(`/api/file-viewer/read?path=${P}`)
    expect(res.status).toBe(401)
  })

  it('GET /read 带鉴权 → 200 文本内容', async () => {
    const res = await request(app).get(`/api/file-viewer/read?path=${P}`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.isText).toBe(true)
    expect(res.body.content).toContain('中文')
  })

  it('GET /read 二进制探测 → isText:false reason:binary', async () => {
    const res = await request(app).get('/api/file-viewer/read?path=data.bin').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.isText).toBe(false)
    expect(res.body.reason).toBe('binary')
  })

  it('GET /read 路径穿越 → 400', async () => {
    const res = await request(app).get('/api/file-viewer/read?path=../../etc/passwd').set(auth)
    expect(res.status).toBe(400)
  })

  it('POST /write 保存后重读验证', async () => {
    const res = await request(app)
      .post('/api/file-viewer/write')
      .set(auth)
      .send({ path: P, content: 'covered by test\n' })
    expect(res.status).toBe(200)
    expect(fs.readFileSync(textFile, 'utf8')).toBe('covered by test\n')
  })

  it('GET /bytes 返回 base64 字节', async () => {
    const res = await request(app).get('/api/file-viewer/bytes?path=data.bin&offset=1&length=2').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.size).toBe(4)
    const bytes = Buffer.from(res.body.data, 'base64')
    expect([...bytes]).toEqual([0x01, 0x02])
  })

  it('POST /write-range 定位写入生效', async () => {
    const before = [...fs.readFileSync(binFile)]
    before[0] = 0xaa
    const res = await request(app)
      .post('/api/file-viewer/write-range')
      .set(auth)
      .send({ path: 'data.bin', offset: 0, data: Buffer.from([0xaa]).toString('base64') })
    expect(res.status).toBe(200)
    expect([...fs.readFileSync(binFile)]).toEqual([0xaa, 0x01, 0x02, 0xff])
  })

  it('POST /token 签发成功', async () => {
    const res = await request(app).post('/api/file-viewer/token').set(auth).send({ path: P })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(20)
  })

  it('GET /stream 伪造令牌 → 403', async () => {
    const res = await request(app).get('/api/file-viewer/stream?token=forged')
    expect(res.status).toBe(403)
  })

  it('GET /stream 全量输出 + Range 206', async () => {
    const tokenRes = await request(app).post('/api/file-viewer/token').set(auth).send({ path: P })
    const token = tokenRes.body.token

    const full = await request(app).get(`/api/file-viewer/stream?token=${token}`)
    expect(full.status).toBe(200)
    expect(full.headers['accept-ranges']).toBe('bytes')
    expect(full.text).toContain('covered by test')

    const ranged = await request(app)
      .get(`/api/file-viewer/stream?token=${token}`)
      .set('Range', 'bytes=0-6')
    expect(ranged.status).toBe(206)
    expect(ranged.headers['content-range']).toMatch(/^bytes 0-6\/\d+$/)
  })
})