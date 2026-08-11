import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveFileDialog from './MoveFileDialog.vue'

async function mountDialog(overrides: Record<string, unknown> = {}) {
  const wrapper = mount(MoveFileDialog, {
    props: {
      modelValue: true,
      sourceNames: ['a.txt', 'docs'],
      targetPath: '/',
      ...overrides,
    },
    global: {
      // PathSelector 依赖 el-tree + getFolders API，测试中 stub 掉
      stubs: {
        teleport: { template: '<div><slot /></div>' },
        transition: false,
        PathSelector: { template: '<div class="path-selector-stub" />' },
      },
    },
  })
  await new Promise((r) => setTimeout(r, 50))
  return wrapper
}

describe('MoveFileDialog.vue', () => {
  it('渲染标题（含选中数量）与提示信息', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.text()).toContain('移动 (2 项)')
    expect(wrapper.text()).toContain('已选择 2 个文件/文件夹')
  })

  it('渲染目标路径选择器（stub）', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('.path-selector-stub').exists()).toBe(true)
  })

  it('点击确定触发 confirm', async () => {
    const wrapper = await mountDialog()
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('点击取消触发 update:model-value false', async () => {
    const wrapper = await mountDialog()
    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancel!.trigger('click')
    expect(wrapper.emitted('update:model-value')?.[0]).toEqual([false])
  })
})
