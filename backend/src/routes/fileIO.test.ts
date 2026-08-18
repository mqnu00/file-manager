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
const TEXT_CONTENT = 'Hello 中文\nsecond line\n'

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64')

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  fs.writeFileSync(path.join(STORAGE_ROOT, textFile), TEXT_CONTENT, 'utf-8')
  fs.writeFileSync(path.join(STORAGE_ROOT, binFile), Buffer.from([0x00, 0x01, 0x02, 0xff]))
  // 9MB 纯字节 → 验证整读截断到 IO_LIMIT（平台不判断文本/二进制）
  fs.writeFileSync(path.join(STORAGE_ROOT, bigFile), Buffer.alloc(9 * 1024 * 1024, 0x41))
})

describe('文件查看通用 I/O（/api/files/read|write|token|stream，纯二进制透传）', () => {
  it('GET /read 整文件读取：返回原始字节（base64）+ 真实大小', async () => {
    const res = await request(app).get(`/api/files/read?path=${textFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.offset).toBe(0)
    expect(res.body.size).toBe(Buffer.byteLength(TEXT_CONTENT))
    expect(res.body.length).toBe(res.body.size)
    expect(Buffer.from(res.body.data, 'base64').toString('utf8')).toBe(TEXT_CONTENT)
  })

  it('GET /read 二进制文件原样透传（平台不判文本/二进制）', async () => {
    const res = await request(app).get(`/api/files/read?path=${binFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.size).toBe(4)
    expect([...Buffer.from(res.body.data, 'base64')]).toEqual([0x00, 0x01, 0x02, 0xff])
  })

  it('GET /read 分页读取 offset/length', async () => {
    const res = await request(app)
      .get(`/api/files/read?path=${binFile}&offset=1&length=2`)
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.offset).toBe(1)
    expect(res.body.length).toBe(2)
    expect(res.body.size).toBe(4)
    expect([...Buffer.from(res.body.data, 'base64')]).toEqual([0x01, 0x02])
  })

  it('GET /read 越界 offset → 空页（length 0）', async () => {
    const res = await request(app)
      .get(`/api/files/read?path=${binFile}&offset=100`)
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(0)
    expect(res.body.data).toBe('')
    expect(res.body.size).toBe(4)
  })

  it('GET /read 超 8MB 文件整读：截断到上限但返回真实 size（应用自行判断"太大"）', async () => {
    const res = await request(app).get(`/api/files/read?path=${bigFile}`).set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.size).toBe(9 * 1024 * 1024)
    expect(res.body.length).toBe(8 * 1024 * 1024)
  })

  it('GET /read 缺少 path → 400', async () => {
    const res = await request(app).get('/api/files/read').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('GET /read 路径穿越 → 400', async () => {
    const res = await request(app).get('/api/files/read?path=../../etc/passwd').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('GET /read offset 非法 → 400', async () => {
    const res = await request(app)
      .get(`/api/files/read?path=${binFile}&offset=-1`)
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('GET /read length 非法（0/超限）→ 400', async () => {
    const zero = await request(app)
      .get(`/api/files/read?path=${binFile}&length=0`)
      .set('Authorization', authHeader)
    expect(zero.status).toBe(400)
    const tooBig = await request(app)
      .get(`/api/files/read?path=${binFile}&length=${8 * 1024 * 1024 + 1}`)
      .set('Authorization', authHeader)
    expect(tooBig.status).toBe(400)
  })

  it('POST /write 整文件覆盖后回读验证', async () => {
    const writeRes = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: textFile, data: b64('covered by test\n') })
    expect(writeRes.status).toBe(200)
    expect(fs.readFileSync(path.join(STORAGE_ROOT, textFile), 'utf8')).toBe('covered by test\n')
  })

  it('POST /write 定位写入生效（offset 语义）', async () => {
    const res = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: binFile, offset: 0, data: b64(Buffer.from([0xaa])) })
    expect(res.status).toBe(200)
    expect([...fs.readFileSync(path.join(STORAGE_ROOT, binFile))]).toEqual([0xaa, 0x01, 0x02, 0xff])
  })

  it('POST /write 缺少参数 → 400', async () => {
    const res = await request(app).post('/api/files/write').set('Authorization', authHeader).send({})
    expect(res.status).toBe(400)
  })

  it('POST /write 定位写入空 data → 400', async () => {
    const res = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: binFile, offset: 0, data: b64('') })
    expect(res.status).toBe(400)
  })

  it('POST /write offset 非法 → 400', async () => {
    const res = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: binFile, offset: -1, data: b64('x') })
    expect(res.status).toBe(400)
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

  it('POST /write 空内容整文件覆盖 → 清空文件', async () => {
    const res = await request(app)
      .post('/api/files/write')
      .set('Authorization', authHeader)
      .send({ path: textFile, data: b64('') })
    expect(res.status).toBe(200)
    expect(fs.statSync(path.join(STORAGE_ROOT, textFile)).size).toBe(0)
  })
})