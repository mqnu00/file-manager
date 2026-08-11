import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STORAGE_KEY_SESSION } from '@/constants'

/** 捕获 axios create 返回值与拦截器回调（vi.hoisted 保证先于 mock 工厂初始化） */
const captured = vi.hoisted(() => ({
  requestInterceptors: [] as Array<(config: any) => any>,
  responseErrorHandler: undefined as ((error: any) => Promise<never>) | undefined,
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn((fn: any) => captured.requestInterceptors.push(fn)) },
        response: {
          use: vi.fn((_onFulfilled: any, onRejected: any) => {
            captured.responseErrorHandler = onRejected
          }),
        },
      },
    })),
  },
}))

// 导入触发模块初始化（注册拦截器）；vi.mock 提升后 mock 已生效
import './index'

beforeEach(() => {
  localStorage.clear()
})

describe('api/index 拦截器', () => {
  it('request 拦截器：有 session_token 时注入 Authorization 头', () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-abc')
    const config: any = { headers: {} }
    const result = captured.requestInterceptors[0](config)
    expect(result.headers.Authorization).toBe('Bearer sess-abc')
  })

  it('request 拦截器：无 token 时不注入 Authorization 头', () => {
    const config: any = { headers: {} }
    const result = captured.requestInterceptors[0](config)
    expect(result.headers.Authorization).toBeUndefined()
  })

  it('response 拦截器：401 响应清除 session_token', async () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-abc')
    const error = { response: { status: 401 } }
    await expect(captured.responseErrorHandler!(error)).rejects.toBe(error)
    expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBeNull()
  })

  it('response 拦截器：非 401 错误不清除 session_token', async () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-abc')
    const error = { response: { status: 500 } }
    await expect(captured.responseErrorHandler!(error)).rejects.toBe(error)
    expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBe('sess-abc')
  })
})
