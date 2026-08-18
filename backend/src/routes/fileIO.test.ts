import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import { STORAGE_ROOT } from '../../test/setup'
import { createSession } from '../middleware/auth'

let authHeader: string
const textFile = 'viewer-hello.txt'
const binFile = 'viewer-data.bin'
const bigFile = 'viewer-big.bin'

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  fs.writeFileSync(path.join(STORAGE_ROOT, textFile), 'Hello 中文\nsecond line\n', 'utf-8')
  fs.writeFileSync(path.join(STORAGE_ROOT, binFile), Buffer.from([0x00, 0x01, 0x02, 0xff]))
  // 9MB 纯文本（无 NUL）→ 触发 too-large 分支
  fs.writeFileSync(path.join(STORAGE_ROOT, bigFile), Buffer.alloc(9 * 1024 * 1024, 0x41))
})

describe('文件查看通用 I/O（/api/files/read|write|bytes|write-range|token|stream）', () => {
  it('GET /read 文本读取', async () => {
    const res = await request(app).get(`/api/files/read?path=${textFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.isText).toBe(true)
    expect(res.body.content).toContain('中文')
    expect(res.body.name).toBe(textFile)
  })

  it('GET /read 二进制探测 → isText:false reason:binary', async () => {
    const res = await request(app).get(`/api/files/read?path=${binFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.isText).toBe(false)
    expect(res.body.reason).toBe('binary')
  })

  it('GET /read 超限 → reason:too-large', async () => {
    const res = await request(app).get(`/api/files/read?path=${bigFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.isText).toBe(false)
    expect(res.body.reason).toBe('too-large')
  })

  it('GET /read 缺少 path → 400', async () => {
    const res = await request(app).get('/api/files/read').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('GET /read 路径穿越 → 400', async () => {
    const res = await request(app).get('/api/files/read?path=../../etc/passwd').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /write 保存后回读验证', async () => {
    const writeRes = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: textFile, content: 'covered by test\n' })
    expect(writeRes.status).toBe(200)
    expect(fs.readFileSync(path.join(STORAGE_ROOT, textFile), 'utf8')).toBe('covered by test\n')
  })

  it('POST /write 缺少参数 → 400', async () => {
    const res = await request(app).post('/api/files/write').set('Authorization', authHeader).send({})
    expect(res.status).toBe(400)
  })

  it('GET /bytes 分页读取', async () => {
    const res = await request(app)
      .get(`/api/files/bytes?path=${binFile}&offset=1&length=2`)
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.size).toBe(4)
    const bytes = Buffer.from(res.body.data, 'base64')
    expect([...bytes]).toEqual([0x01, 0x02])
  })

  it('GET /bytes 非法参数 → 400', async () => {
    const res = await request(app)
      .get(`/api/files/bytes?path=${binFile}&offset=-1&length=2`)
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /write-range 定位写入生效', async () => {
    const res = await request(app)
      .post('/api/files/write-range')
      .set('Authorization', authHeader)
      .send({ path: binFile, offset: 0, data: Buffer.from([0xaa]).toString('base64') })
    expect(res.status).toBe(200)
    expect([...fs.readFileSync(path.join(STORAGE_ROOT, binFile))]).toEqual([0xaa, 0x01, 0x02, 0xff])
  })

  it('POST /token + GET /stream 全量 200', async () => {
    const tokenRes = await request(app)
      .post('/api/files/token')
      .set('Authorization', authHeader)
      .send({ path: textFile })
    expect(tokenRes.status).toBe(200)
    const token = tokenRes.body.token
    expect(typeof token).toBe('string')

    const full = await request(app).get(`/api/files/stream?token=${token}`)
    expect(full.status).toBe(200)
    expect(full.headers['accept-ranges']).toBe('bytes')
    expect(full.text).toContain('covered by test')
  })

  it('GET /stream Range → 206', async () => {
    const tokenRes = await request(app)
      .post('/api/files/token')
      .set('Authorization', authHeader)
      .send({ path: textFile })
    const token = tokenRes.body.token

    const ranged = await request(app)
      .get(`/api/files/stream?token=${token}`)
      .set('Range', 'bytes=0-6')
    expect(ranged.status).toBe(206)
    expect(ranged.headers['content-range']).toMatch(/^bytes 0-6\/\d+$/)
  })

  it('GET /stream 伪造令牌 → 403', async () => {
    const res = await request(app).get('/api/files/stream?token=forged')
    expect(res.status).toBe(403)
  })

  it('GET /stream 缺少 token → 400', async () => {
    const res = await request(app).get('/api/files/stream')
    expect(res.status).toBe(400)
  })
})