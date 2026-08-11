import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./index', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from './index'
import { startMoveTask, startCompressTask, getTasks, cancelTask } from './task'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('startCompressTask 调用 POST /tasks/compress', async () => {
    mockedApi.post.mockResolvedValue({ data: { taskId: 'zip-1' } })
    const res = await startCompressTask('docs')
    expect(mockedApi.post).toHaveBeenCalledWith('/tasks/compress', { sourcePath: 'docs' })
    expect(res.taskId).toBe('zip-1')
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
