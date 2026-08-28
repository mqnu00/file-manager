import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getPluginDataDir,
  getPluginStore,
  clearPluginData,
  __resetStoreCache,
} from './storage'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-storage-'))
  // getDataBase() 惰性读取环境变量，故此处设置对后续调用生效
  process.env.FILE_MANAGER_PLUGIN_DATA_DIR = tmp
  __resetStoreCache()
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  delete process.env.FILE_MANAGER_PLUGIN_DATA_DIR
})

describe('插件数据目录存储', () => {
  it('getPluginDataDir 惰性创建并返回绝对路径', () => {
    const dir = getPluginDataDir('foo')
    expect(path.isAbsolute(dir)).toBe(true)
    expect(dir).toBe(path.join(tmp, 'foo'))
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('KV set/get/delete/has/keys/all 往返', () => {
    const s = getPluginStore('foo')
    expect(s.get('a')).toBeUndefined()
    s.set('a', { n: 1 })
    expect(s.get<{ n: number }>('a')).toEqual({ n: 1 })
    expect(s.has('a')).toBe(true)
    s.set('b', 2)
    expect(s.keys().sort()).toEqual(['a', 'b'])
    expect(s.all()).toEqual({ a: { n: 1 }, b: 2 })
    s.delete('a')
    expect(s.has('a')).toBe(false)
  })

  it('store 持久化到 store.json，重载实例可读取', () => {
    getPluginStore('foo').set('k', 'v')
    __resetStoreCache()
    expect(getPluginStore('foo').get('k')).toBe('v')
  })

  it('键含路径分隔符 / 空键 / . / .. 抛错', () => {
    const s = getPluginStore('foo')
    expect(() => s.set('a/b', 1)).toThrow()
    expect(() => s.set('', 1)).toThrow()
    expect(() => s.set('.', 1)).toThrow()
    expect(() => s.set('..', 1)).toThrow()
    expect(() => s.get('a/b')).toThrow()
  })

  it('值不可 JSON 序列化（函数 / undefined）抛错', () => {
    const s = getPluginStore('foo')
    expect(() => s.set('fn', () => 1)).toThrow()
    expect(() => s.set('u', undefined)).toThrow()
  })

  it('clearPluginData 删除目录', () => {
    getPluginDataDir('foo')
    expect(fs.existsSync(path.join(tmp, 'foo'))).toBe(true)
    clearPluginData('foo')
    expect(fs.existsSync(path.join(tmp, 'foo'))).toBe(false)
  })
})
