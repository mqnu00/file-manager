import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PathSelector from './PathSelector.vue'

vi.mock('@/api/file', () => ({
  getFolders: vi.fn(),
}))

import { getFolders } from '@/api/file'

const mockedGetFolders = vi.mocked(getFolders)

async function mountSelector() {
  const wrapper = mount(PathSelector, {
    props: { modelValue: '/', placeholder: '选择目标文件夹' },
    global: {
      stubs: { teleport: { template: '<div><slot /></div>' }, transition: false },
    },
  })
  await new Promise((r) => setTimeout(r, 50))
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PathSelector.vue', () => {
  it('渲染只读输入框与占位符', async () => {
    const wrapper = await mountSelector()
    const input = wrapper.get('input')
    expect(input.attributes('readonly')).toBeDefined()
    expect(input.attributes('placeholder')).toBe('选择目标文件夹')
  })

  it('点击输入框打开树对话框并加载根文件夹', async () => {
    mockedGetFolders.mockResolvedValue([
      { name: 'docs', path: 'docs', isDirectory: true, size: 0, modified: '' },
      { name: 'empty', path: 'empty', isDirectory: true, size: 0, modified: '' },
    ])
    const wrapper = await mountSelector()
    await wrapper.get('input').trigger('click')
    await new Promise((r) => setTimeout(r, 100)) // 等 el-tree 懒加载根节点

    expect(mockedGetFolders).toHaveBeenCalledWith('')
    expect(wrapper.text()).toContain('选择目标文件夹')
    expect(wrapper.text()).toContain('docs')
    expect(wrapper.text()).toContain('empty')
  })

  it('选择节点并确定 → emit update:model-value', async () => {
    mockedGetFolders.mockResolvedValue([
      { name: 'docs', path: 'docs', isDirectory: true, size: 0, modified: '' },
    ])
    const wrapper = await mountSelector()
    await wrapper.get('input').trigger('click')
    await new Promise((r) => setTimeout(r, 100))

    await wrapper.find('.el-tree-node__content').trigger('click')
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    // 组件 emit('update:modelValue')（camelCase），模板监听 kebab-case 由 Vue 自动匹配
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['docs'])
  })

  it('取消关闭对话框且不 emit', async () => {
    mockedGetFolders.mockResolvedValue([])
    const wrapper = await mountSelector()
    await wrapper.get('input').trigger('click')
    await new Promise((r) => setTimeout(r, 100))
    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancel!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
