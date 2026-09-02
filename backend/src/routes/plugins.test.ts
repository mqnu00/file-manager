import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'

/** 控制 mock spawn 的退出码并记录 npm 调用参数 */
const h = vi.hoisted(() => ({
  npmExitCode: 0,
  closeDelay: 0,
  stdoutLine: '',
  killedSignals: [] as string[],
  spawnArgs: [] as (string[] | string)[],
}))

// mock child_process：routes/plugins 的 runNpm/runNpmTracked 使用 spawn；system.ts 使用 execSync（提供空实现）
vi.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { EventEmitter } = require('node:events')
  return {
    spawn: vi.fn((cmd: string, args: string[]) => {
      h.spawnArgs.push([cmd, ...args])
      const child = new EventEmitter()
      ;(child as { stdout?: EventEmitter }).stdout = new EventEmitter()
      ;(child as { stderr?: EventEmitter }).stderr = new EventEmitter()
      ;(child as { kill?: (sig: string) => boolean }).kill = vi.fn((sig: string) => {
        h.killedSignals.push(sig)
        setTimeout(() => child.emit('close', null), 10)
        return true
      })
      setTimeout(() => {
        if (h.stdoutLine) {
          ;(child as { stdout: EventEmitter }).stdout.emit('data', Buffer.from(h.stdoutLine))
        }
      }, 10)
      setTimeout(() => {
        h.spawnArgs.push(['>>close', cmd, ...args])
        child.emit('close', h.npmExitCode)
      }, h.closeDelay)
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
  h.closeDelay = 0
  h.stdoutLine = ''
  h.killedSignals = []
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

  it('POST /install：npm 成功但插件未解析到 → 500，含自愈重装与默认参数', async () => {
    h.npmExitCode = 0
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-ghost' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(500)
    expect(res.body.error).toContain('installed but not found')
    expect(res.body.taskId).toBeDefined()
    // npm install <pkg> --prefix <prefix> --save-exact --legacy-peer-deps
    expect(h.spawnArgs[0][0]).toBe('npm')
    expect(h.spawnArgs[0][1]).toBe('install')
    expect(h.spawnArgs[0][2]).toBe('file-manager-plugin-ghost')
    expect(h.spawnArgs[0]).toContain('--save-exact')
    // 默认不自动安装宿主 peer（--legacy-peer-deps）
    expect(h.spawnArgs[0]).toContain('--legacy-peer-deps')
    // 自愈：不可解析时同参数重装一次
    const installCalls = h.spawnArgs.filter(
      (s) => Array.isArray(s) && s[0] === 'npm' && s[1] === 'install'
    ) as string[][]
    expect(installCalls.length).toBe(2)
    expect(installCalls[1]).toEqual(installCalls[0])
  })

  it('POST /install：非法 taskId → 400', async () => {
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-ghost', taskId: 'bad id!' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(400)
  })

  it('POST /install：force=true 追加 --force（默认仍有 --legacy-peer-deps）', async () => {
    h.npmExitCode = 1
    const res = await request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-ghost', force: true })
      .set('Authorization', authHeader)
    expect(res.status).toBe(500)
    const args = h.spawnArgs[0] as string[]
    expect(args).toContain('--legacy-peer-deps')
    expect(args).toContain('--force')
  })

  it('POST /install：并发安装互斥串行，第二个 npm 必须等第一个 close 后启动', async () => {
    h.npmExitCode = 0
    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/plugins/install')
        .send({ packageName: 'file-manager-plugin-batch-a' })
        .set('Authorization', authHeader),
      request(app)
        .post('/api/plugins/install')
        .send({ packageName: 'file-manager-plugin-batch-b' })
        .set('Authorization', authHeader),
    ])
    expect(r1.status).toBe(500)
    expect(r2.status).toBe(500)
    const seq = h.spawnArgs
    const firstA = seq.findIndex(
      (s) => Array.isArray(s) && s[0] === 'npm' && s[2] === 'file-manager-plugin-batch-a'
    )
    const firstB = seq.findIndex(
      (s) => Array.isArray(s) && s[0] === 'npm' && s[2] === 'file-manager-plugin-batch-b'
    )
    expect(firstA).toBeGreaterThanOrEqual(0)
    expect(firstB).toBeGreaterThanOrEqual(0)
    // 两个安装的首次 spawn 之间必须存在 >>close 标记（串行化生效）
    const between = seq.slice(Math.min(firstA, firstB), Math.max(firstA, firstB))
    expect(between.some((s) => Array.isArray(s) && s[0] === '>>close')).toBe(true)
  })

  it('安装任务：日志增量 / 状态查询 / 手动终止', async () => {
    h.npmExitCode = 0
    h.closeDelay = 100
    h.stdoutLine = 'npm notice test log line\n'
    const installReq = request(app)
      .post('/api/plugins/install')
      .send({ packageName: 'file-manager-plugin-tasked', taskId: 'task-test-00000001' })
      .set('Authorization', authHeader)
    // 立即挂 then 触发请求发出（不 await，保持"请求挂起中"）
    const installPending = installReq.then((res) => res)

    // 任务应已注册且 running（请求仍在挂起）
    await new Promise((r) => setTimeout(r, 30))
    const tasksRes = await request(app)
      .get('/api/plugins/install-tasks')
      .set('Authorization', authHeader)
    expect(tasksRes.status).toBe(200)
    const running = tasksRes.body.find((t: { id: string }) => t.id === 'task-test-00000001')
    expect(running).toBeTruthy()
    expect(running.status).toBe('running')
    expect(running.packageName).toBe('file-manager-plugin-tasked')

    // 日志增量拉取（超时未发生，但任务日志包含 mock 输出行）
    const logRes = await request(app)
      .get('/api/plugins/install-log/task-test-00000001')
      .set('Authorization', authHeader)
    expect(logRes.status).toBe(200)
    expect(logRes.body.status).toBe('running')
    expect(logRes.body.lines.length).toBeGreaterThan(0)

    // 手动终止 → kill(SIGTERM) → 任务 terminated → 安装请求以"用户终止"失败
    const termRes = await request(app)
      .post('/api/plugins/install-log/task-test-00000001/terminate')
      .set('Authorization', authHeader)
    expect(termRes.status).toBe(200)
    expect(h.killedSignals).toContain('SIGTERM')

    const installRes = await installPending
    expect(installRes.status).toBe(500)
    expect(installRes.body.error).toContain('terminated by user')

    const finalLog = await request(app)
      .get('/api/plugins/install-log/task-test-00000001')
      .set('Authorization', authHeader)
    expect(finalLog.body.status).toBe('terminated')

    // 重复终止 → 409（已不在运行）
    const termAgain = await request(app)
      .post('/api/plugins/install-log/task-test-00000001/terminate')
      .set('Authorization', authHeader)
    expect(termAgain.status).toBe(409)

    // 未知任务 → 404
    const notFound = await request(app)
      .get('/api/plugins/install-log/no-such-task-999')
      .set('Authorization', authHeader)
    expect(notFound.status).toBe(404)
  })

  it('DELETE /:name：本地开发插件 → 403', async () => {
    const res = await request(app).delete('/api/plugins/test').set('Authorization', authHeader)
    expect(res.status).toBe(403)
  })

  it('DELETE /:name：不存在的插件 → 404', async () => {
    const res = await request(app)
      .delete('/api/plugins/no-such-plugin-xyz')
      .set('Authorization', authHeader)
    expect(res.status).toBe(404)
  })
})
