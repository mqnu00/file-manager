import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadPlugin, unloadPluginByName, getLoadedPlugins } from './loader'
import { updateConfig, updatePluginConfig } from '../config'
import { TEST_ROOT } from '../../test/setup'

const STORE = path.join(TEST_ROOT, 'plugins-teardown')

interface ViewerReg {
  viewers: Map<string, unknown>
  registerViewer(m: { id: string }): void
  unregisterViewer(id: string): void
  getViewers(): unknown[]
}

/** 写入「核心」插件：注册 file-viewer:viewers 注册表（持有查看器 Map） */
function writeCore(): void {
  const dir = path.join(STORE, 'node_modules', 'teardown-core')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'teardown-core', version: '1.0.0', main: 'index.js' })
  )
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `module.exports = {
      install: (ctx) => {
        const reg = {
          viewers: new Map(),
          registerViewer(m) { this.viewers.set(m.id, m) },
          unregisterViewer(id) { this.viewers.delete(id) },
          getViewers() { return [...this.viewers.values()] },
        }
        globalThis.__coreReg = reg
        ctx.registerService('file-viewer:viewers', reg)
      }
    }`
  )
}

/** 写入「子查看」插件：注册 code 查看器并在 teardown 中注销 */
function writeSub(): void {
  const dir = path.join(STORE, 'node_modules', 'teardown-sub')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'teardown-sub', version: '1.0.0', main: 'index.js' })
  )
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `module.exports = {
      install: (ctx) => {
        const registry = ctx.getService('file-viewer:viewers')
        registry.registerViewer({ id: 'code', label: '代码编辑器', defaultExtensions: ['ts'], route: '/plugin/code/view' })
        return () => {
          globalThis.__subTeardown = (globalThis.__subTeardown || 0) + 1
          registry.unregisterViewer('code')
        }
      }
    }`
  )
}

function coreReg(): ViewerReg | undefined {
  return (globalThis as any).__coreReg as ViewerReg | undefined
}

function hasCodeViewer(): boolean {
  return !!coreReg()?.getViewers().some((v: any) => v.id === 'code')
}

beforeAll(() => {
  updateConfig({ pluginInstallDir: path.join(STORE, 'node_modules') })
  updatePluginConfig('teardown-core', { source: 'npm', enabled: false })
  updatePluginConfig('teardown-sub', { source: 'npm', enabled: false })
  writeCore()
  writeSub()
})

afterEach(async () => {
  // 清理：尽量卸载测试插件，避免影响其它用例
  for (const p of getLoadedPlugins()) {
    if (p.name === 'teardown-sub' || p.name === 'teardown-core') {
      try {
        await unloadPluginByName(p.name)
      } catch {
        /* 已卸载则忽略 */
      }
    }
  }
  ;(globalThis as any).__subTeardown = 0
})

describe('后端插件 teardown 契约（修复：子查看插件卸载后从注册表注销）', () => {
  it('install 返回 teardown → 卸载时调用，并从核心注册表移除查看器', async () => {
    await loadPlugin('teardown-core')
    await loadPlugin('teardown-sub')

    // 加载后：核心注册表含 code 查看器
    expect(hasCodeViewer()).toBe(true)

    // 卸载子插件：teardown 应被调用并注销 code 查看器
    await unloadPluginByName('teardown-sub')
    expect((globalThis as any).__subTeardown).toBe(1)
    expect(hasCodeViewer()).toBe(false)
  })

  it('teardown 抛错不阻断卸载（核心服务仍残留由其它机制/重载兜底）', async () => {
    const dir = path.join(STORE, 'node_modules', 'teardown-throw')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'teardown-throw', version: '1.0.0', main: 'index.js' })
    )
    fs.writeFileSync(
      path.join(dir, 'index.js'),
      `module.exports = { install: () => { return () => { throw new Error('boom') } } }`
    )
    updatePluginConfig('teardown-throw', { source: 'npm', enabled: false })

    await expect(loadPlugin('teardown-throw')).resolves.toBeDefined()
    await expect(unloadPluginByName('teardown-throw')).resolves.toBe(true)
  })
})
