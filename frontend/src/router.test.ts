import { describe, it, expect, vi, beforeEach } from 'vitest'

/** 可控的 auth store 状态（router 守卫依赖） */
const authState = {
  initialized: false,
  isAuthenticated: false,
  init: vi.fn(async () => {
    authState.initialized = true
  }),
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

// stub 所有懒加载视图，避免加载真实组件树
vi.mock('@/views/HomeView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/LoginView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/ConfigView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/SystemInfoView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/LogsView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/views/PluginView.vue', () => ({ default: { template: '<div />' } }))

import router from './router'

beforeEach(() => {
  authState.initialized = false
  authState.isAuthenticated = false
  authState.init.mockClear()
})

describe('router 认证守卫', () => {
  it('未认证访问 requiresAuth 页面 → 重定向 /login 并带 redirect 参数', async () => {
    await router.push('/config')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/config')
  })

  it('未认证访问 /login → 允许进入', async () => {
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('已认证访问 requiresAuth 页面 → 允许进入', async () => {
    authState.isAuthenticated = true
    await router.push('/logs')
    expect(router.currentRoute.value.name).toBe('logs')
  })

  it('已认证访问 /login → 重定向首页', async () => {
    authState.isAuthenticated = true
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('未初始化时调用 auth.init()', async () => {
    authState.initialized = false
    await router.push('/login')
    expect(authState.init).toHaveBeenCalled()
  })
})
