import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Toolbar from './Toolbar.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ isCyber: false, toggle: vi.fn() }),
}))

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(Toolbar, {
    props: {
      breadcrumbParts: ['projects', 'docs'],
      sortBy: 'name',
      sortOrder: 'asc',
      selectedCount: 0,
      isSingleFileSelected: false,
      isSingleFolderSelected: false,
      ...overrides,
    },
  })
}

describe('Toolbar.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染面包屑路径', () => {
    const wrapper = mountToolbar()
    expect(wrapper.text()).toContain('projects')
    expect(wrapper.text()).toContain('docs')
  })

  it('点击首页图标触发 navigate(-1)', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('.breadcrumb-home').trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual([-1])
  })

  it('点击面包屑分段触发 navigate(index)', async () => {
    const wrapper = mountToolbar()
    // 排除首页图标（breadcrumb-home），分段依次对应 index 0、1...
    const links = wrapper
      .findAll('.breadcrumb .el-link')
      .filter((l) => !l.classes().includes('breadcrumb-home'))
    await links[0].trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual([0])
  })

  it('点击"新建文件夹"触发 create-folder', async () => {
    const wrapper = mountToolbar()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('新建文件夹'))
    await btn!.trigger('click')
    expect(wrapper.emitted('create-folder')).toHaveLength(1)
  })

  it('点击"刷新"触发 refresh', async () => {
    const wrapper = mountToolbar()
    const btn = wrapper.findAll('button').find((b) => b.text().includes('刷新'))
    await btn!.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('无选中时不显示批量操作区', () => {
    const wrapper = mountToolbar()
    expect(wrapper.text()).not.toContain('已选择')
  })

  it('选中 2 项时显示批量操作（删除/移动）', () => {
    const wrapper = mountToolbar({ selectedCount: 2 })
    expect(wrapper.text()).toContain('已选择')
    const text = wrapper.text()
    expect(text).toContain('删除')
    expect(text).toContain('移动')
  })

  it('单选文件时显示"下载"按钮', () => {
    const wrapper = mountToolbar({
      selectedCount: 1,
      isSingleFileSelected: true,
      isSingleFolderSelected: false,
    })
    expect(wrapper.text()).toContain('下载')
    expect(wrapper.text()).not.toContain('压缩')
  })

  it('单选文件夹时显示"压缩"按钮', () => {
    const wrapper = mountToolbar({
      selectedCount: 1,
      isSingleFileSelected: false,
      isSingleFolderSelected: true,
    })
    expect(wrapper.text()).toContain('压缩')
    expect(wrapper.text()).not.toContain('下载')
  })
})
