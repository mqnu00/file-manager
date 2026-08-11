import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolvePluginRoot, getPluginManifestConfig } from './loader'
import { TEST_ROOT } from '../../test/setup'

const projectRoot = path.resolve(__dirname, '..', '..', '..')

describe('resolvePluginRoot（插件根目录解析）', () => {
  it('本地插件优先解析 plugins/ 目录（回归：避免 node_modules 同名包误匹配）', () => {
    expect(resolvePluginRoot('test')).toBe(path.join(projectRoot, 'plugins', 'test'))
  })

  it('不存在的插件返回 null', () => {
    expect(resolvePluginRoot('no-such-plugin-xyz')).toBeNull()
  })
})

describe('getPluginManifestConfig', () => {
  it('无 fileManagerPlugin 字段返回空对象', () => {
    expect(getPluginManifestConfig(path.join(projectRoot, 'plugins', 'test'))).toEqual({})
  })

  it('读取 fileManagerPlugin 清单配置', () => {
    const dir = path.join(TEST_ROOT, 'manifest-test')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'file-manager-plugin-demo',
        fileManagerPlugin: {
          config: {
            host: { default: 'localhost', description: '监听地址' },
            port: { default: 445 },
          },
          dependsOn: ['smb'],
        },
      }),
      'utf-8'
    )
    const manifest = getPluginManifestConfig(dir)
    expect(manifest).toEqual({
      config: { host: { default: 'localhost', description: '监听地址' }, port: { default: 445 } },
      dependsOn: ['smb'],
    })
  })

  it('package.json 不可读时返回空对象', () => {
    const dir = path.join(TEST_ROOT, 'no-manifest')
    fs.mkdirSync(dir, { recursive: true })
    expect(getPluginManifestConfig(dir)).toEqual({})
  })
})
