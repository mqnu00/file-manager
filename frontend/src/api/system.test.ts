import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { getSystemInfo } from './system'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api/system', () => {
  it('getSystemInfo 调用 GET /system 并返回 data', async () => {
    const info = { cpu: { usage: 10 }, memory: { total: 1024 } }
    mockedApi.get.mockResolvedValue({ data: info })
    const res = await getSystemInfo()
    expect(mockedApi.get).toHaveBeenCalledWith('/system')
    expect(res).toEqual(info)
  })
})
