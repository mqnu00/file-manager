import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { STORAGE_ROOT } from '../../test/setup'
import { AppError } from '../utils/AppError'
import {
  getFileList,
  deleteFiles,
  copyWithCancel,
  renameFile,
  createFolder,
  moveFile,
  downloadFile,
} from './fileService'

/** STORAGE_ROOT 下的相对路径 */
const p = (...segments: string[]): string => path.join(STORAGE_ROOT, ...segments)

beforeEach(() => {
  fs.rmSync(STORAGE_ROOT, { recursive: true, force: true })
  fs.mkdirSync(STORAGE_ROOT, { recursive: true })
})

describe('getFileList', () => {
  it('断链符号链接 → broken: true 且不抛错', () => {
    fs.writeFileSync(p('real.txt'), 'x', 'utf-8')
    // 指向不存在目标的符号链接
    fs.symlinkSync(p('ghost-target'), p('broken-link'))

    const res = getFileList('')
    const broken = res.files.find((f) => f.name === 'broken-link')
    expect(broken).toBeTruthy()
    expect(broken!.broken).toBe(true)
    expect(broken!.isDirectory).toBe(false)
    expect(res.files.some((f) => f.name === 'real.txt' && !f.broken)).toBe(true)
  })

  it('路径不存在 → AppError 路径不存在', () => {
    expect(() => getFileList('no-such-dir')).toThrowError(new AppError('路径不存在'))
  })
})

describe('deleteFiles', () => {
  it('混入不存在路径 → 部分失败收集', () => {
    fs.writeFileSync(p('a.txt'), 'a', 'utf-8')
    fs.writeFileSync(p('b.txt'), 'b', 'utf-8')

    const result = deleteFiles(['a.txt', 'no-such.txt', 'b.txt'])
    expect(result.success).toBe(2)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].path).toBe('no-such.txt')
    expect(result.failed[0].message).toBe('文件不存在')
    expect(fs.existsSync(p('a.txt'))).toBe(false)
    expect(fs.existsSync(p('b.txt'))).toBe(false)
  })

  it('全部存在 → success 且无失败', () => {
    fs.writeFileSync(p('a.txt'), 'a', 'utf-8')
    const result = deleteFiles(['a.txt'])
    expect(result).toEqual({ success: 1, failed: [] })
  })
})

describe('copyWithCancel', () => {
  it('源不存在 → AppError', async () => {
    await expect(copyWithCancel('no-such.txt', 'dest.txt', new AbortController().signal)).rejects.toThrow(
      new AppError('源文件不存在: no-such.txt')
    )
  })

  it('单文件复制成功 → 返回 1 且目标存在', async () => {
    fs.writeFileSync(p('src.txt'), 'hello world', 'utf-8')
    const ac = new AbortController()
    const progress: number[] = []
    const count = await copyWithCancel('src.txt', 'dest/src.txt', ac.signal, (percent) => progress.push(percent))
    expect(count).toBe(1)
    expect(fs.readFileSync(p('dest/src.txt'), 'utf-8')).toBe('hello world')
    expect(progress[progress.length - 1]).toBe(100)
  })

  it('预置 abort → 立即抛 CANCELLED', async () => {
    fs.writeFileSync(p('src.txt'), 'x', 'utf-8')
    const ac = new AbortController()
    ac.abort()
    await expect(copyWithCancel('src.txt', 'dest/src.txt', ac.signal)).rejects.toThrow('CANCELLED')
  })

  it('目录复制中途 abort → 抛 CANCELLED', async () => {
    fs.mkdirSync(p('srcdir'), { recursive: true })
    fs.writeFileSync(p('srcdir/f1.txt'), '1', 'utf-8')
    fs.writeFileSync(p('srcdir/f2.txt'), '2', 'utf-8')
    fs.writeFileSync(p('srcdir/f3.txt'), '3', 'utf-8')

    const ac = new AbortController()
    // 第一个文件复制完成（进度回调触发）后立即取消
    const p1 = copyWithCancel('srcdir', 'destdir', ac.signal, () => ac.abort())
    await expect(p1).rejects.toThrow('CANCELLED')
  })
})

describe('renameFile / createFolder / moveFile / downloadFile 错误分支', () => {
  it('renameFile 非法名（含 /、..）→ AppError', () => {
    fs.writeFileSync(p('a.txt'), 'a', 'utf-8')
    expect(() => renameFile('a.txt', 'x/y.txt')).toThrowError(new AppError('非法文件名'))
    expect(() => renameFile('a.txt', '..')).toThrowError(new AppError('非法文件名'))
  })

  it('renameFile 正常改名成功', () => {
    fs.writeFileSync(p('a.txt'), 'a', 'utf-8')
    renameFile('a.txt', 'b.txt')
    expect(fs.existsSync(p('a.txt'))).toBe(false)
    expect(fs.existsSync(p('b.txt'))).toBe(true)
  })

  it('renameFile 源不存在 → AppError', () => {
    expect(() => renameFile('no-such.txt', 'b.txt')).toThrowError(new AppError('文件不存在'))
  })

  it('createFolder 非法名/已存在 → AppError', () => {
    expect(() => createFolder(undefined, '../evil')).toThrowError(new AppError('非法文件夹名称'))
    expect(() => createFolder(undefined, 'a/b')).toThrowError(new AppError('非法文件夹名称'))

    createFolder(undefined, 'newdir')
    expect(fs.existsSync(p('newdir'))).toBe(true)
    expect(() => createFolder(undefined, 'newdir')).toThrowError(new AppError('文件夹已存在'))
  })

  it('moveFile 源=目标 → AppError', () => {
    fs.writeFileSync(p('a.txt'), 'a', 'utf-8')
    expect(() => moveFile('a.txt', 'a.txt', {} as any)).toThrowError(new AppError('源文件和目标路径相同'))
  })

  it('moveFile 源不存在 → AppError', () => {
    expect(() => moveFile('no-such.txt', 'dest.txt', {} as any)).toThrowError(new AppError('源文件不存在'))
  })

  it('downloadFile 不存在/是目录 → AppError', () => {
    expect(() => downloadFile('no-such.txt', {} as any)).toThrowError(new AppError('文件不存在'))
    fs.mkdirSync(p('adir'), { recursive: true })
    expect(() => downloadFile('adir', {} as any)).toThrowError(new AppError('不能下载文件夹'))
  })
})
