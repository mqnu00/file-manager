import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import { loadPlugin, unloadPluginByName, getLoadedPlugins, stopAllWatchers } from './loader'
import * as logger from '../utils/logger'

type WatchCallback = (eventType: string, filename: string | null) => void

/** 捕获 fs.watch 回调并返回 fake watcher（避免真实文件监视副作用） */
const watchCallbacks: WatchCallback[] = []
const fakeWatcher = { close: vi.fn() }
vi.spyOn(fs, 'watch').mockImplementation(((_dir: unknown, _opts: unknown, cb: WatchCallback) => {
  watchCallbacks.push(cb)
  return fakeWatcher as unknown as fs.FSWatcher
}) as never)

const loggerSpy = vi.spyOn(logger, 'log')

/** 统计 reload 日志次数（Reloading plugin "xxx"...） */
function reloadLogCount(): number {
  return loggerSpy.mock.calls.filter(
    (c) => c[0] === 'INFO' && c[1] === 'Plugin' && String(c[2]).includes('Reloading plugin "test"')
  ).length
}

beforeAll(() => {
  vi.useFakeTimers()
})

afterAll(() => {
  vi.useRealTimers()
  stopAllWatchers()
})

beforeEach(() => {
  watchCallbacks.length = 0
  fakeWatcher.close.mockClear()
  loggerSpy.mockClear()
})

afterEach(async () => {
  // 卸载所有已加载插件（含 watcher 清理），保持模块状态隔离
  for (const p of getLoadedPlugins()) {
    await unloadPluginByName(p.name)
  }
})

describe('loader 文件监视（热重载）', () => {
  it('加载本地插件（plugins/test，含 dist/）→ 启动 fs.watch', async () => {
    const plugin = await loadPlugin('test')
    expect(plugin).toBeTruthy()
    expect(plugin!.local).toBe(true)
    expect(watchCallbacks.length).toBe(1)
  })

  it('.js 变更防抖合并 → 只触发一次重载', async () => {
    await loadPlugin('test')
    const cb = watchCallbacks[0]
    cb('change', 'backend.js')
    await vi.advanceTimersByTimeAsync(300)
    cb('change', 'backend.js')
    await vi.advanceTimersByTimeAsync(300)
    // 防抖：第二次变更重置定时器，600ms 内仍未到 500ms
    expect(reloadLogCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(300)
    expect(reloadLogCount()).toBe(1)
    // 重载后重新启动监视（新 watcher）
    expect(watchCallbacks.length).toBe(2)
  })

  it('非 .js 文件变更 → 不触发重载', async () => {
    await loadPlugin('test')
    const cb = watchCallbacks[0]
    cb('change', 'styles.css')
    await vi.advanceTimersByTimeAsync(700)
    expect(reloadLogCount()).toBe(0)
    expect(watchCallbacks.length).toBe(1)
  })

  it('stopAllWatchers 关闭所有 watcher', async () => {
    await loadPlugin('test')
    stopAllWatchers()
    expect(fakeWatcher.close).toHaveBeenCalled()
  })
})
