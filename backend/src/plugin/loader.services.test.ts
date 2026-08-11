import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadPlugin, unloadPluginByName, getLoadedPlugins, stopAllWatchers, startConfiguredServices } from './loader'
import { getConfig, updateConfig, updatePluginConfig } from '../config'
import { TEST_ROOT } from '../../test/setup'

const STORE = path.join(TEST_ROOT, 'plugins-store')

/** 服务启停记录（fake 插件通过 globalThis 共享） */
interface SvcRecorder {
  started: string[]
  stopped: string[]
}

/** 写入带托管服务的 fake npm 插件 */
function writeServicePlugin(name: string, manageBody: string): void {
  const dir = path.join(STORE, 'node_modules', name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.js' }))
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `module.exports = {
  install: async (ctx) => {
    globalThis.__svcCtx = ctx;
    ${manageBody}
  }
}`
  )
}

/** 组装 manageService spec（start/stop 记录到 recorder） */
function svcSpec(svcName: string, opts: Record<string, string> = {}): string {
  const canAutoStart = opts.canAutoStart ?? 'true'
  const dependsOn = opts.dependsOn ?? '[]'
  return `ctx.manageService('${svcName}', {
    canAutoStart: async () => (${canAutoStart}),
    dependsOn: ${dependsOn},
    start: async () => { globalThis.__svcRecorder.started.push('${svcName}') },
    stop: async () => { ${opts.stop ?? `globalThis.__svcRecorder.stopped.push('${svcName}')`} },
    isRunning: async () => (${opts.isRunning ?? 'true'}),
  })`
}

function recorder(): SvcRecorder {
  return (globalThis as any).__svcRecorder as SvcRecorder
}

function getCtx(): any {
  return (globalThis as any).__svcCtx
}

function startedServicesOf(pluginName: string): string[] {
  const cfg = (getConfig().plugins || {})[pluginName] as Record<string, unknown> | undefined
  const list = cfg?.startedServices
  return Array.isArray(list) ? (list as string[]) : []
}

beforeAll(() => {
  updateConfig({ pluginInstallDir: path.join(STORE, 'node_modules') })
  const plugins: Record<string, unknown> = {
    'svc-a-plugin': { source: 'npm', enabled: false },
    'svc-b-plugin': { source: 'npm', enabled: false },
    'svc-skip-plugin': { source: 'npm', enabled: false },
    'svc-timeout-plugin': { source: 'npm', enabled: false },
    'svc-stop-fail-plugin': { source: 'npm', enabled: false },
    'svc-conflict-plugin': { source: 'npm', enabled: false },
  }
  for (const [name, cfg] of Object.entries(plugins)) {
    updatePluginConfig(name, cfg)
  }
  writeServicePlugin('svc-a-plugin', svcSpec('svc-a'))
  writeServicePlugin('svc-b-plugin', svcSpec('svc-b', { dependsOn: "['svc-a']" }))
  writeServicePlugin('svc-skip-plugin', svcSpec('svc-skip', { canAutoStart: 'false' }))
  writeServicePlugin('svc-timeout-plugin', svcSpec('svc-timeout', { isRunning: 'false' }))
  writeServicePlugin('svc-stop-fail-plugin', svcSpec('svc-stop-fail', { stop: `throw new Error('stop boom')` }))
  writeServicePlugin('svc-conflict-plugin', svcSpec('svc-a'))
})

beforeEach(() => {
  ;(globalThis as any).__svcRecorder = { started: [], stopped: [] }
  delete (globalThis as any).__svcCtx
})

afterEach(async () => {
  for (const p of getLoadedPlugins()) {
    await unloadPluginByName(p.name)
  }
})

afterAll(() => {
  stopAllWatchers()
})

describe('loader 托管服务（manageService/startService/waitForService）', () => {
  it('加载带托管服务的插件 → manageService 注册成功（可通过 ctx 操作）', async () => {
    const plugin = await loadPlugin('svc-a-plugin')
    expect(plugin).toBeTruthy()
    // loadPlugin 返回精简对象，托管服务注册通过 ctx 验证
    const ctx = getCtx()
    expect(await ctx.isServiceRunning('svc-a')).toBe(true)
    await ctx.startService('svc-a')
    expect(recorder().started).toEqual(['svc-a'])
  })

  it('startService/stopService 持久化 startedServices 并调用 spec', async () => {
    await loadPlugin('svc-a-plugin')
    const ctx = getCtx()

    expect(await ctx.isServiceRunning('svc-a')).toBe(true)
    await ctx.startService('svc-a')
    expect(recorder().started).toEqual(['svc-a'])
    expect(startedServicesOf('svc-a-plugin')).toContain('svc-a')

    await ctx.stopService('svc-a')
    expect(recorder().stopped).toEqual(['svc-a'])
    expect(startedServicesOf('svc-a-plugin')).not.toContain('svc-a')
  })

  it('操作未托管的服务 → 抛错', async () => {
    await loadPlugin('svc-a-plugin')
    const ctx = getCtx()
    // startService/stopService 为同步抛错；waitForService 为 async 拒绝
    expect(() => ctx.startService('no-such')).toThrow('not managed')
    expect(() => ctx.stopService('no-such')).toThrow('not managed')
    await expect(ctx.waitForService('no-such')).rejects.toThrow('not managed')
  })

  it('waitForService 运行中直接返回 / 未运行则超时', async () => {
    await loadPlugin('svc-a-plugin')
    await loadPlugin('svc-timeout-plugin')
    const ctx = getCtx()
    await expect(ctx.waitForService('svc-a')).resolves.toBeUndefined()
    await expect(ctx.waitForService('svc-timeout', { running: true, timeout: 50 })).rejects.toThrow('Timeout waiting')
  })

  it('startConfiguredServices 按依赖分层顺序启动', async () => {
    await loadPlugin('svc-a-plugin')
    await loadPlugin('svc-b-plugin')
    updatePluginConfig('svc-a-plugin', { enabled: true, startedServices: ['svc-a'] })
    updatePluginConfig('svc-b-plugin', { enabled: true, startedServices: ['svc-b'] })

    await startConfiguredServices()
    expect(recorder().started).toEqual(['svc-a', 'svc-b'])
  })

  it('canAutoStart 预检失败 → 跳过自动启动', async () => {
    await loadPlugin('svc-skip-plugin')
    updatePluginConfig('svc-skip-plugin', { enabled: true, startedServices: ['svc-skip'] })

    await startConfiguredServices()
    expect(recorder().started).toEqual([])
  })

  it('unloadPluginByName 停止托管服务、清理注册表与 startedServices', async () => {
    await loadPlugin('svc-a-plugin')
    const ctx = getCtx()
    await ctx.startService('svc-a')
    expect(startedServicesOf('svc-a-plugin')).toContain('svc-a')

    expect(await unloadPluginByName('svc-a-plugin')).toBe(true)
    expect(recorder().stopped).toContain('svc-a')
    expect(getLoadedPlugins().some((p) => p.name === 'svc-a-plugin')).toBe(false)
    expect(startedServicesOf('svc-a-plugin')).toEqual([])
    // manageRegistry 已清理：再 stopService 报 not managed（同步抛错）
    expect(() => ctx.stopService('svc-a')).toThrow('not managed')
  })

  it('服务 stop 抛错不中断卸载', async () => {
    await loadPlugin('svc-stop-fail-plugin')
    expect(await unloadPluginByName('svc-stop-fail-plugin')).toBe(true)
    expect(getLoadedPlugins().some((p) => p.name === 'svc-stop-fail-plugin')).toBe(false)
  })

  it('重复 manageService → 插件加载失败（install 抛错）', async () => {
    await loadPlugin('svc-a-plugin')
    expect(await loadPlugin('svc-conflict-plugin')).toBeNull()
    // 原插件不受影响
    expect(getLoadedPlugins().some((p) => p.name === 'svc-a-plugin')).toBe(true)
  })
})
