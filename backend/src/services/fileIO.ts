/**
 * 通用文件 I/O 服务（平台能力，供查看器子插件与主项目路由共享）
 *
 * 由 file-viewer 插件后端迁移上收：二进制读/写（分页或定位）、
 * 短期流令牌 + Range 流式输出所需的纯函数。
 *
 * 平台只做二进制透传，不做任何文本/二进制/大小判断——区分文本还是
 * 二进制、是否超限、如何解码，均由具体查看器插件自行解决。
 * 所有路径均在调用方（路由层）经 utils.safePath 校验后传入全路径。
 */

import fs from 'fs'
import crypto from 'crypto'

/** 单次 read/write 传输上限（内存保护，非语义判断；应用自行决定"太大"的标准） */
export const IO_LIMIT = 8 * 1024 * 1024
/** 流令牌有效期 */
export const STREAM_TTL_MS = 30 * 60 * 1000

// ==================== 令牌存储 ====================

export interface TokenEntry {
  path: string
  expiresAt: number
}

/** 短期流令牌存储：令牌 → 绑定绝对路径 */
export class StreamTokenStore {
  private tokens = new Map<string, TokenEntry>()
  private readonly ttlMs: number

  constructor(ttlMs: number = STREAM_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /** 为指定绝对路径签发令牌 */
  issue(fullPath: string): string {
    const token = crypto.randomBytes(32).toString('base64url')
    this.tokens.set(token, { path: fullPath, expiresAt: Date.now() + this.ttlMs })
    return token
  }

  /** 校验并消费令牌；有效返回绑定路径，否则 null（惰性清理过期项） */
  consume(token: string): string | null {
    const entry = this.tokens.get(token)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(token)
      return null
    }
    return entry.path
  }
}

/** 全局实例（路由层共享；token 在 /api/files/stream 与后续迁移的子插件间互通） */
let streamTokens: StreamTokenStore | null = null
export function getTokenStore(): StreamTokenStore {
  if (!streamTokens) streamTokens = new StreamTokenStore()
  return streamTokens
}

// ==================== 纯函数 ====================

/** 解析 Range 头（bytes=start-end），返回 [start, end]（闭区间）；无法解析返回 null */
export function parseRange(rangeHeader: string, size: number): [number, number] | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!m) return null
  const startRaw = m[1]
  const endRaw = m[2]
  if (!startRaw && !endRaw) return null
  // 仅后缀形式 bytes=-N：最后 N 字节
  if (!startRaw) {
    const suffixLen = parseInt(endRaw, 10)
    if (Number.isNaN(suffixLen) || suffixLen <= 0) return null
    const start = Math.max(0, size - suffixLen)
    return [start, size - 1]
  }
  const start = parseInt(startRaw, 10)
  if (Number.isNaN(start)) return null
  const end = endRaw ? parseInt(endRaw, 10) : size - 1
  if (Number.isNaN(end)) return null
  if (start < 0 || start >= size || start > end) return null
  return [start, Math.min(end, size - 1)]
}

/** 从指定偏移读取至多 length 字节（不越界，返回文件总大小） */
export function readBytesAt(
  fullPath: string,
  offset: number,
  length: number
): { data: Buffer; size: number } {
  const size = fs.statSync(fullPath).size
  if (offset >= size) return { data: Buffer.alloc(0), size }
  const toRead = Math.min(length, size - offset)
  const fd = fs.openSync(fullPath, 'r')
  try {
    const buf = Buffer.alloc(toRead)
    let total = 0
    while (total < toRead) {
      const n = fs.readSync(fd, buf, total, toRead - total, offset + total)
      if (n <= 0) break
      total += n
    }
    return { data: buf.subarray(0, total), size }
  } finally {
    fs.closeSync(fd)
  }
}

/** 在指定偏移写入字节（覆盖式，可扩展文件） */
export function writeRangeAt(fullPath: string, offset: number, data: Buffer): void {
  const fd = fs.openSync(fullPath, 'r+')
  try {
    fs.writeSync(fd, data, 0, data.length, offset)
  } finally {
    fs.closeSync(fd)
  }
}