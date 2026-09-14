import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'
import { getAppVersion, getRepoUrl, getAppInfo } from '../utils/version'

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')) as {
  version: string
  repository: { url: string }
}

let authHeader: string

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function registryResponse(distTags: Record<string, string>): Response {
  return new Response(JSON.stringify({ 'dist-tags': distTags }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('版本工具（utils/version）', () => {
  it('getAppVersion 读取 backend/package.json 的 version', () => {
    expect(getAppVersion()).toBe(pkg.version)
  })

  it('getRepoUrl 读取 repository.url 并去掉 .git 后缀', () => {
    expect(getRepoUrl()).toBe(pkg.repository.url.replace(/\.git$/, ''))
  })

  it('getAppInfo 返回版本 + 仓库地址', () => {
    expect(getAppInfo()).toEqual({
      version: pkg.version,
      repoUrl: pkg.repository.url.replace(/\.git$/, ''),
    })
  })
})

describe('系统信息 API（集成）', () => {
  it('未认证访问 /api/system/* → 401', async () => {
    const info = await request(app).get('/api/system/info')
    expect(info.status).toBe(401)

    const check = await request(app).get('/api/system/check-update')
    expect(check.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GET /api/system/info 返回当前版本与项目地址（无网络请求）', async () => {
    const res = await request(app).get('/api/system/info').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      version: pkg.version,
      repoUrl: pkg.repository.url.replace(/\.git$/, ''),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GET /api/system/check-update 有更新 → hasUpdate true + Release 链接', async () => {
    fetchMock.mockResolvedValue(registryResponse({ latest: '999.0.0' }))

    const res = await request(app).get('/api/system/check-update').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      current: pkg.version,
      latest: '999.0.0',
      hasUpdate: true,
      releaseUrl: `https://github.com/mqnu00/file-manager/releases/tag/v999.0.0`,
    })

    // 默认请求官方 registry 的 @mqn00/file-manager 元数据
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toMatch(/^https:\/\/registry\.npmjs\.org\/%40mqn00%2Ffile-manager/)
  })

  it('GET /api/system/check-update 已是最新 → hasUpdate false 且无 Release 链接', async () => {
    fetchMock.mockResolvedValue(registryResponse({ latest: pkg.version }))

    const res = await request(app).get('/api/system/check-update').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      current: pkg.version,
      latest: pkg.version,
      hasUpdate: false,
    })
    expect(res.body.releaseUrl).toBeUndefined()
  })

  it('npm registry 返回非 2xx → 502', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))

    const res = await request(app).get('/api/system/check-update').set('Authorization', authHeader)
    expect(res.status).toBe(502)
    expect(res.body.error).toContain('500')
  })

  it('网络异常 → 502；超时（TimeoutError）→ 504', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const fail = await request(app).get('/api/system/check-update').set('Authorization', authHeader)
    expect(fail.status).toBe(502)

    const timeoutError = new Error('The operation was aborted due to timeout')
    timeoutError.name = 'TimeoutError'
    fetchMock.mockRejectedValue(timeoutError)
    const timeout = await request(app).get('/api/system/check-update').set('Authorization', authHeader)
    expect(timeout.status).toBe(504)
    expect(timeout.body.error).toContain('timed out')
  })
})
