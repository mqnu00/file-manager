import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadRegistry() {
  const mod = await import('./pluginActions')
  return mod
}

beforeEach(() => {
  vi.resetModules()
  delete (window as Record<string, unknown>)['__fm_bulk_actions']
})

describe('pluginActions 注册表', () => {
  it('模块加载时暴露全局注册 API（与导入实例一致）', async () => {
    const reg = await loadRegistry()
    const api = reg.getBulkActionsApi()
    expect((window as Record<string, unknown>)['__fm_bulk_actions']).toBe(api)
  })

  it('register 追加操作，list 返回全部', async () => {
    const reg = await loadRegistry()
    const api = reg.getBulkActionsApi()
    const action = {
      id: 'compress',
      label: '压缩',
      visible: () => true,
      run: () => {},
    }
    api.register(action)
    expect(api.list().map((a) => a.id)).toEqual(['compress'])
    expect(reg.useBulkActions().actions.value.map((a) => a.label)).toEqual(['压缩'])
  })

  it('同 id 重复注册按新定义覆盖替换（不重复）', async () => {
    const reg = await loadRegistry()
    const api = reg.getBulkActionsApi()
    api.register({ id: 'a', label: '旧', visible: () => true, run: () => {} })
    api.register({ id: 'a', label: '新', visible: () => false, run: () => {} })
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0].label).toBe('新')
    expect(api.list()[0].visible({ count: 1, hasFolder: false })).toBe(false)
  })

  it('subscribe 收到注册变更通知，取消订阅后不再收到', async () => {
    const reg = await loadRegistry()
    const api = reg.getBulkActionsApi()
    const fn = vi.fn()
    const unsubscribe = api.subscribe(fn)
    api.register({ id: 'x', label: 'X', visible: () => true, run: () => {} })
    expect(fn).toHaveBeenCalledTimes(1)
    unsubscribe()
    api.register({ id: 'y', label: 'Y', visible: () => true, run: () => {} })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})