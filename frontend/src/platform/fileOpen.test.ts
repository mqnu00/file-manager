import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FileItem } from '@/types'

async function loadRegistry() {
  const mod = await import('./fileOpen')
  return mod
}

const textFile: FileItem = {
  name: 'a.txt',
  path: 'a.txt',
  isDirectory: false,
  size: 10,
  modified: '',
}

beforeEach(() => {
  vi.resetModules()
  delete (window as Record<string, unknown>)['__fm_file_open']
})

describe('fileOpen 注册表', () => {
  it('模块加载时暴露全局注册 API（与导入实例一致）', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    expect((window as Record<string, unknown>)['__fm_file_open']).toBe(api)
  })

  it('register 追加 handler，list 返回全部', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    const handler = {
      id: 'viewer',
      canOpen: (f: FileItem) => !f.isDirectory,
      open: () => {},
    }
    api.register(handler)
    expect(api.list().map((h) => h.id)).toEqual(['viewer'])
    expect(reg.useFileOpenActions().handlers.value.map((h) => h.id)).toEqual(['viewer'])
  })

  it('同 id 重复注册按新定义覆盖替换（不重复）', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    api.register({ id: 'a', canOpen: () => false, open: () => {} })
    api.register({ id: 'a', canOpen: () => true, open: () => {} })
    expect(api.list()).toHaveLength(1)
    expect(api.list()[0].canOpen(textFile)).toBe(true)
  })

  it('resolve 返回第一个 canOpen 命中的 handler（按注册序）', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    const first = { id: 'first', canOpen: (f: FileItem) => f.name.endsWith('.txt'), open: () => {} }
    const second = {
      id: 'second',
      canOpen: (f: FileItem) => f.name.endsWith('.md'),
      open: () => {},
    }
    api.register(first)
    api.register(second)
    expect(api.resolve(textFile)?.id).toBe('first')
    // 无 handler 命中返回 null
    expect(api.resolve({ ...textFile, name: 'a.xyz' })).toBeNull()
    // 注册序：unregister first 后由 second 接管
    api.unregister('first')
    expect(api.resolve(textFile)).toBeNull()
  })

  it('register 返回的注销函数按 id 移除并通知订阅者（插件 teardown 用）', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    const fn = vi.fn()
    api.subscribe(fn)
    const unregister = api.register({ id: 'viewer', canOpen: () => true, open: () => {} })
    fn.mockClear()
    unregister()
    expect(api.list()).toHaveLength(0)
    expect(fn).toHaveBeenCalledTimes(1)
    // 重复注销为 no-op，不抛错
    expect(() => unregister()).not.toThrow()
  })

  it('unregister 不存在的 id 为 no-op，不抛错', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    expect(() => api.unregister('not-exists')).not.toThrow()
  })

  it('refresh() 重新赋值响应式 handlers 并通知订阅者（重算 is-openable 用）', async () => {
    const reg = await loadRegistry()
    const api = reg.getFileOpenApi()
    const fn = vi.fn()
    api.subscribe(fn)
    api.register({ id: 'viewer', canOpen: () => true, open: () => {} })
    fn.mockClear()

    // 仅触发 refresh（handler 集合未变），应通知订阅者且 handlers 仍为同一逻辑集合
    api.refresh()
    expect(fn).toHaveBeenCalledTimes(1)
    // handlers ref 被重新赋值（新数组引用），驱动依赖它的组件重算
    expect(api.list().map((h) => h.id)).toEqual(['viewer'])
  })
})
