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
  // 预置测试数据
  fs.writeFileSync(path.join(STORAGE_ROOT, 'a.txt'), 'hello world', 'utf-8')
  fs.mkdirSync(path.join(STORAGE_ROOT, 'dir', 'empty'), { recursive: true })
  fs.writeFileSync(path.join(STORAGE_ROOT, 'dir', 'b.txt'), 'nested content', 'utf-8')
})

describe('文件操作 API（集成）', () => {
  it('未认证访问 → 401（安全回归）', async () => {
    const res = await request(app).get('/api/files')
    expect(res.status).toBe(401)
  })

  it('列根目录：文件夹在前，含 a.txt 与 dir', async () => {
    const res = await request(app).get('/api/files').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    const names = res.body.files.map((f: { name: string }) => f.name)
    expect(names).toContain('a.txt')
    expect(names).toContain('dir')
    const dirIndex = names.indexOf('dir')
    const fileIndex = names.indexOf('a.txt')
    expect(dirIndex).toBeLessThan(fileIndex)
  })

  it('列子目录：含 b.txt 与 empty 文件夹', async () => {
    const res = await request(app)
      .get('/api/files')
      .query({ path: 'dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    const names = res.body.files.map((f: { name: string }) => f.name)
    expect(names).toContain('b.txt')
    expect(names).toContain('empty')
  })

  it('列不存在目录 → 400', async () => {
    const res = await request(app)
      .get('/api/files')
      .query({ path: 'no-such-dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('路径不存在')
  })

  it('路径穿越（../）→ 400', async () => {
    const res = await request(app)
      .get('/api/files')
      .query({ path: '../' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('路径穿越（URL 编码 %2e%2e）→ 400', async () => {
    const res = await request(app)
      .get('/api/files')
      .query({ path: '%2e%2e%2f' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('下载文件内容一致', async () => {
    const res = await request(app).get('/api/files/download/a.txt').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.text).toBe('hello world')
    expect(res.headers['content-disposition']).toContain('a.txt')
  })

  it('下载不存在文件 → 400', async () => {
    const res = await request(app)
      .get('/api/files/download/no-such.txt')
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('下载文件夹 → 400', async () => {
    const res = await request(app).get('/api/files/download/dir').set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('重命名成功', async () => {
    const res = await request(app)
      .put('/api/files/rename')
      .send({ path: 'a.txt', newName: 'renamed.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const list = await request(app).get('/api/files').set('Authorization', authHeader)
    const names = list.body.files.map((f: { name: string }) => f.name)
    expect(names).toContain('renamed.txt')
    expect(names).not.toContain('a.txt')
  })

  it('重命名非法名称（含 /）→ 400', async () => {
    const res = await request(app)
      .put('/api/files/rename')
      .send({ path: 'renamed.txt', newName: 'bad/name.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('移动文件（SSE 完成）', async () => {
    const res = await request(app)
      .post('/api/files/move')
      .send({ fromPath: 'renamed.txt', toPath: 'dir/moved.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.text).toContain('"type":"complete"')

    const list = await request(app)
      .get('/api/files')
      .query({ path: 'dir' })
      .set('Authorization', authHeader)
    const names = list.body.files.map((f: { name: string }) => f.name)
    expect(names).toContain('moved.txt')
  })

  it('文件夹大小计算', async () => {
    const res = await request(app)
      .get('/api/files/dirsize')
      .query({ path: 'dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.size).toBeGreaterThan(0)
  })

  it('删除文件成功', async () => {
    const res = await request(app)
      .delete('/api/files')
      .query({ path: 'dir/moved.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const list = await request(app)
      .get('/api/files')
      .query({ path: 'dir' })
      .set('Authorization', authHeader)
    expect(list.body.files.map((f: { name: string }) => f.name)).not.toContain('moved.txt')
  })

  it('删除不存在文件 → 400', async () => {
    const res = await request(app)
      .delete('/api/files')
      .query({ path: 'no-such.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('批量删除', async () => {
    fs.writeFileSync(path.join(STORAGE_ROOT, 'f1.txt'), '1', 'utf-8')
    fs.writeFileSync(path.join(STORAGE_ROOT, 'f2.txt'), '2', 'utf-8')
    const res = await request(app)
      .post('/api/files/batch-delete')
      .send({ paths: ['f1.txt', 'f2.txt'] })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(2)

    const list = await request(app).get('/api/files').set('Authorization', authHeader)
    const names = list.body.files.map((f: { name: string }) => f.name)
    expect(names).not.toContain('f1.txt')
    expect(names).not.toContain('f2.txt')
  })

  it('压缩文件夹（生成 zip 文件）', async () => {
    // zipFolder 把 zip 写到被压缩目录的父目录（dirname(folderPath)/<name>.zip）
    const zipPath = path.join(STORAGE_ROOT, 'dir.zip')
    fs.rmSync(zipPath, { force: true })

    // 注意：zipFolder 完成时只 sendSSEComplete（write）不 res.end()，连接保持打开，
    // 因此不 await 响应结束，改为轮询 zip 文件生成后 abort 连接
    const req = request(app)
      .post('/api/files/zip')
      .send({ path: 'dir' })
      .set('Authorization', authHeader)
    const settled = new Promise<void>((resolve) => {
      req.end(() => resolve())
    })

    const deadline = Date.now() + 5000
    while (!fs.existsSync(zipPath)) {
      if (Date.now() > deadline) throw new Error('zip 文件未在超时时间内生成')
      await new Promise((r) => setTimeout(r, 50))
    }
    expect(fs.statSync(zipPath).size).toBeGreaterThan(0)

    req.abort()
    await settled
  })
})

describe('创建文件 API（集成）', () => {
  it('未认证创建 → 401', async () => {
    const res = await request(app).post('/api/files').send({ name: 'x.txt' })
    expect(res.status).toBe(401)
  })

  it('创建文件成功（磁盘生成空文件）', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'newfile.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const fp = path.join(STORAGE_ROOT, 'newfile.txt')
    expect(fs.existsSync(fp)).toBe(true)
    expect(fs.statSync(fp).size).toBe(0)
  })

  it('嵌套路径创建', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: 'dir', name: 'nested.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'dir', 'nested.txt'))).toBe(true)
  })

  it('创建已存在文件 → 400', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'newfile.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('文件已存在')
  })

  it('非法名称（..）→ 400', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: '..' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('非法名称（含 /）→ 400', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'a/b.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('缺少名称 → 400', async () => {
    const res = await request(app)
      .post('/api/files')
      .send({ path: '' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })
})
