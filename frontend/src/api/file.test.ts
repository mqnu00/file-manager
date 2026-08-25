import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import {
  getFiles,
  getFolders,
  getDirSize,
  createFolder,
  deleteFile,
  batchDeleteFiles,
  renameFile,
  getLogs,
  getAvailableLogDates,
  moveFileAsync,
  downloadFile,
} from './file'

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

function stubFetchStream(chunks: string[], ok = true) {
  const reader = makeReader(chunks)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, body: { getReader: () => reader } }))
  return reader
}

describe('api/file（axios 封装）', () => {
  it('getFiles 带 path 参数', async () => {
    mockedApi.get.mockResolvedValue({ data: { path: 'docs', files: [] } })
    const res = await getFiles('docs')
    expect(mockedApi.get).toHaveBeenCalledWith('/files', { params: { path: 'docs' } })
    expect(res.path).toBe('docs')
  })

  it('getFiles 默认根目录', async () => {
    mockedApi.get.mockResolvedValue({ data: { path: '', files: [] } })
    await getFiles()
    expect(mockedApi.get).toHaveBeenCalledWith('/files', { params: { path: '' } })
  })

  it('getFolders 过滤出文件夹', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        files: [
          { name: 'docs', path: 'docs', isDirectory: true },
          { name: 'a.txt', path: 'a.txt', isDirectory: false },
        ],
      },
    })
    const folders = await getFolders()
    expect(mockedApi.get).toHaveBeenCalledWith('/files', { params: { path: '' } })
    expect(folders.map((f) => f.name)).toEqual(['docs'])
  })

  it('getDirSize 携带 timeout', async () => {
    mockedApi.get.mockResolvedValue({ data: { size: 1024 } })
    const res = await getDirSize('docs')
    expect(mockedApi.get).toHaveBeenCalledWith('/files/dirsize', {
      params: { path: 'docs' },
      timeout: 30000,
    })
    expect(res.size).toBe(1024)
  })

  it('createFolder 调用 POST /folders', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } })
    await createFolder('', 'newdir')
    expect(mockedApi.post).toHaveBeenCalledWith('/folders', { path: '', name: 'newdir' })
  })

  it('deleteFile / batchDeleteFiles / renameFile 调用正确端点', async () => {
    mockedApi.delete.mockResolvedValue({ data: { success: true } })
    await deleteFile('a.txt')
    expect(mockedApi.delete).toHaveBeenCalledWith('/files', { params: { path: 'a.txt' } })

    mockedApi.post.mockResolvedValue({ data: { success: 2, failed: [] } })
    const res = await batchDeleteFiles(['a.txt', 'b.txt'])
    expect(mockedApi.post).toHaveBeenCalledWith('/files/batch-delete', {
      paths: ['a.txt', 'b.txt'],
    })
    expect(res.success).toBe(2)

    mockedApi.put.mockResolvedValue({ data: { success: true } })
    await renameFile('a.txt', 'b.txt')
    expect(mockedApi.put).toHaveBeenCalledWith('/files/rename', { path: 'a.txt', newName: 'b.txt' })
  })

  it('getLogs / getAvailableLogDates', async () => {
    mockedApi.get.mockResolvedValue({ data: { logs: [], total: 0 } })
    await getLogs({ date: '2026-08-10', pageSize: 20 })
    expect(mockedApi.get).toHaveBeenCalledWith('/logs', {
      params: { date: '2026-08-10', pageSize: 20 },
    })

    mockedApi.get.mockResolvedValue({ data: { dates: ['2026-08-10'] } })
    const res = await getAvailableLogDates()
    expect(mockedApi.get).toHaveBeenCalledWith('/logs/dates')
    expect(res.dates).toEqual(['2026-08-10'])
  })
})

describe('moveFileAsync（fetch SSE 流）', () => {
  it('moveFileAsync：progress 回调递增，complete 后 resolve', async () => {
    stubFetchStream([
      `data: ${JSON.stringify({ type: 'progress', progress: 30, speed: 1, totalSize: 100 })}\n\n`,
      `data: ${JSON.stringify({ type: 'progress', progress: 60, speed: 2, totalSize: 100 })}\n\n`,
      `data: ${JSON.stringify({ type: 'complete' })}\n\n`,
    ])
    const progress: number[] = []
    await moveFileAsync('a.txt', 'b.txt', (p, s, t) => progress.push(p))
    expect(progress).toEqual([30, 60])
  })

  it('moveFileAsync：error 事件 reject', async () => {
    stubFetchStream([`data: ${JSON.stringify({ type: 'error', message: '磁盘已满' })}\n\n`])
    await expect(moveFileAsync('a.txt', 'b.txt')).rejects.toThrow('磁盘已满')
  })

  it('moveFileAsync：非 ok 响应 reject', async () => {
    stubFetchStream([], false)
    await expect(moveFileAsync('a.txt', 'b.txt')).rejects.toThrow('移动失败')
  })

  it('moveFileAsync：携带 Authorization 头与 body', async () => {
    localStorage.setItem('session_token', 'sess-1')
    stubFetchStream([`data: ${JSON.stringify({ type: 'complete' })}\n\n`])
    await moveFileAsync('a.txt', 'b.txt')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/files/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sess-1',
      },
      body: JSON.stringify({ fromPath: 'a.txt', toPath: 'b.txt' }),
    })
  })
})

describe('downloadFile', () => {
  it('解析 Content-Disposition 文件名并触发下载', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['data']),
        headers: {
          get: () => `attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87.txt`,
        },
      })
    )
    await downloadFile('dir/中文.txt')

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/files/download/dir%2F%E4%B8%AD%E6%96%87.txt',
      { headers: { Authorization: 'Bearer ' } }
    )
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalled()

    clickSpy.mockRestore()
    createObjectURL.mockRestore()
    revoke.mockRestore()
  })

  it('非 ok 响应 → 抛出服务端错误信息', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: '文件不存在' }),
      })
    )
    await expect(downloadFile('no-such.txt')).rejects.toThrow('文件不存在')
  })
})
