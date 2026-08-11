import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { getConfig, updateConfig, cleanLogs } from './config'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api/config', () => {
  it('getConfig 调用 GET /config 并返回 data', async () => {
    const config = { auth: { token: 't', tokenExpiryHours: 1 }, storageRoot: '/data', log: { cleanupOnStartup: true, retentionDays: 7 } }
    mockedApi.get.mockResolvedValue({ data: config })
    const res = await getConfig()
    expect(mockedApi.get).toHaveBeenCalledWith('/config')
    expect(res).toEqual(config)
  })

  it('updateConfig 调用 PUT /config 并携带 body', async () => {
    const body = { storageRoot: '/new-root', log: { retentionDays: 30 } }
    mockedApi.put.mockResolvedValue({ data: { success: true, config: {}, sessionsCleared: false } })
    const res = await updateConfig(body)
    expect(mockedApi.put).toHaveBeenCalledWith('/config', body)
    expect(res.success).toBe(true)
  })

  it('cleanLogs 调用 POST /config/clean-logs', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true, deleted: 5 } })
    const res = await cleanLogs()
    expect(mockedApi.post).toHaveBeenCalledWith('/config/clean-logs')
    expect(res.deleted).toBe(5)
  })
})
