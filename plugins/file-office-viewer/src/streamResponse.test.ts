import { describe, it, expect } from 'vitest'
import { Readable, Writable } from 'stream'
import type { Response } from '@mqn00/file-manager/plugin'
import { pipeStreamToResponse } from './streamResponse'

/** 仅实现 helper 用到的响应能力，避免依赖真实 HTTP socket */
class FakeResponse extends Writable {
  headersSent = false
  removedHeaders: string[] = []
  statusCode = 200
  jsonBody: unknown = null
  chunks: Buffer[] = []

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk)
    callback()
  }

  removeHeader(name: string): void {
    this.removedHeaders.push(name)
  }

  status(code: number): this {
    this.statusCode = code
    return this
  }

  json(payload: unknown): this {
    this.jsonBody = payload
    this.end()
    return this
  }
}

const asResponse = (res: FakeResponse): Response => res as unknown as Response

describe('pipeStreamToResponse（office 插件）', () => {
  it('客户端中断（close）→ destroy 源流，释放 fd', async () => {
    const source = new Readable({ read() {} })
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), () => {})

    res.destroy()
    await new Promise((resolve) => setImmediate(resolve))

    expect(source.destroyed).toBe(true)
  })

  it('源流错误 → 上报日志并返回 500', async () => {
    const errors: string[] = []
    const source = new Readable({
      read() {
        this.destroy(new Error('boom'))
      },
    })
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), (message) => errors.push(message))

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(errors).toEqual(['boom'])
    expect(res.statusCode).toBe(500)
    expect(res.jsonBody).toEqual({ message: '流式读取失败' })
  })

  it('正常读完 → 数据完整透传', async () => {
    const source = Readable.from([Buffer.from('pdf'), Buffer.from('-bytes')])
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), () => {})

    await new Promise<void>((resolve) => res.on('finish', () => resolve()))

    expect(Buffer.concat(res.chunks).toString()).toBe('pdf-bytes')
  })
})
