import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import { STORAGE_ROOT } from '../../test/setup'
import { createSession } from '../middleware/auth'

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  fs.writeFileSync(path.join(STORAGE_ROOT, 'extra.txt'), 'extra', 'utf-8')
})

describe('文件 API 错误分支（集成）', () => {
  it('zip 缺少文件夹路径 → 400', async () => {
    const res = await request(app)
      .post('/api/files/zip')
      .send({})
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('zip/cancel 缺少路径 → 400', async () => {
    const res = await request(app)
      .post('/api/files/zip/cancel')
      .send({})
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('zip/cancel 无活动压缩任务 → 404', async () => {
    const res = await request(app)
      .post('/api/files/zip/cancel')
      .send({ path: 'no-active-zip-dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  it('move 缺少必要参数 → 400', async () => {
    const res1 = await request(app)
      .post('/api/files/move')
      .send({ toPath: 'dir' })
      .set('Authorization', authHeader)
    expect(res1.status).toBe(400)

    const res2 = await request(app)
      .post('/api/files/move')
      .send({ fromPath: 'extra.txt' })
      .set('Authorization', authHeader)
    expect(res2.status).toBe(400)
  })

  it('dirsize 缺少路径 → 400', async () => {
    const res = await request(app).get('/api/files/dirsize').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('dirsize 路径不存在 → 400', async () => {
    const res = await request(app)
      .get('/api/files/dirsize')
      .query({ path: 'no-such-dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('rename 缺少必要参数 → 400', async () => {
    const res1 = await request(app)
      .put('/api/files/rename')
      .send({ newName: 'x.txt' })
      .set('Authorization', authHeader)
    expect(res1.status).toBe(400)

    const res2 = await request(app)
      .put('/api/files/rename')
      .send({ path: 'extra.txt' })
      .set('Authorization', authHeader)
    expect(res2.status).toBe(400)
  })

  it('batch-delete 缺少路径列表 → 400', async () => {
    const res = await request(app)
      .post('/api/files/batch-delete')
      .send({ paths: [] })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('delete 缺少路径 → 400', async () => {
    const res = await request(app).delete('/api/files').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })
})
