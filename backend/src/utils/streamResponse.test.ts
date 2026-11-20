import { describe, it, expect } from 'vitest'
import { Readable, Writable } from 'stream'
import type { Response } from 'express'
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

describe('pipeStreamToResponse', () => {
  it('客户端中断（close）→ destroy 源流，释放 fd', async () => {
    const source = new Readable({ read() {} })
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), 'test')

    res.destroy()
    await new Promise((resolve) => setImmediate(resolve))

    expect(source.destroyed).toBe(true)
  })

  it('源流错误且未发头 → 摘掉长度头并返回 500', async () => {
    const source = new Readable({
      read() {
        this.destroy(new Error('boom'))
      },
    })
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), 'test')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(res.statusCode).toBe(500)
    expect(res.removedHeaders).toEqual(['Content-Length', 'Content-Range'])
    expect(res.jsonBody).toEqual({ message: '流式读取失败' })
  })

  it('源流错误且已发头 → 销毁响应，不再写 JSON', async () => {
    const source = new Readable({
      read() {
        this.destroy(new Error('boom'))
      },
    })
    const res = new FakeResponse()
    res.headersSent = true
    pipeStreamToResponse(source, asResponse(res), 'test')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(res.destroyed).toBe(true)
    expect(res.jsonBody).toBeNull()
  })

  it('正常读完 → 数据完整透传', async () => {
    const source = Readable.from([Buffer.from('hello'), Buffer.from(' world')])
    const res = new FakeResponse()
    pipeStreamToResponse(source, asResponse(res), 'test')

    await new Promise<void>((resolve) => res.on('finish', () => resolve()))

    expect(Buffer.concat(res.chunks).toString()).toBe('hello world')
  })
})
