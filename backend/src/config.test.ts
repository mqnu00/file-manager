import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  getConfig,
  getSanitizedConfig,
  updateConfig,
  updatePluginConfig,
  removePluginConfig,
  isDefaultToken,
  getPluginInstallDir,
  getPluginInstallPrefix,
  ensurePluginInstallPrefix,
} from './config'
import { TEST_ROOT } from '../test/setup'

describe('config 函数级（单测）', () => {
  it('getSanitizedConfig 脱敏 token（前 3 位 + ***）', () => {
    const cfg = getSanitizedConfig()
    expect(cfg.auth.token).toBe('tes***') // test-token-123
    expect(cfg.storageRoot).toBeTruthy()
  })

  it('isDefaultToken：非默认 token → false', () => {
    expect(isDefaultToken()).toBe(false)
  })

  it('updatePluginConfig 新增并合并插件配置', () => {
    updatePluginConfig('test-plugin', { enabled: true, source: 'npm' })
    expect(getConfig().plugins!['test-plugin']).toMatchObject({ enabled: true, source: 'npm' })

    // 二次更新只覆盖传入字段，保留已有字段
    updatePluginConfig('test-plugin', { enabled: false })
    expect(getConfig().plugins!['test-plugin']).toMatchObject({ enabled: false, source: 'npm' })
  })

  it('removePluginConfig 删除插件配置', () => {
    removePluginConfig('test-plugin')
    expect(getConfig().plugins!['test-plugin']).toBeUndefined()
  })

  it('getPluginInstallDir 默认指向 cwd/node_modules（开发环境）', () => {
    expect(getPluginInstallDir()).toBe(path.join(process.cwd(), 'node_modules'))
  })

  it('getPluginInstallDir/prefix 支持自定义目录', () => {
    const dir = path.join(TEST_ROOT, 'plugin-store', 'node_modules')
    updateConfig({ pluginInstallDir: dir })
    expect(getPluginInstallDir()).toBe(dir)
    expect(getPluginInstallPrefix()).toBe(path.join(TEST_ROOT, 'plugin-store'))
  })

  it('ensurePluginInstallPrefix 创建 prefix 下的 package.json', () => {
    ensurePluginInstallPrefix()
    const pkgPath = path.join(TEST_ROOT, 'plugin-store', 'package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    expect(pkg.private).toBe(true)
  })

  it('isDefaultToken：更新为默认 token 后返回 true（放最后，避免影响其他用例）', () => {
    updateConfig({ auth: { token: 'admin123' } })
    expect(isDefaultToken()).toBe(true)
  })
})
