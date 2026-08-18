import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  StreamTokenStore,
  parseRange,
  isTextBuffer,
  readBytes,
  writeRange,
  TEXT_LIMIT,
  BYTES_LIMIT,
} from './backend'

describe('StreamTokenStore', () => {
  it('issue/consume 返回绑定路径', () => {
    const store = new StreamTokenStore(60_000)
    const token = store.issue('/data/a.mp4')
    expect(store.consume(token)).toBe('/data/a.mp4')
  })

  it('未知/伪造令牌返回 null', () => {
    const store = new StreamTokenStore(60_000)
    expect(store.consume('forged')).toBeNull()
  })

  it('过期令牌返回 null（惰性清理）', () => {
    const store = new StreamTokenStore(-1) // 立即过期
    const token = store.issue('/data/a.mp4')
    expect(store.consume(token)).toBeNull()
  })

  it('令牌互不干扰，可重复签发', () => {
    const store = new StreamTokenStore(60_000)
    const t1 = store.issue('/data/a.mp4')
    const t2 = store.issue('/data/b.mp4')
    expect(t1).not.toBe(t2)
    expect(store.consume(t1)).toBe('/data/a.mp4')
    expect(store.consume(t2)).toBe('/data/b.mp4')
  })
})

describe('parseRange', () => {
  const size = 1000

  it('标准区间', () => {
    expect(parseRange('bytes=0-499', size)).toEqual([0, 499])
    expect(parseRange('bytes=500-', size)).toEqual([500, 999])
    expect(parseRange('bytes=0-', size)).toEqual([0, 999])
  })

  it('后缀区间 bytes=-N：最后 N 字节', () => {
    expect(parseRange('bytes=-100', size)).toEqual([900, 999])
    expect(parseRange('bytes=-2000', size)).toEqual([0, 999]) // 超过文件大小取全部
  })

  it('越界/非法返回 null', () => {
    expect(parseRange('bytes=1000-', size)).toBeNull() // start >= size
    expect(parseRange('bytes=500-400', size)).toBeNull() // start > end
    expect(parseRange('bytes=abc', size)).toBeNull()
    expect(parseRange('bytes=-0', size)).toBeNull()
    expect(parseRange('', size)).toBeNull()
    expect(parseRange('bytes=0-0-0', size)).toBeNull()
  })
})

describe('isTextBuffer', () => {
  it('纯文本无 NUL 判定为文本', () => {
    expect(isTextBuffer(Buffer.from('hello world\n第二行'))).toBe(true)
  })

  it('含 NUL 字节判定为二进制', () => {
    expect(isTextBuffer(Buffer.from([0x68, 0x00, 0x69]))).toBe(false)
    // NUL 出现在 8KB 之后仍判定为文本（探测窗口只取前 8KB）
    const buf = Buffer.alloc(9000, 0x41)
    expect(isTextBuffer(buf)).toBe(true)
  })
})

describe('readBytes / writeRange', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fv-test-'))
    file = path.join(dir, 'data.bin')
    fs.writeFileSync(file, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('readBytes 按偏移读取并限制长度', () => {
    const r = readBytes(file, 2, 3)
    expect([...r.data]).toEqual([0x02, 0x03, 0x04])
    expect(r.size).toBe(8)
  })

  it('readBytes 越界返回空', () => {
    const r = readBytes(file, 100, 3)
    expect(r.data.length).toBe(0)
  })

  it('readBytes 末尾截断（不越界）', () => {
    const r = readBytes(file, 6, 10)
    expect([...r.data]).toEqual([0x06, 0x07])
  })

  it('writeRange 覆盖写入', () => {
    writeRange(file, 1, Buffer.from([0xff, 0xfe]))
    expect([...fs.readFileSync(file)]).toEqual([0x00, 0xff, 0xfe, 0x03, 0x04, 0x05, 0x06, 0x07])
  })

  it('writeRange 在 EOF 外写入会扩展文件（零填充）', () => {
    writeRange(file, 9, Buffer.from([0xaa]))
    expect([...fs.readFileSync(file)]).toEqual([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x00, 0xaa,
    ])
  })

  it('常量限制合理', () => {
    expect(TEXT_LIMIT).toBe(8 * 1024 * 1024)
    expect(BYTES_LIMIT).toBe(512 * 1024)
  })
})