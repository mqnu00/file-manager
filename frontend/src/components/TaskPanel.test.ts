import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import TaskPanel from './TaskPanel.vue'
import { useTaskStore } from '@/stores/task'
import type { TaskInfo } from '@/types'

vi.mock('@/api/task', () => ({
  startMoveTask: vi.fn(),
  getTasks: vi.fn(),
  cancelTask: vi.fn(),
  subscribeTask: vi.fn(() => vi.fn()),
}))

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: 't1',
    type: 'move',
    status: 'running',
    phase: 'copy',
    progress: 50,
    speed: 0,
    totalSize: 0,
    startTime: Date.now(),
    metadata: { sourcePaths: ['a.txt'], sourceNames: ['a.txt'], targetPath: 'docs' },
    completedCount: 0,
    totalCount: 1,
    totalItemCount: 1,
    processedItemCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('TaskPanel.vue', () => {
  it('无任务时显示折叠徽章', async () => {
    const wrapper = mount(TaskPanel)
    await nextTick()
    expect(wrapper.find('.task-badge').exists()).toBe(true)
    expect(wrapper.text()).toContain('后台任务')
  })

  it('running 移动任务渲染卡片（文案/阶段/进度）', async () => {
    const store = useTaskStore()
    store.tasks.push(makeTask())
    const wrapper = mount(TaskPanel)
    await nextTick()
    expect(wrapper.find('.task-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('移动 1 项到 docs')
    expect(wrapper.text()).toContain('移动中...')
  })

  it('任务完成后自动折叠回徽章', async () => {
    const store = useTaskStore()
    store.tasks.push(makeTask())
    const wrapper = mount(TaskPanel)
    await nextTick()
    expect(wrapper.find('.task-card').exists()).toBe(true)

    store.tasks[0].status = 'completed'
    await nextTick()
    expect(wrapper.find('.task-card').exists()).toBe(false)
    expect(wrapper.find('.task-badge').exists()).toBe(true)
  })

  it('点击取消调用 store.cancelTask', async () => {
    const store = useTaskStore()
    store.tasks.push(makeTask({ id: 'cancel-1' }))
    vi.spyOn(store, 'cancelTask').mockImplementation(() => Promise.resolve())
    const wrapper = mount(TaskPanel)
    await nextTick()

    await wrapper.find('.task-card__footer button').trigger('click')
    expect(store.cancelTask).toHaveBeenCalledWith('cancel-1')
  })
})
