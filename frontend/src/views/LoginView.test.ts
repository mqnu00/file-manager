import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const routerReplace = vi.fn()
let routeQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useRoute: () => ({ query: routeQuery }),
}))

const authMock = {
  login: vi.fn(),
  loginError: null as string | null,
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

import LoginView from './LoginView.vue'
import { ElMessage } from 'element-plus'

beforeEach(() => {
  vi.clearAllMocks()
  routeQuery = {}
  authMock.loginError = null
})

async function mountView() {
  const wrapper = mount(LoginView)
  await flushPromises()
  return wrapper
}

describe('LoginView.vue', () => {
  it('空 token 点击登录 → 显示"请输入令牌"，不调用 login', async () => {
    const wrapper = await mountView()
    const btn = wrapper.findAll('button').find((b) => b.text() === '登录')
    await btn!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('请输入令牌')
    expect(authMock.login).not.toHaveBeenCalled()
  })

  it('登录成功 → 提示成功并 replace 到 /', async () => {
    authMock.login.mockResolvedValue(true)
    const wrapper = await mountView()
    await wrapper.get('input').setValue('my-token')
    const btn = wrapper.findAll('button').find((b) => b.text() === '登录')
    await btn!.trigger('click')
    await flushPromises()
    expect(authMock.login).toHaveBeenCalledWith('my-token')
    expect(ElMessage.success).toHaveBeenCalledWith('登录成功')
    expect(routerReplace).toHaveBeenCalledWith('/')
  })

  it('登录成功且带 redirect 参数 → replace 到 redirect', async () => {
    routeQuery = { redirect: '/logs' }
    authMock.login.mockResolvedValue(true)
    const wrapper = await mountView()
    await wrapper.get('input').setValue('my-token')
    const btn = wrapper.findAll('button').find((b) => b.text() === '登录')
    await btn!.trigger('click')
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith('/logs')
  })

  it('登录失败 → 显示 auth.loginError', async () => {
    authMock.login.mockResolvedValue(false)
    authMock.loginError = '令牌错误（剩余 2 次尝试）'
    const wrapper = await mountView()
    await wrapper.get('input').setValue('bad-token')
    const btn = wrapper.findAll('button').find((b) => b.text() === '登录')
    await btn!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('令牌错误（剩余 2 次尝试）')
    expect(routerReplace).not.toHaveBeenCalled()
  })
})
