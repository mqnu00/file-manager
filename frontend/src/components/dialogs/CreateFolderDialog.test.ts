import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateFolderDialog from './CreateFolderDialog.vue'

async function mountDialog(overrides: Record<string, unknown> = {}) {
  const wrapper = mount(CreateFolderDialog, {
    props: { modelValue: true, folderName: '', ...overrides },
    global: {
      // el-dialog 使用 Teleport（stub 渲染 slot）；transition 真实运行以触发懒渲染，
      // 但 enter 钩子在 rAF 中异步完成，需等待过渡结束
      stubs: { teleport: { template: '<div><slot /></div>' }, transition: false },
    },
  })
  await new Promise((r) => setTimeout(r, 50))
  return wrapper
}

describe('CreateFolderDialog.vue', () => {
  it('渲染标题与输入框', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.get('input').attributes('placeholder')).toBe('请输入文件夹名称')
  })

  it('输入更新触发 update:folder-name', async () => {
    const wrapper = await mountDialog()
    await wrapper.get('input').setValue('my-folder')
    expect(wrapper.emitted('update:folder-name')?.[0]).toEqual(['my-folder'])
  })

  it('点击确定触发 confirm', async () => {
    const wrapper = await mountDialog()
    const buttons = wrapper.findAll('button')
    const confirm = buttons.find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('点击取消触发 update:model-value false', async () => {
    const wrapper = await mountDialog()
    const buttons = wrapper.findAll('button')
    const cancel = buttons.find((b) => b.text() === '取消')
    await cancel!.trigger('click')
    expect(wrapper.emitted('update:model-value')?.[0]).toEqual([false])
  })

  it('回车触发 confirm', async () => {
    const wrapper = await mountDialog()
    await wrapper.get('input').trigger('keyup.enter')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
