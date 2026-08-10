import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import http from 'http'
import path from 'path'
import type { AddressInfo } from 'net'
import request from 'supertest'
import app from '../app'
import { STORAGE_ROOT } from '../../test/setup'
import { createSession } from '../middleware/auth'

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  // 预置任务测试数据
  fs.writeFileSync(path.join(STORAGE_ROOT, 'mv-src.txt'), 'move me', 'utf-8')
  fs.writeFileSync(path.join(STORAGE_ROOT, 'mv2-src.txt'), 'move me 2', 'utf-8')
  fs.writeFileSync(path.join(STORAGE_ROOT, 'zip-src.txt'), 'zip me', 'utf-8')
})

describe('任务 API（集成）', () => {
  it('未认证访问 → 401', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(401)
  })

  it('缺少源文件路径列表 → 400', async () => {
    const res = await request(app)
      .post('/api/tasks/move')
      .send({ targetPath: 'dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('缺少源文件路径列表')
  })

  it('缺少目标路径 → 400', async () => {
    const res = await request(app)
      .post('/api/tasks/move')
      .send({ sourcePaths: ['mv-src.txt'] })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('创建移动任务 → 200 返回 taskId，任务列表可查', async () => {
    const res = await request(app)
      .post('/api/tasks/move')
      .send({ sourcePaths: ['mv2-src.txt'], targetPath: 'dir' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.taskId).toBeTruthy()

    const list = await request(app).get('/api/tasks').set('Authorization', authHeader)
    expect(list.status).toBe(200)
    const task = list.body.tasks.find((t: { id: string }) => t.id === res.body.taskId)
    expect(task).toBeTruthy()
    expect(task.type).toBe('move')
  })

  it('创建压缩任务：缺少源路径 → 400；正常 → 200', async () => {
    const missing = await request(app)
      .post('/api/tasks/compress')
      .send({})
      .set('Authorization', authHeader)
    expect(missing.status).toBe(400)

    const res = await request(app)
      .post('/api/tasks/compress')
      .send({ sourcePath: 'zip-src.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.taskId).toBeTruthy()
  })

  it('任务详情：存在返回信息，不存在 → 404', async () => {
    const created = await request(app)
      .post('/api/tasks/move')
      .send({ sourcePaths: ['mv-src.txt'], targetPath: 'dir' })
      .set('Authorization', authHeader)
    const taskId = created.body.taskId

    const detail = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', authHeader)
    expect(detail.status).toBe(200)
    expect(detail.body.task.id).toBe(taskId)
    // 任务可能已在小文件上瞬间完成，不固定断言 status

    const notFound = await request(app)
      .get('/api/tasks/no-such-id')
      .set('Authorization', authHeader)
    expect(notFound.status).toBe(404)
  })

  it('取消不存在的任务 → 400', async () => {
    const res = await request(app)
      .post('/api/tasks/no-such-id/cancel')
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('SSE 订阅返回 event-stream 响应头', async () => {
    const created = await request(app)
      .post('/api/tasks/move')
      .send({ sourcePaths: ['zip-src.txt'], targetPath: 'dir' })
      .set('Authorization', authHeader)
    const taskId = created.body.taskId

    // SSE 连接不结束，supertest 无法拿到完整响应；改用原生 http 读取响应头后销毁连接
    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port
    try {
      const { status, contentType } = await new Promise<{ status: number; contentType: string }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port,
              path: `/api/tasks/${taskId}/stream`,
              headers: { Authorization: authHeader },
            },
            (res) => {
              resolve({ status: res.statusCode ?? 0, contentType: res.headers['content-type'] ?? '' })
              // 拿到响应头后立即销毁连接
              req.destroy()
              res.destroy()
            }
          )
          req.on('error', reject)
          req.end()
        }
      )
      expect(status).toBe(200)
      expect(contentType).toContain('text/event-stream')
    } finally {
      server.close()
    }
  })

  it('移动任务真实执行：文件移动到目标并删除源', async () => {
    fs.writeFileSync(path.join(STORAGE_ROOT, 'real-mv.txt'), 'content', 'utf-8')
    const created = await request(app)
      .post('/api/tasks/move')
      .send({ sourcePaths: ['real-mv.txt'], targetPath: 'dir' })
      .set('Authorization', authHeader)
    const taskId = created.body.taskId

    const deadline = Date.now() + 5000
    let status = ''
    while (Date.now() < deadline) {
      const list = await request(app).get('/api/tasks').set('Authorization', authHeader)
      const task = list.body.tasks.find((t: { id: string }) => t.id === taskId)
      if (task) {
        status = task.status
        if (status === 'completed' || status === 'failed') break
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(status).toBe('completed')
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'dir', 'real-mv.txt'))).toBe(true)
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'real-mv.txt'))).toBe(false)
  })
})
