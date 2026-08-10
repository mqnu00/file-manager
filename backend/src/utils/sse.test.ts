import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import {
  setSSEHeaders,
  sendSSEMessage,
  sendSSEProgress,
  sendSSEComplete,
  sendSSEError,
  endSSE,
} from './sse'

/** 构造 mock Response，收集 setHeader / write / end 调用 */
function mockRes(): Response & { headers: Record<string, string>; chunks: string[]; ended: boolean } {
  const res = {
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    setHeader: vi.fn((name: string, value: string) => {
      res.headers[name] = value
    }),
    write: vi.fn((chunk: string) => {
      res.chunks.push(chunk)
      return true
    }),
    end: vi.fn(() => {
      res.ended = true
    }),
  }
  return res as unknown as Response & { headers: Record<string, string>; chunks: string[]; ended: boolean }
}

describe('setSSEHeaders', () => {
  it('设置 SSE 所需 4 个响应头', () => {
    const res = mockRes()
    setSSEHeaders(res)
    expect(res.headers['Content-Type']).toBe('text/event-stream')
    expect(res.headers['Cache-Control']).toBe('no-cache')
    expect(res.headers['Connection']).toBe('keep-alive')
    expect(res.headers['X-Accel-Buffering']).toBe('no')
  })
})

describe('sendSSEMessage', () => {
  it('输出 data: {json}\\n\\n 格式', () => {
    const res = mockRes()
    sendSSEMessage(res, { type: 'progress', progress: 50 })
    expect(res.chunks).toEqual(['data: {"type":"progress","progress":50}\n\n'])
  })
})

describe('sendSSEProgress', () => {
  it('发送 progress 消息并携带 speed/totalSize', () => {
    const res = mockRes()
    sendSSEProgress(res, 42, 1024, 102400)
    expect(res.chunks[0]).toContain('"type":"progress"')
    expect(res.chunks[0]).toContain('"progress":42')
    expect(res.chunks[0]).toContain('"speed":1024')
    expect(res.chunks[0]).toContain('"totalSize":102400')
  })
})

describe('sendSSEComplete', () => {
  it('发送 complete 消息并携带 zipPath', () => {
    const res = mockRes()
    sendSSEComplete(res, 'dir.zip')
    expect(res.chunks[0]).toContain('"type":"complete"')
    expect(res.chunks[0]).toContain('"zipPath":"dir.zip"')
  })

  it('complete 消息可省略 zipPath', () => {
    const res = mockRes()
    sendSSEComplete(res)
    expect(res.chunks[0]).toContain('"type":"complete"')
  })
})

describe('sendSSEError', () => {
  it('发送 error 消息并携带 message', () => {
    const res = mockRes()
    sendSSEError(res, 'something failed')
    expect(res.chunks[0]).toContain('"type":"error"')
    expect(res.chunks[0]).toContain('"message":"something failed"')
  })
})

describe('endSSE', () => {
  it('调用 res.end() 结束响应', () => {
    const res = mockRes()
    endSSE(res)
    expect(res.ended).toBe(true)
  })
})
