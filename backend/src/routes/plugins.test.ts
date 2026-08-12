import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'

/** 控制 mock spawn 的退出码并记录 npm 调用参数 */
const h = vi.hoisted(() => ({
  npmExitCode: 0,
  spawnArgs: [] as string[][],
}))

// mock child_process：routes/plugins 的 runNpm 使用 spawn；system.ts 使用 execSync（提供空实现）
vi.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EventEmitter } = require('node:events')
  return {
    spawn: vi.fn((cmd: string, args: string[]) => {
      h.spawnArgs.push([cmd, ...args])
      const child = new EventEmitter()
      ;(child as { stdout?: EventEmitter }).stdout = new EventEmitter()
      ;(child as { stderr?: EventEmitter }).stderr = new EventEmitter()
      setTimeout(() => child.emit('close', h.npmExitCode), 0)
      return child
    }),
    execSync: vi.fn(),
  }
})

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  h.npmExitCode = 0
  h.spawnArgs = []
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('插件 API（集成）', () => {
  it('GET /api/plugins/ 无插件配置 → 空列表（无需认证）', async () => {
    const res = await request(app).get('/api/plugins')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /load 缺少 name → 400', async () => {
    const res = await request(app)
      .post('/api/plugins/load')
      .send({})
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /load 不存在的插件 → 404', async () => {
    const res = await request(app)
      .post('/api/plugins/load')
      .send({ name: 'no-such-plugin-xyz' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  it('POST /:name/unload 未加载插件 → 404', async () => {
    const res = await request(app)
      .post('/api/plugins/no-such-plugin-xyz/unload')
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  it('GET /search：非法 query 正常返回；mock registry 结果映射', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        objects: [
          {
            package: {
              name: 'file-manager-plugin-smb',
              version: '1.2.0',
              description: 'SMB share',
              publisher: { username: 'mqn00' },
              date: '2026-01-01T00:00:00Z',
              links: { npm: 'https://www.npmjs.com/package/file-manager-plugin-smb' },
            },
          },
        ],
      }),
    })
    const res = await request(app)
      .get('/api/plugins/search')
      .query({ q: 'smb' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.results[0]).toMatchObject({
      name: 'file-manager-plugin-smb',
      version: '1.2.0',
      publisher: 'mqn00',
    })
    // 请求携带 keywords:file-manager-plugin 查询，默认 size=20 & from=0
    const searchUrl = fetchMock.mock.calls[0][0] as string
    expect(searchUrl).toContain('keywords:file-manager-plugin')
    expect(searchUrl).toContain('size=20')
    expect(searchUrl).toContain('from=0')
  })

  it('GET /search：page/pageSize 参数映射为 size/from 偏移并透传 total', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 45,
        objects: [],
      }),
    })
    const res = await request(app)
      .get('/api/plugins/search')
      .query({ q: 'smb', page: '2', pageSize: '10' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(45)
    expect(res.body.results).toEqual([])
    const searchUrl = fetchMock.mock.calls[0][0] as string
    expect(searchUrl).toContain('size=10')
    expect(searchUrl).toContain('from=10')
  })

  it('GET /search：pageSize 超上限被 clamp 到 100，非法 page 回落默认', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: 0, objects: [] }),
    })
    const res = await request(app)
      .get('/api/plugins/search')
      .query({ q: 'smb', page: '0', pageSize: '9999' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    const searchUrl = fetchMock.mock.calls[0][0] as string
    expect(searchUrl).toContain('size=100')
    expect(searchUrl).toContain('from=0')
  })

  it('GET /search：registry 非 2xx → 502', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const res = await request(app).get('/api/plugins/search').set('Authorization', authHeader)
    expect(res.status).toBe(502)
  })

  it('GET /search：网络异常 → 502', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await request(app).get('/api/plugins/search').set('Authorization', authHeader)
    expect(res.status).toBe(502)
  })

  it('GET /versions：非法包名 → 400', async () => {
    const res = await request(app)
      .get('/api/plugins/versions')
      .query({ name: 'bad name!' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('GET /versions：mock 版本列表按 semver 降序返回 + latest', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        versions: { '1.0.0': {}, '1.0.1': {}, '1.1.0': {}, '2.0.0-beta.1': {} },
        'dist-tags': { latest: '1.1.0' },
      }),
    })
    const res = await request(app)
      .get('/api/plugins/versions')
      .query({ name: 'file-manager-plugin-demo' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.versions).toEqual(['2.0.0-beta.1', '1.1.0', '1.0.1', '1.0.0'])
    expect(res.body.latest).toBe('1.1.0')
  })

  it('GET /versions：registry 404 → 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })
    const res = await request(app)
      .get('/api/plugins/versions')
      .query({ name: 'file-manager-plugin-ghost' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })

  it('POST /install：非法包名 → 400', async () => {
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: '../evil' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /install：非法版本格式 → 400', async () => {
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-x', version: 'v1.0' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /install：npm 安装失败 → 500（透传 npm 错误）', async () => {
    h.npmExitCode = 1
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-fail' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(500)
    expect(res.body.error).toContain('npm exited with code 1')
  })

  it('POST /install：npm 成功但插件未解析到 → 500，npm 参数正确', async () => {
    h.npmExitCode = 0
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-ghost' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(500)
    expect(res.body.error).toContain('installed but not found')
    // npm install <pkg> --prefix <prefix> --save-exact
    expect(h.spawnArgs[0][0]).toBe('npm')
    expect(h.spawnArgs[0][1]).toBe('install')
    expect(h.spawnArgs[0][2]).toBe('file-manager-plugin-ghost')
    expect(h.spawnArgs[0]).toContain('--save-exact')
  })

  it('DELETE /:name：本地开发插件 → 403', async () => {
    const res = await request(app)
      .delete('/api/plugins/test')
      .set('Authorization', authHeader)
    expect(res.status).toBe(403)
  })

  it('DELETE /:name：不存在的插件 → 404', async () => {
    const res = await request(app)
      .delete('/api/plugins/no-such-plugin-xyz')
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })
})
