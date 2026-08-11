import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RenameDialog from './RenameDialog.vue'

async function mountDialog(overrides: Record<string, unknown> = {}) {
  const wrapper = mount(RenameDialog, {
    props: { modelValue: true, newName: '', ...overrides },
    global: {
      // el-dialog 使用 Teleport（stub 渲染 slot）；transition 真实运行以触发懒渲染
      stubs: { teleport: { template: '<div><slot /></div>' }, transition: false },
    },
  })
  await new Promise((r) => setTimeout(r, 50))
  return wrapper
}

describe('RenameDialog.vue', () => {
  it('渲染标题与输入框（含当前名称）', async () => {
    const wrapper = await mountDialog({ newName: 'old.txt' })
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.get('input').attributes('placeholder')).toBe('请输入新名称')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('old.txt')
  })

  it('输入更新触发 update:new-name', async () => {
    const wrapper = await mountDialog()
    await wrapper.get('input').setValue('new-name.txt')
    expect(wrapper.emitted('update:new-name')?.[0]).toEqual(['new-name.txt'])
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
