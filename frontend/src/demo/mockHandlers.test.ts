import { describe, it, expect, beforeEach } from 'vitest'
import { setupMockApi } from './mockHandlers'

let requestHandler: ((config: any) => any) | undefined

const mockApi = {
  interceptors: {
    request: {
      use: (fn: (config: any) => any) => {
        requestHandler = fn
      },
    },
  },
} as any

beforeEach(() => {
  requestHandler = undefined
  setupMockApi(mockApi)
})

/** 触发请求拦截器并执行其 adapter，返回 mock 响应 */
async function request(config: any): Promise<any> {
  const intercepted = requestHandler!(config)
  return intercepted.adapter()
}

describe('mockHandlers 插件接口（demo）', () => {
  it('GET /api/plugins 返回本地 demo 插件', async () => {
    const res = await request({ url: '/plugins', method: 'get', baseURL: '/api' })
    expect(res.data).toEqual([
      {
        name: 'hatsune-miku-theme',
        enabled: true,
        local: true,
        source: 'local',
        frontendPath: '/plugins/hatsune-miku-theme/frontend.js',
        frontendPage: '/plugin/hatsune-miku-theme',
        version: '0.1.0',
      },
    ])
  })

  it('卸载后 enabled=false，重新加载后恢复 true', async () => {
    await request({ url: '/plugins/hatsune-miku-theme/unload', method: 'post', baseURL: '/api' })
    const afterUnload = await request({ url: '/plugins', method: 'get', baseURL: '/api' })
    expect(afterUnload.data[0].enabled).toBe(false)

    await request({
      url: '/plugins/load',
      method: 'post',
      baseURL: '/api',
      data: { name: 'hatsune-miku-theme' },
    })
    const afterLoad = await request({ url: '/plugins', method: 'get', baseURL: '/api' })
    expect(afterLoad.data[0].enabled).toBe(true)
  })
})
