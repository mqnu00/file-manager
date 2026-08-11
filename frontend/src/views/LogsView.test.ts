import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/file', () => ({
  getLogs: vi.fn(),
  getAvailableLogDates: vi.fn(),
}))

import LogsView from './LogsView.vue'
import { getLogs, getAvailableLogDates } from '@/api/file'

const mockedGetLogs = vi.mocked(getLogs)
const mockedGetDates = vi.mocked(getAvailableLogDates)

const today = new Date().toISOString().split('T')[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetDates.mockResolvedValue({ dates: [today] })
  mockedGetLogs.mockResolvedValue({
    logs: [
      { time: '2026-08-11 01:23:45 UTC', level: 'INFO', action: 'login', detail: '登录成功' },
      { time: '2026-08-11 02:00:00 UTC', level: 'ERROR', action: 'delete', detail: '删除失败: EACCES' },
    ],
    total: 2,
  })
})

async function mountView() {
  const wrapper = mount(LogsView, {
    global: { stubs: { teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  return wrapper
}

describe('LogsView.vue', () => {
  it('mount 时加载可用日期与日志列表并渲染', async () => {
    const wrapper = await mountView()
    expect(mockedGetDates).toHaveBeenCalled()
    expect(mockedGetLogs).toHaveBeenCalledWith({
      startDate: today,
      endDate: today,
      level: undefined,
      action: undefined,
      keyword: undefined,
      page: 1,
      pageSize: 50,
    })
    expect(wrapper.text()).toContain('登录成功')
    expect(wrapper.text()).toContain('删除失败: EACCES')
  })

  it('输入关键词点搜索 → getLogs 携带 keyword', async () => {
    const wrapper = await mountView()
    mockedGetLogs.mockClear()
    const keywordInput = wrapper.get('input[placeholder="关键词搜索"]')
    await keywordInput.setValue('EACCES')
    const searchBtn = wrapper.findAll('button').find((b) => b.text() === '搜索')
    await searchBtn!.trigger('click')
    await flushPromises()
    expect(mockedGetLogs).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'EACCES' }))
  })

  it('选择级别后搜索 → getLogs 携带 level', async () => {
    const wrapper = await mountView()
    mockedGetLogs.mockClear()
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    // 第一个 select 是级别过滤
    selects[0].vm.$emit('update:modelValue', 'ERROR')
    await flushPromises()
    const searchBtn = wrapper.findAll('button').find((b) => b.text() === '搜索')
    await searchBtn!.trigger('click')
    await flushPromises()
    expect(mockedGetLogs).toHaveBeenCalledWith(expect.objectContaining({ level: 'ERROR' }))
  })

  it('翻页 → getLogs 携带新页码', async () => {
    const wrapper = await mountView()
    mockedGetLogs.mockClear()
    const pagination = wrapper.getComponent({ name: 'ElPagination' })
    pagination.vm.$emit('update:current-page', 2)
    pagination.vm.$emit('current-change', 2)
    await flushPromises()
    expect(mockedGetLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('getLogs 失败 → 列表清空且 total 为 0', async () => {
    mockedGetLogs.mockRejectedValue(new Error('500'))
    const wrapper = await mountView()
    expect(wrapper.text()).not.toContain('登录成功')
    expect(wrapper.text()).toContain('Total 0')
  })
})
