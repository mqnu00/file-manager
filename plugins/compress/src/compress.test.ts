import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync, statSync, existsSync } from 'fs'
import { createCompressService, ZCompressError } from './compress'
import type { ServiceDeps } from './compress'

let root: string

function makeDeps(): ServiceDeps {
  return {
    safePath: (userPath: string) => {
      const normalized = path.normalize(userPath)
      if (normalized.includes('..')) {
        throw new Error('非法路径')
      }
      const joined = path.join(root, userPath)
      if (!joined.startsWith(root)) {
        throw new Error('非法路径')
      }
      return joined
    },
    getStorageRoot: () => root,
    log: () => {},
  }
}

const p = (rel: string): string => path.join(root, rel)

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'fm-compress-test-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('computeTarget 命名与冲突后缀', () => {
  const service = createCompressService(makeDeps())

  function src(name: string, kind: 'file' | 'dir' = 'file') {
    return { path: name, fullPath: p(name), name, kind }
  }

  it('单文件 → <name>.zip', () => {
    expect(service.targetBaseName([src('a.txt')])).toBe('a.txt.zip')
  })

  it('单文件夹 → <name>.zip', () => {
    expect(service.targetBaseName([src('docs', 'dir')])).toBe('docs.zip')
  })

  it('多个 → <首名> 等 N 项.zip', () => {
    expect(
      service.targetBaseName([src('a.txt'), src('b.txt'), src('docs', 'dir')])
    ).toBe('a.txt 等 3 项.zip')
  })

  it('目标已存在时自动加 (n) 后缀', () => {
    writeFileSync(p('a.txt'), 'x')
    writeFileSync(p('a.txt.zip'), 'old')
    writeFileSync(p('a.txt (1).zip'), 'old2')
    const target = service.computeTarget([src('a.txt')], '')
    expect(existsSync(target.fullPath)).toBe(false)
    expect(target.relativePath).toBe('a.txt (2).zip')
  })
})

describe('checkPermissions 权限预检', () => {
  it('全部可读 + 输出目录可写 → ok', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('docs'), { recursive: true })
    writeFileSync(p('docs/a.txt'), 'aaa')
    writeFileSync(p('readme.md'), 'readme')
    const result = await service.checkPermissions(['docs', 'readme.md'], '')
    expect(result.ok).toBe(true)
    expect(result.items.map((i) => [i.name, i.readable])).toEqual([
      ['docs', true],
      ['readme.md', true],
    ])
    expect(result.output.writable).toBe(true)
    expect(result.targetPath).toBe('docs 等 2 项.zip')
  })

  it('存在但不可读 → ok=false 且给出错误', async () => {
    const service = createCompressService(makeDeps())
    writeFileSync(p('secret.txt'), 's')
    chmodSync(p('secret.txt'), 0o000)
    try {
      const result = await service.checkPermissions(['secret.txt'], '')
      expect(result.ok).toBe(false)
      expect(result.items[0].readable).toBe(false)
      expect(result.items[0].error).toBeTruthy()
      expect(result.targetPath).toBe('')
    } finally {
      chmodSync(p('secret.txt'), 0o644)
    }
  })

  it('不存在 → ok=false', async () => {
    const service = createCompressService(makeDeps())
    const result = await service.checkPermissions(['nope.txt'], '')
    expect(result.ok).toBe(false)
    expect(result.items[0].exists).toBe(false)
    expect(result.targetPath).toBe('')
  })

  it('输出目录只读 → ok=false 且 writable=false', async () => {
    const service = createCompressService(makeDeps())
    writeFileSync(p('a.txt'), 'x')
    mkdirSync(p('ro'))
    chmodSync(p('ro'), 0o555)
    try {
      const result = await service.checkPermissions(['a.txt'], 'ro')
      expect(result.ok).toBe(false)
      expect(result.output.writable).toBe(false)
      expect(result.output.error).toBeTruthy()
    } finally {
      chmodSync(p('ro'), 0o755)
    }
  })

  it('输出目录不存在 → ok=false', async () => {
    const service = createCompressService(makeDeps())
    writeFileSync(p('a.txt'), 'x')
    const result = await service.checkPermissions(['a.txt'], 'no-such-dir')
    expect(result.ok).toBe(false)
    expect(result.output.exists).toBe(false)
  })

  it('输出目录落入选中文件夹内部 → forbidden', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('docs/sub'), { recursive: true })
    writeFileSync(p('docs/a.txt'), 'a')
    const result = await service.checkPermissions(['docs'], 'docs/sub')
    expect(result.ok).toBe(false)
    expect(result.forbidden).toBe(true)
    expect(result.forbiddenMessage).toContain('docs')
  })
})

describe('collectEntries 条目收集', () => {
  it('文件 + 文件夹混合，文件夹递归展开', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('docs/sub'), { recursive: true })
    writeFileSync(p('docs/a.txt'), 'aa')
    writeFileSync(p('docs/sub/b.txt'), 'bbbb')
    writeFileSync(p('top.txt'), 't')
    const { entries, totalBytes } = await service.collectEntries([
      { path: 'docs', fullPath: p('docs'), name: 'docs', kind: 'dir' },
      { path: 'top.txt', fullPath: p('top.txt'), name: 'top.txt', kind: 'file' },
    ])
    expect(entries.map((e) => e.zipName).sort()).toEqual([
      'docs/a.txt',
      'docs/sub/b.txt',
      'top.txt',
    ])
    expect(totalBytes).toBe(7)
  })
})

describe('runJob 压缩任务', () => {
  it('多源压缩成功：生成非空 zip 并返回目标', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('docs/sub'), { recursive: true })
    writeFileSync(p('docs/a.txt'), 'aa')
    writeFileSync(p('docs/sub/b.txt'), 'bbbb')
    writeFileSync(p('top.txt'), 't')
    const onProgress = vi.fn()
    const result = await service.runJob({
      paths: ['docs', 'top.txt'],
      outputDir: '',
      onProgress,
    })
    expect(result.entries).toBe(3)
    expect(result.target.relativePath).toBe('docs 等 2 项.zip')
    const zipFull = p(result.target.relativePath)
    expect(existsSync(zipFull)).toBe(true)
    expect(statSync(zipFull).size).toBeGreaterThan(0)
    expect(onProgress).toHaveBeenCalled()
  })

  it('压缩中途取消 → 抛 CANCELLED 且半成品清理', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('big'), { recursive: true })
    // 生成 ~4MB 数据，保证取消发生在写流过程中
    const chunk = Buffer.alloc(1024 * 1024, 65)
    for (let i = 0; i < 4; i++) writeFileSync(p(`big/f${i}.bin`), chunk)
    const ac = new AbortController()
    // 首个进度回调（写流已开始）即取消，确定性触发 CANCELLED
    const promise = service
      .runJob({ paths: ['big'], outputDir: '', signal: ac.signal, onProgress: () => ac.abort() })
      .then(() => 'done')
      .catch((e: Error) => e.message)
    const result = await promise
    expect(result).toBe('CANCELLED')
    expect(existsSync(p('big.zip'))).toBe(false)
  })

  it('空选择 → ZCompressError', async () => {
    const service = createCompressService(makeDeps())
    await expect(service.runJob({ paths: [], outputDir: '' })).rejects.toThrow(ZCompressError)
  })

  it('输出目录落入选中文件夹内部 → ZCompressError', async () => {
    const service = createCompressService(makeDeps())
    mkdirSync(p('docs/sub'), { recursive: true })
    writeFileSync(p('docs/a.txt'), 'a')
    await expect(
      service.runJob({ paths: ['docs'], outputDir: 'docs/sub' })
    ).rejects.toThrow(/不能位于/)
  })
})