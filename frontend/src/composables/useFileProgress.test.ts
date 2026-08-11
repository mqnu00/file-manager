import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/file', () => ({
  getFiles: vi.fn(),
}))

vi.mock('@/api/task', () => ({
  startMoveTask: vi.fn(),
  startCompressTask: vi.fn(),
  getTasks: vi.fn(),
  cancelTask: vi.fn(),
  subscribeTask: vi.fn(() => vi.fn()),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import { useFileProgress } from './useFileProgress'
import { getFiles } from '@/api/file'
import { useTaskStore } from '@/stores/task'
import { ElMessage } from 'element-plus'

const mockedGetFiles = vi.mocked(getFiles)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useFileProgress', () => {
  it('showBatchMoveDialog 设置状态并推导父路径', () => {
    const progress = useFileProgress()
    progress.showBatchMoveDialog(['docs/a.txt', 'docs/b.txt'], ['a.txt', 'b.txt'])
    expect(progress.moveState.visible).toBe(true)
    expect(progress.moveState.sourcePaths).toEqual(['docs/a.txt', 'docs/b.txt'])
    expect(progress.moveState.sourceNames).toEqual(['a.txt', 'b.txt'])
    expect(progress.moveState.targetPath).toBe('docs')
  })

  it('moveFiles：目标路径为空 → 警告且不启动', async () => {
    const progress = useFileProgress()
    progress.showBatchMoveDialog(['a.txt'], ['a.txt'])
    progress.moveState.targetPath = ''
    await progress.moveFile()
    expect(ElMessage.warning).toHaveBeenCalledWith('请选择目标路径')
    expect(mockedGetFiles).not.toHaveBeenCalled()
  })

  it('moveFiles：目标目录存在同名文件 → 警告并取消移动', async () => {
    mockedGetFiles.mockResolvedValue({
      path: 'docs',
      files: [{ name: 'a.txt', path: 'docs/a.txt', isDirectory: false, size: 0, modified: '' }],
    })
    const store = useTaskStore()
    vi.spyOn(store, 'startMoveTask').mockImplementation(() => Promise.resolve())

    const progress = useFileProgress()
    progress.showBatchMoveDialog(['a.txt'], ['a.txt'])
    progress.moveState.targetPath = 'docs'
    await progress.moveFile()

    expect(ElMessage.warning).toHaveBeenCalledWith('目标目录已存在同名文件：a.txt，移动已取消')
    expect(store.startMoveTask).not.toHaveBeenCalled()
    // 对话框仍打开
    expect(progress.moveState.visible).toBe(true)
  })

  it('moveFiles：无冲突 → 关闭对话框并启动移动任务', async () => {
    mockedGetFiles.mockResolvedValue({ path: 'docs', files: [] })
    const store = useTaskStore()
    const startMove = vi.spyOn(store, 'startMoveTask').mockImplementation(() => Promise.resolve())

    const progress = useFileProgress()
    progress.showBatchMoveDialog(['a.txt'], ['a.txt'])
    progress.moveState.targetPath = 'docs'
    await progress.moveFile()

    expect(startMove).toHaveBeenCalledWith(['a.txt'], ['a.txt'], '/docs', undefined)
    expect(progress.moveState.visible).toBe(false)
  })

  it('startZipTask 转发到 task store', () => {
    const store = useTaskStore()
    const startCompress = vi.spyOn(store, 'startCompressTask').mockImplementation(() => Promise.resolve())
    const progress = useFileProgress()
    progress.startZipTask('docs')
    expect(startCompress).toHaveBeenCalledWith('docs', undefined)
  })
})
