import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FileTable from './FileTable.vue'
import type { FileItem } from '@/types'

const baseFiles: FileItem[] = [
  { name: 'docs', path: 'docs', isDirectory: true, size: 4096, modified: '2026-08-01T00:00:00Z' },
  {
    name: 'a.txt',
    path: 'a.txt',
    isDirectory: false,
    size: 2048,
    modified: '2026-08-01T00:00:00Z',
  },
]

async function mountTable(files: FileItem[] = baseFiles) {
  const wrapper = mount(FileTable, {
    props: {
      files,
      loading: false,
      dirSizeCache: {},
      dirSizeLoading: {},
      dirSizeTimeout: {},
    },
  })
  // el-table 的 store 初始化是异步的，等待两轮 nextTick 确保 body 行渲染
  await nextTick()
  await nextTick()
  return wrapper
}

describe('FileTable.vue', () => {
  it('渲染文件与文件夹名称', async () => {
    const wrapper = await mountTable()
    expect(wrapper.text()).toContain('docs')
    expect(wrapper.text()).toContain('a.txt')
  })

  it('文件大小格式化显示', async () => {
    const wrapper = await mountTable()
    expect(wrapper.text()).toContain('2.00 KB')
  })

  it('点击文件夹名触发 open 事件', async () => {
    const wrapper = await mountTable()
    const folderName = wrapper.findAll('.file-name-text').find((w) => w.text() === 'docs')
    await folderName!.trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual(['docs'])
  })

  it('点击文件名不触发 open 事件', async () => {
    const wrapper = await mountTable()
    const fileName = wrapper.findAll('.file-name-text').find((w) => w.text() === 'a.txt')
    await fileName!.trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('右键行触发 contextmenu 事件（阻止默认行为）', async () => {
    const wrapper = await mountTable()
    const row = wrapper.find('.el-table__row')
    const preventDefault = vi.fn()
    await row.trigger('contextmenu', { preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    expect(wrapper.emitted('contextmenu')).toHaveLength(1)
  })

  it('broken 文件渲染失效标记', async () => {
    const wrapper = await mountTable([
      {
        name: 'link',
        path: 'link',
        isDirectory: false,
        size: 0,
        modified: '',
        broken: true,
      },
    ])
    expect(wrapper.text()).toContain('符号链接，目标不存在')
  })

  it('文件夹大小：未计算时显示"计算"按钮，点击触发 load-dir-size', async () => {
    const wrapper = await mountTable()
    const calcBtn = wrapper.findAll('button').find((b) => b.text().includes('计算'))
    expect(calcBtn).toBeTruthy()
    await calcBtn!.trigger('click')
    expect(wrapper.emitted('load-dir-size')?.[0]).toEqual(['docs'])
  })
})
