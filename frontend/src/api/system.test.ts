import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { getSystemInfo, checkUpdate } from './system'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api/system', () => {
  it('getSystemInfo 调用 GET /system/info 并返回 data', async () => {
    const info = { version: '3.0.2', repoUrl: 'https://github.com/mqnu00/file-manager' }
    mockedApi.get.mockResolvedValue({ data: info })
    const res = await getSystemInfo()
    expect(mockedApi.get).toHaveBeenCalledWith('/system/info')
    expect(res).toEqual(info)
  })

  it('checkUpdate 调用 GET /system/check-update 并返回 data', async () => {
    const result = {
      current: '3.0.2',
      latest: '3.1.0',
      hasUpdate: true,
      releaseUrl: 'https://github.com/mqnu00/file-manager/releases/tag/v3.1.0',
    }
    mockedApi.get.mockResolvedValue({ data: result })
    const res = await checkUpdate()
    expect(mockedApi.get).toHaveBeenCalledWith('/system/check-update')
    expect(res).toEqual(result)
  })
})
