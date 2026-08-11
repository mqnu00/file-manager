import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { login, logout, checkAuth } from './auth'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api/auth', () => {
  it('login 调用 POST /auth/login 并返回 data', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true, sessionToken: 's1', expiresIn: 3600 } })
    const res = await login('my-token')
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', { token: 'my-token' })
    expect(res.sessionToken).toBe('s1')
  })

  it('logout 调用 POST /auth/logout', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } })
    await logout()
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/logout')
  })

  it('checkAuth 调用 GET /auth/check', async () => {
    mockedApi.get.mockResolvedValue({ data: { valid: true } })
    const res = await checkAuth()
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/check')
    expect(res.valid).toBe(true)
  })
})
