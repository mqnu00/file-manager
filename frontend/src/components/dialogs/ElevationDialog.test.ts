import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ElevationDialog from './ElevationDialog.vue'
import { useElevation } from '@/composables/useElevation'

vi.mock('@/api/elevation', () => ({
  elevate: vi.fn().mockResolvedValue({ success: true }),
  clearElevation: vi.fn().mockResolvedValue(undefined),
}))

import { elevate } from '@/api/elevation'

let lastWrapper: ReturnType<typeof mount> | null = null

async function mountDialog(): Promise<ReturnType<typeof mount>> {
  // 先卸载上个用例遗留的实例：各用例共享模块级 visible 单例，若残留实例未卸载，
  // 其 el-dialog 会随共享 ref 变化而触发 update:model-value(false)，导致本用例对话框被误关（跨用例串扰）。
  lastWrapper?.unmount()
  lastWrapper = null
  const { visible } = useElevation()
  visible.value = true // 模拟拦截器已打开对话框
  const wrapper = mount(ElevationDialog, {
    global: {
      stubs: { teleport: { template: '<div><slot /></div>' }, transition: false },
    },
  })
  lastWrapper = wrapper
  await new Promise((r) => setTimeout(r, 50))
  return wrapper
}

afterEach(() => {
  vi.clearAllMocks()
  // 恢复默认实现，避免单次拒绝实现在用例间串扰
  vi.mocked(elevate).mockResolvedValue({ success: true })
  const { visible, cancel } = useElevation()
  visible.value = false
  cancel()
  lastWrapper?.unmount()
  lastWrapper = null
})

describe('ElevationDialog.vue', () => {
  it('渲染用户名/密码输入与「归还属主」勾选（默认勾选）', async () => {
    const wrapper = await mountDialog()
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('确认时以勾选状态调用 elevate', async () => {
    const wrapper = await mountDialog()
    await wrapper.findAll('input')[0].setValue('ubuntu')
    await wrapper.findAll('input')[1].setValue('pw123')
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(elevate).toHaveBeenCalledWith('ubuntu', 'pw123', true)
  })

  it('取消勾选时 elevate 的 chownBack 为 false', async () => {
    const wrapper = await mountDialog()
    await wrapper.findAll('input')[0].setValue('ubuntu')
    await wrapper.findAll('input')[1].setValue('pw123')
    await wrapper.find('input[type="checkbox"]').setValue(false)
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(elevate).toHaveBeenCalledWith('ubuntu', 'pw123', false)
  })

  it('elevate 失败时显示错误文案且不关闭', async () => {
    vi.mocked(elevate).mockRejectedValue({ response: { data: { error: '密码错误' } } })
    const wrapper = await mountDialog()
    await wrapper.findAll('input')[0].setValue('ubuntu')
    await wrapper.findAll('input')[1].setValue('bad')
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    await confirm!.trigger('click')
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.text()).toContain('密码错误')
    expect(useElevation().visible.value).toBe(true)
  })

  it('取消按钮不调用 elevate', async () => {
    const wrapper = await mountDialog()
    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancel!.trigger('click')
    expect(elevate).not.toHaveBeenCalled()
  })
})
