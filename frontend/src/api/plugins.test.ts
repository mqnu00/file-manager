import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import {
  getPlugins,
  loadPlugin,
  unloadPlugin,
  searchPlugins,
  getPluginVersions,
  installPlugin,
  deletePlugin,
} from './plugins'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api/plugins', () => {
  it('getPlugins 调用 GET /plugins 并返回 data', async () => {
    const plugins = [
      { name: 'test', enabled: true, local: true, source: 'local', frontendPath: null, frontendPage: null },
    ]
    mockedApi.get.mockResolvedValue({ data: plugins })
    const res = await getPlugins()
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins')
    expect(res).toEqual(plugins)
  })

  it('loadPlugin 调用 POST /plugins/load 并携带 name', async () => {
    mockedApi.post.mockResolvedValue({ data: { name: 'test' } })
    const res = await loadPlugin('test')
    expect(mockedApi.post).toHaveBeenCalledWith('/plugins/load', { name: 'test' })
    expect(res.name).toBe('test')
  })

  it('unloadPlugin 调用 POST /plugins/:name/unload', async () => {
    mockedApi.post.mockResolvedValue({ data: undefined })
    await unloadPlugin('test')
    expect(mockedApi.post).toHaveBeenCalledWith('/plugins/test/unload')
  })

  it('searchPlugins 调用 GET /plugins/search 并携带 q/page/pageSize 参数', async () => {
    mockedApi.get.mockResolvedValue({ data: { total: 45, results: [] } })
    const res = await searchPlugins('smb', 2, 10)
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins/search', {
      params: { q: 'smb', page: 2, pageSize: 10 },
    })
    expect(res.total).toBe(45)
  })

  it('searchPlugins 默认 page=1 pageSize=20', async () => {
    mockedApi.get.mockResolvedValue({ data: { total: 0, results: [] } })
    await searchPlugins('smb')
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins/search', {
      params: { q: 'smb', page: 1, pageSize: 20 },
    })
  })

  it('getPluginVersions 调用 GET /plugins/versions 并携带 name 参数', async () => {
    mockedApi.get.mockResolvedValue({ data: { versions: ['1.0.0'], latest: '1.0.0' } })
    const res = await getPluginVersions('@mqn00/plugin-smb')
    expect(mockedApi.get).toHaveBeenCalledWith('/plugins/versions', { params: { name: '@mqn00/plugin-smb' } })
    expect(res.latest).toBe('1.0.0')
  })

  it('installPlugin 调用 POST /plugins/install 并携带 packageName/version/force', async () => {
    mockedApi.post.mockResolvedValue({ data: { name: 'smb' } })
    await installPlugin('@mqn00/plugin-smb', '1.2.0', true)
    expect(mockedApi.post).toHaveBeenCalledWith('/plugins/install', {
      packageName: '@mqn00/plugin-smb',
      version: '1.2.0',
      force: true,
    })
  })

  it('deletePlugin 调用 DELETE /plugins/:name', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined })
    await deletePlugin('smb')
    expect(mockedApi.delete).toHaveBeenCalledWith('/plugins/smb')
  })
})
