import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import http from 'http'
import path from 'path'
import type { AddressInfo } from 'net'
import app from '../app'
import { STORAGE_ROOT } from '../../test/setup'
import { getTokenStore } from '../services/fileIO'
import { createSession } from '../middleware/auth'

/**
 * 回归：客户端中途断开（关预览、拖进度条、取消下载）后必须释放文件句柄。
 *
 * supertest 无法模拟"读一半就断开"，故这里起真实 HTTP 服务；
 * fd 断言依赖 /proc/self/fd，仅在 Linux（CI 环境）执行。
 */

const FILE_NAME = 'stream-leak-big.bin'
const FILE_PATH = path.join(STORAGE_ROOT, FILE_NAME)
const FILE_SIZE = 8 * 1024 * 1024
const isLinux = process.platform === 'linux'

let server: http.Server
let port: number

beforeAll(async () => {
  fs.writeFileSync(FILE_PATH, Buffer.alloc(FILE_SIZE, 0x41))
  server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  fs.rmSync(FILE_PATH, { force: true })
  server.closeAllConnections?.()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

interface HttpResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}

function request(pathname: string, headers: http.OutgoingHttpHeaders = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
      )
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

/** 读到第一块数据后立即断开连接，模拟浏览器取消请求 */
function abortAfterFirstChunk(
  pathname: string,
  headers: http.OutgoingHttpHeaders = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, headers }, (res) => {
      res.once('data', () => {
        req.destroy()
        resolve()
      })
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNRESET') resolve()
      else reject(err)
    })
  })
}

/** 当前进程内指向该文件的 fd 目标列表（含 "(deleted)" 后缀） */
function fdLinksFor(basename: string): string[] {
  if (!isLinux) return []
  try {
    return fs
      .readdirSync('/proc/self/fd')
      .map((fd) => {
        try {
          return fs.readlinkSync(`/proc/self/fd/${fd}`)
        } catch {
          return ''
        }
      })
      .filter((target) => target.includes(basename))
  } catch {
    return []
  }
}

async function waitForFdGone(basename: string, timeoutMs = 2000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs
  let links = fdLinksFor(basename)
  while (links.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    links = fdLinksFor(basename)
  }
  return links
}

const streamUrl = (token: string): string => `/api/files/stream?token=${encodeURIComponent(token)}`

describe('流式响应中断后释放文件句柄', () => {
  it.skipIf(!isLinux)('预览流（非 Range）中途断开 → fd 释放', async () => {
    const token = getTokenStore().issue(FILE_PATH)

    await abortAfterFirstChunk(streamUrl(token))

    expect(await waitForFdGone(FILE_NAME)).toEqual([])
  })

  it.skipIf(!isLinux)('预览流（Range）中途断开 → fd 释放', async () => {
    const token = getTokenStore().issue(FILE_PATH)

    await abortAfterFirstChunk(streamUrl(token), { Range: 'bytes=0-' })

    expect(await waitForFdGone(FILE_NAME)).toEqual([])
  })

  it.skipIf(!isLinux)('下载中途断开 → fd 释放', async () => {
    await abortAfterFirstChunk(`/api/files/download/${FILE_NAME}`, {
      Authorization: `Bearer ${createSession()}`,
    })

    expect(await waitForFdGone(FILE_NAME)).toEqual([])
  })

  it('正常 Range 请求 → 206 且内容正确', async () => {
    const token = getTokenStore().issue(FILE_PATH)

    const res = await request(streamUrl(token), { Range: 'bytes=0-1023' })

    expect(res.status).toBe(206)
    expect(res.headers['content-length']).toBe('1024')
    expect(res.headers['content-range']).toBe(`bytes 0-1023/${FILE_SIZE}`)
    expect(res.body.length).toBe(1024)

    if (isLinux) expect(await waitForFdGone(FILE_NAME)).toEqual([])
  })

  it('伪造 token → 403', async () => {
    const res = await request('/api/files/stream?token=forged')

    expect(res.status).toBe(403)
  })
})
