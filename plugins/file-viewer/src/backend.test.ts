/**
 * 后端配置 API 集成测试：/api/file-viewer/config 读/写 extensionMappings。
 *
 * 文件 I/O 路由已上收主项目（/api/files/*），本插件后端只保留配置读写。
 * 使用真实 express + supertest，mock 主应用鉴权与 ctx.storage 读写。
 */

import { describe, it, expect, beforeAll } from 'vitest'
import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import { install } from './backend'

let app: Express
/** 模拟插件存储（ctx.storage） */
const store = new Map<string, unknown>()

function mockAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next()
  } else {
    res.status(401).json({ message: '未授权' })
  }
}

beforeAll(() => {
  store.clear()
  app = express()
  app.use(express.json())

  install({
    express,
    app: app as never,
    middleware: { auth: mockAuth },
    storage: {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => { store.set(key, value) },
      delete: (key: string) => { store.delete(key) },
      has: (key: string) => store.has(key),
      keys: () => [...store.keys()],
      all: () => Object.fromEntries(store),
    } as never,
    registerService: () => {},
    manageService: () => {},
    startService: () => {},
    utils: { logger: { log: () => {} } } as never,
  } as never)
})

const auth = { Authorization: 'Bearer test-session' }

describe('配置 API（/api/file-viewer/config）', () => {
  it('GET 无鉴权 → 401', async () => {
    const res = await request(app).get('/api/file-viewer/config')
    expect(res.status).toBe(401)
  })

  it('GET 缺省返回 {}', async () => {
    store.clear()
    const res = await request(app).get('/api/file-viewer/config').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.extensionMappings).toEqual({})
  })

  it('PUT 保存后 GET 读回', async () => {
    const res = await request(app)
      .put('/api/file-viewer/config')
      .set(auth)
      .send({ extensionMappings: { ts: 'code', mp3: 'music' } })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const got = await request(app).get('/api/file-viewer/config').set(auth)
    expect(got.body.extensionMappings).toEqual({ ts: 'code', mp3: 'music' })
  })

  it('PUT 归一化扩展名（小写、去点、去空项）', async () => {
    const res = await request(app)
      .put('/api/file-viewer/config')
      .set(auth)
      .send({ extensionMappings: { '.MD': 'code', ' TXT ': 'hex', '': 'code' } })
    expect(res.status).toBe(200)
    expect(res.body.extensionMappings).toEqual({ md: 'code', txt: 'hex' })
  })

  it('PUT 非法 body（extensionMappings 非对象）→ 400', async () => {
    const res = await request(app)
      .put('/api/file-viewer/config')
      .set(auth)
      .send({ extensionMappings: ['ts'] })
    expect(res.status).toBe(400)
  })

  it('PUT 映射值非字符串 → 400', async () => {
    const res = await request(app)
      .put('/api/file-viewer/config')
      .set(auth)
      .send({ extensionMappings: { ts: 123 } })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('必须是字符串')
  })

  it('PUT 空对象允许（清空映射）', async () => {
    const res = await request(app)
      .put('/api/file-viewer/config')
      .set(auth)
      .send({ extensionMappings: {} })
    expect(res.status).toBe(200)
    const got = await request(app).get('/api/file-viewer/config').set(auth)
    expect(got.body.extensionMappings).toEqual({})
  })
})