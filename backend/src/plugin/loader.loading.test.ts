import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  loadPlugin,
  loadEnabledPlugins,
  unloadPluginByName,
  getLoadedPlugins,
  getAllPluginInfos,
  stopAllWatchers,
} from './loader'
import { pluginApp } from '../app'
import { getConfig, updateConfig, updatePluginConfig } from '../config'
import { TEST_ROOT } from '../../test/setup'

const STORE = path.join(TEST_ROOT, 'plugins-store')

/** 在临时插件目录构造最小 CJS 插件（main 导出 install 函数） */
function writeFakePlugin(
  name: string,
  manifest?: Record<string, unknown>,
  installBody?: string
): void {
  const dir = path.join(STORE, 'node_modules', name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      main: 'index.js',
      ...(manifest ? { fileManagerPlugin: manifest } : {}),
    })
  )
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `module.exports = { install: async (ctx) => { ${installBody ?? '/* test fake plugin */'} } }`
  )
}

beforeAll(() => {
  // 让 resolvePluginRoot 从临时目录解析 npm 来源插件
  updateConfig({ pluginInstallDir: path.join(STORE, 'node_modules') })
  writeFakePlugin('fake-plugin')
  writeFakePlugin('fake-dep', { dependsOn: ['fake-plugin'] })
  updatePluginConfig('fake-plugin', { source: 'npm', enabled: false })
  updatePluginConfig('fake-dep', { source: 'npm', enabled: false })
})

afterAll(() => {
  stopAllWatchers()
})

describe('插件加载/卸载（临时 fake 插件）', () => {
  it('loadPlugin 加载成功并注册到 loadedPlugins', async () => {
    const plugin = await loadPlugin('fake-plugin')
    expect(plugin).toBeTruthy()
    expect(plugin!.name).toBe('fake-plugin')
    expect(plugin!.source).toBe('npm')
    expect(plugin!.local).toBe(false)
    expect(getLoadedPlugins().some((p) => p.name === 'fake-plugin')).toBe(true)
  })

  it('loadPlugin 已加载返回 null', async () => {
    const again = await loadPlugin('fake-plugin')
    expect(again).toBeNull()
  })

  it('loadPlugin 依赖未满足返回 null', async () => {
    writeFakePlugin('fake-need-ghost', { dependsOn: ['ghost-plugin'] })
    updatePluginConfig('fake-need-ghost', { source: 'npm', enabled: false })
    expect(await loadPlugin('fake-need-ghost')).toBeNull()
  })

  it('loadPlugin 依赖已满足则加载成功', async () => {
    // fake-dep dependsOn fake-plugin（已加载）
    const plugin = await loadPlugin('fake-dep')
    expect(plugin).toBeTruthy()
    expect(plugin!.name).toBe('fake-dep')
  })

  it('loadPlugin 不存在插件返回 null', async () => {
    expect(await loadPlugin('no-such-plugin-xyz')).toBeNull()
  })

  it('getAllPluginInfos 包含已配置插件（含未加载）', () => {
    const infos = getAllPluginInfos()
    expect(infos.some((p) => p.name === 'fake-plugin')).toBe(true)
    expect(infos.some((p) => p.name === 'fake-dep')).toBe(true)
  })

  it('unloadPluginByName 卸载已加载插件并持久化禁用', async () => {
    const ok = await unloadPluginByName('fake-dep')
    expect(ok).toBe(true)
    expect(getLoadedPlugins().some((p) => p.name === 'fake-dep')).toBe(false)
    expect((getConfig().plugins as Record<string, { enabled?: boolean }>)['fake-dep'].enabled).toBe(false)
  })

  it('unloadPluginByName 未加载插件返回 false', async () => {
    expect(await unloadPluginByName('not-loaded-plugin')).toBe(false)
  })

  it('同批加载的插件卸载时不影响其他插件路由（回归：并行 install 层归属竞态）', async () => {
    // batch-a 的 install 先异步等待再追加路由：修复前同批 Promise.all 并行时它会"后完成"，
    // 其 layers 切片会把先完成者（batch-b）的路由层也算进自己名下，卸载 batch-a 会误删 batch-b 路由。
    writeFakePlugin(
      'batch-a',
      {},
      `await new Promise((r) => setTimeout(r, 20));
       const routerA = ctx.express.Router();
       routerA.get('/ping', (req, res) => res.json({ ok: true }));
       ctx.app.use('/api/plugin/batch-a', routerA);`
    )
    writeFakePlugin(
      'batch-b',
      {},
      `const routerB = ctx.express.Router();
       routerB.get('/ping', (req, res) => res.json({ ok: true }));
       ctx.app.use('/api/plugin/batch-b', routerB);`
    )
    updatePluginConfig('batch-a', { source: 'npm', enabled: true })
    updatePluginConfig('batch-b', { source: 'npm', enabled: true })

    await loadEnabledPlugins()
    expect(getLoadedPlugins().some((p) => p.name === 'batch-a')).toBe(true)
    expect(getLoadedPlugins().some((p) => p.name === 'batch-b')).toBe(true)

    const isMounted = (mountPath: string): boolean =>
      (pluginApp.stack as unknown as { regexp: RegExp }[]).some((l) =>
        l.regexp.test(`${mountPath}/ping`)
      )
    expect(isMounted('/api/plugin/batch-a')).toBe(true)
    expect(isMounted('/api/plugin/batch-b')).toBe(true)

    // 卸载 batch-a：batch-b 的路由必须仍然存在（修复前此处失败，batch-b 路由被误删）
    await unloadPluginByName('batch-a')
    expect(isMounted('/api/plugin/batch-a')).toBe(false)
    expect(isMounted('/api/plugin/batch-b')).toBe(true)

    // 清理
    await unloadPluginByName('batch-b')
    updatePluginConfig('batch-a', { enabled: false })
    updatePluginConfig('batch-b', { enabled: false })
  })
})
