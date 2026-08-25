import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { TaskInfo } from '@/types'

/** 捕获 subscribeTask 的 callbacks，供用例手动触发 SSE 事件 */
const h = vi.hoisted(() => ({
  subscribeCalls: [] as Array<{
    taskId: string
    callbacks: Record<string, (data?: unknown) => void>
  }>,
}))

vi.mock('@/api/task', () => ({
  startMoveTask: vi.fn(),
  getTasks: vi.fn(),
  cancelTask: vi.fn(),
  subscribeTask: vi.fn((taskId: string, callbacks: Record<string, (data?: unknown) => void>) => {
    h.subscribeCalls.push({ taskId, callbacks })
    return vi.fn()
  }),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

import { useTaskStore } from './task'
import {
  startMoveTask as startMoveTaskApi,
  getTasks as getTasksApi,
  cancelTask as cancelTaskApi,
} from '@/api/task'
import { ElMessage } from 'element-plus'

const mockedStartMove = vi.mocked(startMoveTaskApi)
const mockedGetTasks = vi.mocked(getTasksApi)
const mockedCancelTask = vi.mocked(cancelTaskApi)

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: 't1',
    type: 'move',
    status: 'running',
    phase: 'copy',
    progress: 0,
    speed: 0,
    totalSize: 0,
    startTime: Date.now(),
    metadata: { sourcePaths: ['a.txt'], sourceNames: ['a.txt'], targetPath: 'dir' },
    completedCount: 0,
    totalCount: 1,
    totalItemCount: 1,
    processedItemCount: 0,
    ...overrides,
  }
}

/** 获取最近一次 subscribeTask 调用的 callbacks */
function lastSubscribe() {
  return h.subscribeCalls[h.subscribeCalls.length - 1]
}

describe('task store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.subscribeCalls.length = 0
    vi.clearAllMocks()
  })

  it('init：为 running/cancelling 任务建立 SSE 订阅', async () => {
    mockedGetTasks.mockResolvedValue({
      tasks: [
        makeTask({ id: 'run-1' }),
        makeTask({ id: 'done-1', status: 'completed', phase: 'delete' }),
      ],
    })
    const store = useTaskStore()
    await store.init()
    expect(store.tasks.length).toBe(2)
    expect(h.subscribeCalls.map((c) => c.taskId)).toEqual(['run-1'])
  })

  it('startMoveTask 成功：乐观更新 + 订阅 SSE + 提示', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    expect(store.tasks[0].id).toBe('mv-1')
    expect(store.tasks[0].type).toBe('move')
    expect(store.tasks[0].status).toBe('running')
    expect(store.tasks[0].metadata).toMatchObject({ sourcePaths: ['a.txt'], targetPath: 'dir' })
    expect(h.subscribeCalls.length).toBe(1)
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('startMoveTask API 失败：错误提示且不添加任务', async () => {
    mockedStartMove.mockRejectedValue({ response: { data: { message: '路径冲突' } } })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    expect(store.tasks.length).toBe(0)
    expect(ElMessage.error).toHaveBeenCalledWith('路径冲突')
  })

  it('SSE onProgress 更新任务进度字段', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    const { callbacks } = lastSubscribe()
    callbacks.onProgress?.({
      progress: 50,
      speed: 2.5,
      totalSize: 1024,
      currentFile: 'b.txt',
      completedCount: 1,
      totalCount: 1,
      phase: 'copy',
    })
    expect(store.tasks[0].progress).toBe(50)
    expect(store.tasks[0].speed).toBe(2.5)
    expect(store.tasks[0].currentFile).toBe('b.txt')
    expect(store.tasks[0].phase).toBe('copy')
  })

  it('SSE onComplete：标记完成、执行回调并取消订阅', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    const onComplete = vi.fn()
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir', onComplete)
    const { callbacks } = lastSubscribe()
    callbacks.onComplete?.()
    expect(store.tasks[0].status).toBe('completed')
    expect(store.tasks[0].progress).toBe(100)
    expect(onComplete).toHaveBeenCalledTimes(1)
    // unsubscribe 函数（subscribeTask 返回的 vi.fn）被调用
  })

  it('SSE onError：标记失败并提示', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    const { callbacks } = lastSubscribe()
    callbacks.onError?.('删除源文件失败: EACCES')
    expect(store.tasks[0].status).toBe('failed')
    expect(store.tasks[0].error).toBe('删除源文件失败: EACCES')
    expect(ElMessage.error).toHaveBeenCalledWith('删除源文件失败: EACCES')
  })

  it('cancelTask 成功：标记取消并取消订阅', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    mockedCancelTask.mockResolvedValue({ success: true })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    await store.cancelTask('mv-1')
    expect(store.tasks[0].status).toBe('cancelled')
    expect(store.tasks[0].progress).toBe(0)
  })

  it('cancelTask API 失败：错误提示', async () => {
    mockedCancelTask.mockRejectedValue({ response: { data: { message: '无法取消' } } })
    const store = useTaskStore()
    await store.cancelTask('mv-1')
    expect(ElMessage.error).toHaveBeenCalledWith('无法取消')
  })

  it('dismissTask 从列表移除并取消订阅', async () => {
    mockedStartMove.mockResolvedValue({ taskId: 'mv-1' })
    const store = useTaskStore()
    await store.startMoveTask(['a.txt'], ['a.txt'], 'dir')
    store.dismissTask('mv-1')
    expect(store.tasks.map((t) => t.id)).toEqual([])
  })
})
