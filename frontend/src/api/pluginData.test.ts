import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { createPluginDataApi } from './pluginData'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createPluginDataApi（HTTP 模式）', () => {
  it('get 调用 GET /plugins/<name>/data/<key>', async () => {
    mockedApi.get.mockResolvedValue({ data: { a: 1 } })
    const v = await createPluginDataApi('foo').get('k')
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins/foo/data/k')
    expect(v).toEqual({ a: 1 })
  })

  it('get 遇 404 → 返回 undefined（不抛出）', async () => {
    mockedApi.get.mockRejectedValue({ response: { status: 404 } })
    const v = await createPluginDataApi('foo').get('k')
    expect(v).toBeUndefined()
  })

  it('set 调用 PUT /plugins/<name>/data/<key>', async () => {
    mockedApi.put.mockResolvedValue({ data: {} })
    await createPluginDataApi('foo').set('k', { x: 1 })
    expect(mockedApi.put).toHaveBeenCalledWith('/plugins/foo/data/k', { x: 1 })
  })

  it('remove 调用 DELETE /plugins/<name>/data/<key>', async () => {
    mockedApi.delete.mockResolvedValue({ data: {} })
    await createPluginDataApi('foo').remove('k')
    expect(mockedApi.delete).toHaveBeenCalledWith('/plugins/foo/data/k')
  })

  it('all 调用 GET /plugins/<name>/data', async () => {
    mockedApi.get.mockResolvedValue({ data: { a: 1 } })
    const r = await createPluginDataApi('foo').all()
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins/foo/data')
    expect(r).toEqual({ a: 1 })
  })
})
