import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadPlugin, unloadPluginByName, getLoadedPlugins } from './loader'
import { updateConfig, updatePluginConfig } from '../config'
import { TEST_ROOT } from '../../test/setup'

const STORE = path.join(TEST_ROOT, 'plugins-data-store')

beforeAll(() => {
  updateConfig({ pluginInstallDir: path.join(STORE, 'node_modules') })
  updatePluginConfig('data-plugin', { source: 'npm', enabled: true })
  const dir = path.join(STORE, 'node_modules', 'data-plugin')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'data-plugin', version: '1.0.0', main: 'index.js' }),
  )
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `module.exports = {
  install: (ctx) => {
    globalThis.__dataCtx = { dataDir: ctx.dataDir, storage: ctx.storage }
    ctx.storage.set('k', 'v')
  }
}`,
  )
})

afterEach(async () => {
  for (const p of getLoadedPlugins()) {
    await unloadPluginByName(p.name)
  }
  delete (globalThis as any).__dataCtx
})

describe('loader 注入插件数据目录', () => {
  it('install 收到的 ctx.dataDir / ctx.storage 按插件绑定且可用', async () => {
    await loadPlugin('data-plugin')
    const c = (globalThis as any).__dataCtx
    expect(c).toBeDefined()
    expect(typeof c.dataDir).toBe('string')
    expect(c.dataDir.endsWith(path.join('data', 'data-plugin'))).toBe(true)
    expect(c.storage.get('k')).toBe('v')
  })

  it('不同插件的数据目录互相隔离', async () => {
    updatePluginConfig('data-plugin-2', { source: 'npm', enabled: true })
    const dir2 = path.join(STORE, 'node_modules', 'data-plugin-2')
    fs.mkdirSync(dir2, { recursive: true })
    fs.writeFileSync(
      path.join(dir2, 'package.json'),
      JSON.stringify({ name: 'data-plugin-2', version: '1.0.0', main: 'index.js' }),
    )
    fs.writeFileSync(
      path.join(dir2, 'index.js'),
      `module.exports = { install: (ctx) => { ctx.storage.set('mine', 'x') } }`,
    )
    await loadPlugin('data-plugin')
    await loadPlugin('data-plugin-2')
    // data-plugin 不应看到 data-plugin-2 的键
    expect((globalThis as any).__dataCtx.storage.get('mine')).toBeUndefined()
    const s2 = (globalThis as any).__dataCtx2
    void s2
  })
})
