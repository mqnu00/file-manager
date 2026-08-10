import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
}))

import { useAuthStore } from './auth'
import { login as apiLogin, logout as apiLogout, checkAuth as apiCheckAuth } from '@/api/auth'
import { STORAGE_KEY_SESSION } from '@/constants'

/** mock api/auth 模块返回类型 */
const mockedLogin = vi.mocked(apiLogin)
const mockedLogout = vi.mocked(apiLogout)
const mockedCheckAuth = vi.mocked(apiCheckAuth)

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('login 成功：保存 sessionToken 并写入 localStorage', async () => {
    mockedLogin.mockResolvedValue({ success: true, sessionToken: 'sess-1', expiresIn: 3600 })
    const store = useAuthStore()
    const ok = await store.login('valid-token')
    expect(ok).toBe(true)
    expect(store.sessionToken).toBe('sess-1')
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBe('sess-1')
    expect(store.loginError).toBeNull()
  })

  it('login 失败：展示错误与剩余尝试次数', async () => {
    mockedLogin.mockRejectedValue({
      response: { data: { error: '令牌错误', remaining: 3 } },
    })
    const store = useAuthStore()
    const ok = await store.login('wrong-token')
    expect(ok).toBe(false)
    expect(store.loginError).toBe('令牌错误（剩余 3 次尝试）')
    expect(store.sessionToken).toBeNull()
  })

  it('login 失败（无 remaining）：只展示错误', async () => {
    mockedLogin.mockRejectedValue({ response: { data: { error: '服务不可用' } } })
    const store = useAuthStore()
    await store.login('x')
    expect(store.loginError).toBe('服务不可用')
  })

  it('login 失败（无响应数据）：兜底错误文案', async () => {
    mockedLogin.mockRejectedValue(new Error('network'))
    const store = useAuthStore()
    await store.login('x')
    expect(store.loginError).toBe('登录失败')
  })

  it('init：无 sessionToken 直接完成', async () => {
    const store = useAuthStore()
    await store.init()
    expect(store.initialized).toBe(true)
    expect(mockedCheckAuth).not.toHaveBeenCalled()
  })

  it('init：token 有效时保留', async () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-keep')
    mockedCheckAuth.mockResolvedValue({ valid: true })
    const store = useAuthStore()
    await store.init()
    expect(store.sessionToken).toBe('sess-keep')
    expect(store.initialized).toBe(true)
  })

  it('init：token 无效时清除', async () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-expired')
    mockedCheckAuth.mockResolvedValue({ valid: false })
    const store = useAuthStore()
    await store.init()
    expect(store.sessionToken).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBeNull()
  })

  it('init：校验请求失败时清除', async () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-error')
    mockedCheckAuth.mockRejectedValue(new Error('500'))
    const store = useAuthStore()
    await store.init()
    expect(store.sessionToken).toBeNull()
    expect(store.initialized).toBe(true)
  })

  it('clearSession 清除 token 与 localStorage', () => {
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-1')
    const store = useAuthStore()
    store.sessionToken = 'sess-1'
    store.clearSession()
    expect(store.sessionToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBeNull()
  })

  it('logout 调用后端并清空会话', async () => {
    mockedLogout.mockResolvedValue({ success: true })
    localStorage.setItem(STORAGE_KEY_SESSION, 'sess-1')
    const store = useAuthStore()
    store.sessionToken = 'sess-1'

    // jsdom 不支持 location 导航，stub 掉
    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })
    try {
      await store.logout()
      expect(mockedLogout).toHaveBeenCalled()
      expect(store.sessionToken).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY_SESSION)).toBeNull()
    } finally {
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
      })
    }
  })
})
