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
})

describe('文件夹操作 API（集成）', () => {
  it('未认证创建 → 401', async () => {
    const res = await request(app).post('/api/folders').send({ name: 'x' })
    expect(res.status).toBe(401)
  })

  it('创建文件夹成功', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: '', name: 'newdir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'newdir'))).toBe(true)
  })

  it('嵌套创建', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: 'newdir', name: 'sub' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'newdir', 'sub'))).toBe(true)
  })

  it('创建已存在文件夹 → 400', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: '', name: 'newdir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('文件夹已存在')
  })

  it('非法名称（..）→ 400', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: '', name: '..' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('非法名称（含 /）→ 400', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: '', name: 'a/b' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('缺少名称 → 400', async () => {
    const res = await request(app)
      .post('/api/folders')
      .send({ path: '' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })
})
