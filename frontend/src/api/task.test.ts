import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { startMoveTask, getTasks, cancelTask, subscribeTask } from './task'
import type { TaskEventCallbacks } from './task'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

/** 构造 SSE 流 reader（按 chunk 依次返回，末位 done） */
function makeReader(chunks: string[]) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  let i = 0
  return {
    read: vi.fn(() => {
      if (i < queue.length) {
        const value = queue[i++]
        return Promise.resolve({ done: false, value })
      }
      return Promise.resolve({ done: true, value: undefined })
    }),
  }
}

const flush = () => new Promise((r) => setTimeout(r, 20))

function makeCallbacks(): TaskEventCallbacks {
  return {
    onState: vi.fn(),
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onCancelled: vi.fn(),
    onError: vi.fn(),
  }
}

function stubFetchStream(chunks: string[], ok = true) {
  const reader = makeReader(chunks)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: 500, body: { getReader: () => reader } })
  )
  return reader
}

describe('api/task', () => {
  it('startMoveTask 调用 POST /tasks/move', async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: 'mv-1' } })
    const res = await startMoveTask(['a.txt'], 'docs')
    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/move', {
      sourcePaths: ['a.txt'],
      targetPath: 'docs',
    })
    expect(res.taskId).toBe('mv-1')
  })

  it('getTasks 调用 GET /tasks', async () => {
    mockedApi.get.mockResolvedValue({ data: { tasks: [] } })
    const res = await getTasks()
    expect(mockedApi.get).toHaveBeenCalledWith('/tasks')
    expect(res.tasks).toEqual([])
  })

  it('cancelTask 调用 POST /tasks/:id/cancel', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } })
    const res = await cancelTask('mv-1')
    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/mv-1/cancel')
    expect(res.success).toBe(true)
  })
})

describe('subscribeTask SSE 流解析', () => {
  it('state/progress 事件路由到回调，complete 终止读取', async () => {
    const reader = stubFetchStream([
      `data: ${JSON.stringify({ type: 'state', task: { id: 't1', status: 'running' } })}\n\n`,
      `data: ${JSON.stringify({ type: 'progress', progress: 50, speed: 2, totalSize: 100, currentFile: 'a.txt', completedCount: 1, totalCount: 2, phase: 'copy' })}\n\n`,
      `data: ${JSON.stringify({ type: 'complete' })}\n\n`,
    ])
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()

    expect(cb.onState).toHaveBeenCalledWith({ id: 't1', status: 'running' })
    expect(cb.onProgress).toHaveBeenCalledWith({
      progress: 50,
      speed: 2,
      totalSize: 100,
      currentFile: 'a.txt',
      completedCount: 1,
      totalCount: 2,
      phase: 'copy',
    })
    expect(cb.onComplete).toHaveBeenCalledTimes(1)
    // complete 后不再继续读取
    expect(reader.read.mock.calls.length).toBe(3)
  })

  it('跨 chunk 边界拆分仍能正确拼接解析', async () => {
    stubFetchStream([
      'data: ' + JSON.stringify({ type: 'progress', progress: 10 }), // 无换行，与下一 chunk 拼接
      '\n\ndata: ' + JSON.stringify({ type: 'complete' }) + '\n\n',
    ])
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()

    expect(cb.onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ progress: 10, phase: 'copy' })
    )
    expect(cb.onComplete).toHaveBeenCalledTimes(1)
  })

  it('非 data: 行与坏 JSON 被忽略，cancelled 事件正常路由', async () => {
    stubFetchStream([
      'ignored line\ndata: not-json\n',
      `data: ${JSON.stringify({ type: 'cancelled', message: '用户取消' })}\n\n`,
    ])
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()

    expect(cb.onCancelled).toHaveBeenCalledWith('用户取消')
    expect(cb.onProgress).not.toHaveBeenCalled()
    expect(cb.onError).not.toHaveBeenCalled()
  })

  it('非 ok 响应 → onError 订阅失败', async () => {
    stubFetchStream([], false)
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()
    expect(cb.onError).toHaveBeenCalledWith('订阅失败: 500')
  })

  it('body 无 reader → onError 无法读取响应流', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }))
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()
    expect(cb.onError).toHaveBeenCalledWith('无法读取响应流')
  })

  it('携带 Authorization 头', async () => {
    localStorage.setItem('session_token', 'sess-1')
    stubFetchStream([`data: ${JSON.stringify({ type: 'complete' })}\n\n`])
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/t1/stream', {
      headers: { Authorization: 'Bearer sess-1' },
      signal: expect.any(AbortSignal),
    })
  })

  it('取消函数触发 abort', async () => {
    stubFetchStream([`data: ${JSON.stringify({ type: 'state', task: {} })}\n\n`])
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {})
    const cb = makeCallbacks()
    const unsubscribe = subscribeTask('t1', cb)
    unsubscribe()
    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('fetch 抛错 → onError 连接失败', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const cb = makeCallbacks()
    subscribeTask('t1', cb)
    await flush()
    expect(cb.onError).toHaveBeenCalledWith('network down')
  })
})
