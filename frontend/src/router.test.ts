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

  // 插件通过 ctx.router.addRoute 注册路由，自带 meta.requiresAuth 声明时同样受守卫拦截
  it('插件路由声明 requiresAuth → 未认证访问被重定向到 /login 并带 redirect', async () => {
    const removeRoute = router.addRoute({
      path: '/plugin/requires-auth-test',
      component: { template: '<div />' },
      meta: { requiresAuth: true },
    })
    try {
      await router.push('/plugin/requires-auth-test')
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/plugin/requires-auth-test')
    } finally {
      removeRoute()
    }
  })

  it('插件路由声明 requiresAuth 且已认证 → 允许进入', async () => {
    const removeRoute = router.addRoute({
      path: '/plugin/requires-auth-test',
      component: { template: '<div />' },
      meta: { requiresAuth: true },
    })
    try {
      authState.isAuthenticated = true
      await router.push('/plugin/requires-auth-test')
      expect(router.currentRoute.value.path).toBe('/plugin/requires-auth-test')
    } finally {
      removeRoute()
    }
  })

  it('插件路由未声明 requiresAuth → 未认证直接放行', async () => {
    const removeRoute = router.addRoute({
      path: '/plugin/public-test',
      component: { template: '<div />' },
    })
    try {
      await router.push('/plugin/public-test')
      expect(router.currentRoute.value.path).toBe('/plugin/public-test')
      expect(router.currentRoute.value.name).not.toBe('login')
    } finally {
      removeRoute()
    }
  })
})
