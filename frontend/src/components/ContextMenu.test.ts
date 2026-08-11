import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextMenu from './ContextMenu.vue'
import type { FileItem } from '@/types'

const row: FileItem = {
  name: 'a.txt',
  path: 'a.txt',
  isDirectory: false,
  size: 0,
  modified: '',
}

function mountMenu(rowValue: FileItem | null) {
  return mount(ContextMenu, { props: { x: 10, y: 20, row: rowValue } })
}

describe('ContextMenu.vue', () => {
  it('有 row 时显示重命名/新建文件夹/刷新三项', () => {
    const wrapper = mountMenu(row)
    const items = wrapper.findAll('.context-menu-item')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('重命名')
    expect(items[1].text()).toContain('新建文件夹')
    expect(items[2].text()).toContain('刷新')
  })

  it('无 row 时不显示重命名项', () => {
    const wrapper = mountMenu(null)
    const items = wrapper.findAll('.context-menu-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).not.toContain('重命名')
  })

  it('点击菜单项触发对应事件', async () => {
    const wrapper = mountMenu(row)
    const items = wrapper.findAll('.context-menu-item')
    await items[0].trigger('click')
    expect(wrapper.emitted('rename')).toHaveLength(1)
    await items[1].trigger('click')
    expect(wrapper.emitted('create-folder')).toHaveLength(1)
    await items[2].trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('应用坐标样式', () => {
    const wrapper = mountMenu(row)
    expect(wrapper.find('.context-menu').attributes('style')).toContain('top: 20px')
    expect(wrapper.find('.context-menu').attributes('style')).toContain('left: 10px')
  })
})
