import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadRegistry() {
  const mod = await import('./pluginNav')
  return mod
}

beforeEach(() => {
  vi.resetModules()
  delete (window as Record<string, unknown>)['__fm_nav_actions']
})

describe('pluginNav 注册表', () => {
  it('模块加载时暴露全局注册 API（与导入实例一致）', async () => {
    const reg = await loadRegistry()
    const api = reg.getNavActionsApi()
    expect((window as Record<string, unknown>)['__fm_nav_actions']).toBe(api)
  })

  it('register 追加导航项，list 返回全部', async () => {
    const reg = await loadRegistry()
    const api = reg.getNavActionsApi()
    const action = { id: 'system-info', label: '系统信息', path: '/plugin/system-info' }
    api.register(action)
    expect(api.list().map((a) => a.id)).toEqual(['system-info'])
    expect(reg.useNavActions().actions.value.map((a) => a.path)).toEqual(['/plugin/system-info'])
  })

  it('同 id 重复注册按新定义覆盖替换（不重复）', async () => {
    const reg = await loadRegistry()
    const api = reg.getNavActionsApi()
    api.register({ id: 'a', label: '旧', path: '/old' })
    api.register({ id: 'a', label: '新', path: '/new' })
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0].path).toBe('/new')
  })

  it('subscribe 收到注册变更通知，取消订阅后不再收到', async () => {
    const reg = await loadRegistry()
    const api = reg.getNavActionsApi()
    const fn = vi.fn()
    const unsubscribe = api.subscribe(fn)
    api.register({ id: 'x', label: 'X', path: '/x' })
    expect(fn).toHaveBeenCalledTimes(1)
    unsubscribe()
    api.register({ id: 'y', label: 'Y', path: '/y' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('unregister 按 id 移除导航项并通知订阅者（插件 teardown 用）', async () => {
    const reg = await loadRegistry()
    const api = reg.getNavActionsApi()
    const fn = vi.fn()
    api.subscribe(fn)
    api.register({ id: 'system-info', label: '系统信息', path: '/plugin/system-info' })
    fn.mockClear()

    api.unregister('system-info')
    expect(api.list()).toHaveLength(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // 不存在的 id：no-op，不抛错
    expect(() => api.unregister('not-exists')).not.toThrow()
  })
})