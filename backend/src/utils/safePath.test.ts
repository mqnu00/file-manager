import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { safePath, getStorageRoot, isVirtualFs, calculateDirSize } from './safePath'
import { AppError } from './AppError'
import { STORAGE_ROOT } from '../../test/setup'

describe('safePath（路径穿越防护）', () => {
  it('正常相对路径拼接 storageRoot', () => {
    expect(safePath('a/b.txt')).toBe(path.join(STORAGE_ROOT, 'a/b.txt'))
  })

  it('空路径返回 storageRoot 本身', () => {
    expect(safePath('')).toBe(STORAGE_ROOT)
  })

  it('拒绝 .. 组件（路径穿越）', () => {
    expect(() => safePath('../x')).toThrow(AppError)
    expect(() => safePath('a/../b')).toThrow(AppError)
  })

  it('拒绝反斜杠形式的穿越', () => {
    expect(() => safePath('..\\x')).toThrow(AppError)
    expect(() => safePath('a\\..\\b')).toThrow(AppError)
  })

  it('拒绝多层穿越与绝对路径逃逸', () => {
    expect(() => safePath('../../etc/passwd')).toThrow(AppError)
  })
})

describe('getStorageRoot', () => {
  it('返回配置的 storageRoot（测试临时目录）', () => {
    expect(getStorageRoot()).toBe(STORAGE_ROOT)
  })
})

describe('isVirtualFs', () => {
  it('识别 /proc 与 /sys 虚拟文件系统', () => {
    expect(isVirtualFs('/proc/1/cmdline')).toBe(true)
    expect(isVirtualFs('/sys/devices/foo')).toBe(true)
    expect(isVirtualFs('/proc')).toBe(true)
    expect(isVirtualFs('/sys')).toBe(true)
  })

  it('普通路径返回 false', () => {
    expect(isVirtualFs('/etc/passwd')).toBe(false)
    expect(isVirtualFs('/home/user/file.txt')).toBe(false)
  })
})

describe('calculateDirSize', () => {
  let dir: string

  beforeAll(() => {
    dir = path.join(STORAGE_ROOT, 'size-test')
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'a.txt'), '12345', 'utf-8') // 5 字节
    fs.writeFileSync(path.join(dir, 'sub', 'b.txt'), '1234567890', 'utf-8') // 10 字节
  })

  it('递归计算目录总大小（含子目录）', async () => {
    expect(await calculateDirSize(dir)).toBe(15)
  })

  it('空目录返回 0', async () => {
    const empty = path.join(STORAGE_ROOT, 'size-test-empty')
    fs.mkdirSync(empty, { recursive: true })
    expect(await calculateDirSize(empty)).toBe(0)
  })

  it('不存在的目录抛 ENOENT（记录当前行为）', async () => {
    // 顶层 readdir 的 ENOENT 未被捕获，直接向上抛
    await expect(calculateDirSize(path.join(STORAGE_ROOT, 'no-such-dir'))).rejects.toThrow(/ENOENT/)
  })
})
