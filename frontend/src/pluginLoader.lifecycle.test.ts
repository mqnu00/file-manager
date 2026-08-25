/**
 * 前端插件生命周期契约测试（独立于 pluginLoader.test.ts：
 * 本文件以带 router/composables 的 ctx mock 验证平台收集与清理逻辑）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

const { removeRoute, registerTheme, unregisterTheme, registerFileOpen, unregisterFileOpen } =
  vi.hoisted(() => {
    const unregisterFileOpen = vi.fn()
    return {
      removeRoute: vi.fn(),
      registerTheme: vi.fn(),
      unregisterTheme: vi.fn(),
      // register 返回的注销函数引用同作用域的 unregister 间谍，供平台收集调用
      registerFileOpen: vi.fn(() => () => unregisterFileOpen()),
      unregisterFileOpen,
    }
  })

vi.mock('@/context', () => ({
  ctx: {
    tag: 'mock-ctx',
    router: {
      addRoute: (route: unknown) => {
        globalThis.__addedRoutes = globalThis.__addedRoutes || []
        globalThis.__addedRoutes.push(route)
        return removeRoute
      },
    },
    composables: {
      useTheme: () => ({
        registerTheme,
        unregisterTheme,
      }),
    },
    platform: {
      fileOpen: {
        register: registerFileOpen,
      },
    },
  },
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ unregisterTheme }),
  registerTheme,
  unregisterTheme,
}))

import { loadPluginFrontend, unloadPluginFrontend } from './pluginLoader'

const FIXTURE = path.resolve(__dirname, '../test/fixtures')

function calls(): string[] {
  return (globalThis as any).__pluginCalls ?? []
}
function tears(): string[] {
  return (globalThis as any).__pluginTears ?? []
}
function addedRoutes(): unknown[] {
  return (globalThis as any).__addedRoutes ?? []
}

function resetGlobals() {
  delete (globalThis as any).__pluginCalls
  delete (globalThis as any).__pluginTears
  delete (globalThis as any).__addedRoutes
}

beforeEach(() => {
  resetGlobals()
  removeRoute.mockClear()
  registerTheme.mockClear()
  unregisterTheme.mockClear()
  registerFileOpen.mockClear()
  unregisterFileOpen.mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('前端插件 teardown 生命周期契约', () => {
  it('install 返回 teardown → unload 时被调用；重复 unload 幂等', async () => {
    const entry = path.join(FIXTURE, 'plugin-teardown.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    expect(calls()).toEqual(['install-with-teardown'])

    await unloadPluginFrontend('demo')
    expect(tears()).toEqual(['teardown'])

    // 已卸载：再次 unload 为 no-op
    await unloadPluginFrontend('demo')
    expect(tears()).toEqual(['teardown'])
  })

  it('未返回 teardown 的插件卸载时不报错（仅清理平台收集项）', async () => {
    const entry = path.join(FIXTURE, 'plugin-install-export.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    await expect(unloadPluginFrontend('demo')).resolves.toBeUndefined()
  })

  it('addRoute 注册的路由在卸载时被逐个移除（平台收集）', async () => {
    const entry = path.join(FIXTURE, 'plugin-route-theme.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    expect(addedRoutes()).toHaveLength(1)
    expect(removeRoute).not.toHaveBeenCalled()

    await unloadPluginFrontend('demo')
    expect(removeRoute).toHaveBeenCalledTimes(1)
  })

  it('registerTheme 注册的主题在卸载时被反注册（经平台 useTheme）', async () => {
    const entry = path.join(FIXTURE, 'plugin-route-theme.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    expect(registerTheme).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'midnight', className: 'midnight' })
    )

    await unloadPluginFrontend('demo')
    expect(unregisterTheme).toHaveBeenCalledWith('midnight')
  })

  it('platform.fileOpen 注册的 handler 在卸载时被注销（平台收集兜底，插件无需自管理）', async () => {
    const entry = path.join(FIXTURE, 'plugin-file-open.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    expect(registerFileOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'demo-viewer' }))
    expect(unregisterFileOpen).not.toHaveBeenCalled()

    await unloadPluginFrontend('demo')
    expect(unregisterFileOpen).toHaveBeenCalledTimes(1)
  })

  it('teardown 抛错不阻断卸载（路由/主题已先行清理，unload 不抛出）', async () => {
    const entry = path.join(FIXTURE, 'plugin-teardown-throws.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    await expect(unloadPluginFrontend('demo')).resolves.toBeUndefined()
    expect(tears()).toEqual(['teardown-throws'])
    expect(console.error).toHaveBeenCalledWith(
      '[Plugin] demo teardown 执行失败:',
      expect.any(Error)
    )
  })

  it('同一插件重复加载 = 先卸载旧实例（清理生效）再重新 install', async () => {
    const entry = path.join(FIXTURE, 'plugin-teardown.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)

    expect(calls()).toEqual(['install-with-teardown', 'install-with-teardown'])
    // 第二次加载前已调用第一次的 teardown
    expect(tears()).toEqual(['teardown'])
  })

  it('install 中途抛错 → 已收集的路由被回滚，插件不残留', async () => {
    const entry = path.join(FIXTURE, 'plugin-throws-after-route.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry }, false)
    expect(calls()).toEqual(['throws-after-route'])
    expect(console.error).toHaveBeenCalledWith('[Plugin] demo frontend failed:', expect.any(Error))
    // 回滚：install 注册的路由移除函数已被调用
    expect(removeRoute).toHaveBeenCalledTimes(1)

    // 回滚后插件不在已加载列表：unload 为 no-op，不再重复清理
    await unloadPluginFrontend('demo')
    expect(removeRoute).toHaveBeenCalledTimes(1)
  })
})
