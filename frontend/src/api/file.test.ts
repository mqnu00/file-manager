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
  cancelZip,
  deleteFile,
  batchDeleteFiles,
  renameFile,
  getLogs,
  getAvailableLogDates,
} from './file'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('cancelZip / deleteFile / batchDeleteFiles / renameFile 调用正确端点', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } })
    await cancelZip('docs')
    expect(mockedApi.post).toHaveBeenCalledWith('/files/zip/cancel', { path: 'docs' })

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
