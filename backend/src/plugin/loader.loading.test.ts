import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  loadPlugin,
  unloadPluginByName,
  getLoadedPlugins,
  getAllPluginInfos,
  stopAllWatchers,
} from './loader'
import { getConfig, updateConfig, updatePluginConfig } from '../config'
import { TEST_ROOT } from '../../test/setup'

const STORE = path.join(TEST_ROOT, 'plugins-store')

/** 在临时插件目录构造最小 CJS 插件（main 导出 install 函数） */
function writeFakePlugin(name: string, manifest?: Record<string, unknown>): void {
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
    `module.exports = { install: async (ctx) => { /* test fake plugin */ } }`
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
})
