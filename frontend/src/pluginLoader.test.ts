import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

vi.mock('@/context', () => ({
  ctx: { tag: 'mock-ctx' },
}))

import { loadPluginFrontend, initPlugins } from './pluginLoader'

const FIXTURE = path.resolve(__dirname, '../test/fixtures')

function calls(): string[] {
  return (globalThis as any).__pluginCalls ?? []
}

function ctxs(): unknown[] {
  return (globalThis as any).__pluginCtxs ?? []
}

function resetGlobals() {
  delete (globalThis as any).__pluginCalls
  delete (globalThis as any).__pluginCtxs
  delete (globalThis as any).__importedUrls
}

beforeEach(() => {
  resetGlobals()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('loadPluginFrontend', () => {
  it('无 frontendPath → 直接返回，不执行任何加载', async () => {
    await loadPluginFrontend({ name: 'x', frontendPath: null })
    expect(console.log).not.toHaveBeenCalled()
    expect(calls()).toEqual([])
  })

  it('export install 变体 → install(ctx) 调用并提示', async () => {
    const entry = path.join(FIXTURE, 'plugin-install-export.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry })
    expect(calls()).toEqual(['install-export'])
    expect(ctxs()).toEqual([{ tag: 'mock-ctx' }])
    expect(console.log).toHaveBeenCalledWith('[Plugin] demo frontend loaded')
  })

  it('export default 函数变体 → 同样执行', async () => {
    const entry = path.join(FIXTURE, 'plugin-default-fn.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry })
    expect(calls()).toEqual(['default-fn'])
  })

  it('export default { install } 变体 → 同样执行', async () => {
    const entry = path.join(FIXTURE, 'plugin-default-install.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry })
    expect(calls()).toEqual(['default-install'])
  })

  it('无 install 函数 → console.warn', async () => {
    const entry = path.join(FIXTURE, 'plugin-no-install.mjs')
    await loadPluginFrontend({ name: 'demo', frontendPath: entry })
    expect(console.warn).toHaveBeenCalledWith('[Plugin] demo has no install function')
  })

  it('import/install 抛错 → console.error 且不向上抛', async () => {
    const entry = path.join(FIXTURE, 'plugin-throws.mjs')
    await expect(loadPluginFrontend({ name: 'demo', frontendPath: entry })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('[Plugin] demo frontend failed:', expect.any(Error))
  })

  it('cacheBust=true 每次追加时间戳强制重载；false 复用模块缓存', async () => {
    const entry = path.join(FIXTURE, 'plugin-record-url.mjs')
    const plugin = { name: 'demo', frontendPath: entry }

    await loadPluginFrontend(plugin, false)
    await loadPluginFrontend(plugin, false)
    // 同一 URL → 模块缓存命中，只执行一次
    expect((globalThis as any).__importedUrls).toHaveLength(1)

    await loadPluginFrontend(plugin, true)
    await loadPluginFrontend(plugin, true)
    // 时间戳不同 → 每次都是新 specifier，重新执行
    expect((globalThis as any).__importedUrls).toHaveLength(3)
  })
})

describe('initPlugins', () => {
  it('fetch 非 ok → 警告并返回', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await initPlugins()
    expect(console.warn).toHaveBeenCalledWith('[Plugin] Failed to fetch plugin list:', 500)
    expect(calls()).toEqual([])
  })

  it('逐个加载：无 frontendPath 跳过、单个失败不影响后续', async () => {
    const good = path.join(FIXTURE, 'plugin-install-export.mjs')
    const bad = path.join(FIXTURE, 'plugin-throws.mjs')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { name: 'a', frontendPath: good },
          { name: 'b', frontendPath: null },
          { name: 'c', frontendPath: bad },
        ],
      })
    )
    await initPlugins()
    expect(calls()).toEqual(['install-export'])
    // 失败插件由 loadPluginFrontend 内部捕获记录，不影响后续插件
    expect(console.error).toHaveBeenCalledWith('[Plugin] c frontend failed:', expect.any(Error))
  })

  it('fetch 抛错 → 警告不抛出', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(initPlugins()).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalledWith('[Plugin] Failed to fetch plugin list:', expect.any(Error))
  })
})

describe('initPlugins（demo 模式）', () => {
  it('VITE_DEMO_MODE=true 时跳过 /api/plugins，直接加载静态 demo 插件', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('BASE_URL', FIXTURE + '/')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await initPlugins()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(calls()).toEqual(['miku-demo'])
    expect(ctxs()).toEqual([{ tag: 'mock-ctx' }])
  })
})
