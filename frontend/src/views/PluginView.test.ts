import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { PluginInfo } from '@/api/plugins'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/plugins', () => ({
  getPlugins: vi.fn(),
  loadPlugin: vi.fn(),
  unloadPlugin: vi.fn(),
  searchPlugins: vi.fn(),
  getPluginVersions: vi.fn(),
  installPlugin: vi.fn(),
  deletePlugin: vi.fn(),
}))

vi.mock('@/pluginLoader', () => ({
  loadPluginFrontend: vi.fn(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ElMessageBox: { alert: vi.fn(), confirm: vi.fn() },
  }
})

import PluginView from './PluginView.vue'
import { getPlugins, loadPlugin, unloadPlugin, searchPlugins, deletePlugin } from '@/api/plugins'
import { loadPluginFrontend } from '@/pluginLoader'
import { ElMessage, ElMessageBox } from 'element-plus'

const mockedGetPlugins = vi.mocked(getPlugins)
const mockedLoadPlugin = vi.mocked(loadPlugin)
const mockedUnloadPlugin = vi.mocked(unloadPlugin)
const mockedSearchPlugins = vi.mocked(searchPlugins)
const mockedDeletePlugin = vi.mocked(deletePlugin)
const mockedLoadFrontend = vi.mocked(loadPluginFrontend)
const mockedConfirm = vi.mocked(ElMessageBox.confirm)

const installedPlugins: PluginInfo[] = [
  { name: 'smb', enabled: true, local: true, source: 'local', frontendPath: null },
  { name: 'test', enabled: false, local: true, source: 'local', frontendPath: '/plugins-assets/test/frontend/index.js' },
  { name: 'abc', enabled: false, local: false, source: 'npm', frontendPath: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetPlugins.mockResolvedValue(JSON.parse(JSON.stringify(installedPlugins)))
  mockedConfirm.mockResolvedValue('confirm')
})

async function mountView() {
  const wrapper = mount(PluginView, {
    global: {
      stubs: {
        PluginVersionSelect: { template: '<div class="pvs-stub" />' },
        teleport: { template: '<div><slot /></div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function rowButton(wrapper: any, rowText: string, btnText: string) {
  const row = wrapper.findAll('tr').find((r: any) => r.text().includes(rowText))
  expect(row, `未找到 ${rowText} 所在行`).toBeTruthy()
  const btn = row!.findAll('button').find((b: any) => b.text() === btnText)
  expect(btn, `未找到按钮 ${btnText}`).toBeTruthy()
  return btn!
}

describe('PluginView.vue', () => {
  it('mount → getPlugins 渲染已安装列表', async () => {
    const wrapper = await mountView()
    expect(mockedGetPlugins).toHaveBeenCalled()
    const text = wrapper.text()
    expect(text).toContain('3 个已配置')
    expect(text).toContain('smb')
    expect(text).toContain('已启用')
    expect(text).toContain('已禁用')
    expect(text).toContain('本地开发')
    expect(text).toContain('npm 包')
  })

  it('加载插件 → loadPlugin 调用 + 成功提示 + 有 frontendPath 时加载前端', async () => {
    const loaded: PluginInfo = { name: 'test', enabled: true, local: true, source: 'local', frontendPath: '/plugins-assets/test/frontend/index.js' }
    mockedLoadPlugin.mockResolvedValue(loaded)
    const wrapper = await mountView()
    await rowButton(wrapper, 'test', '加载').trigger('click')
    await flushPromises()
    expect(mockedLoadPlugin).toHaveBeenCalledWith('test')
    expect(ElMessage.success).toHaveBeenCalledWith('插件 "test" 已加载')
    expect(mockedLoadFrontend).toHaveBeenCalledWith(loaded)
  })

  it('加载失败 → 错误提示', async () => {
    mockedLoadPlugin.mockRejectedValue({ response: { data: { error: '入口缺失' } } })
    const wrapper = await mountView()
    await rowButton(wrapper, 'test', '加载').trigger('click')
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('加载失败: 入口缺失')
  })

  it('卸载：确认后调用 unloadPlugin 并刷新列表', async () => {
    const wrapper = await mountView()
    mockedGetPlugins.mockClear()
    await rowButton(wrapper, 'smb', '卸载').trigger('click')
    await flushPromises()
    expect(mockedConfirm).toHaveBeenCalled()
    expect(mockedUnloadPlugin).toHaveBeenCalledWith('smb')
    expect(mockedGetPlugins).toHaveBeenCalled()
  })

  it('卸载：取消后不调用 unloadPlugin', async () => {
    mockedConfirm.mockRejectedValue(new Error('cancel'))
    const wrapper = await mountView()
    await rowButton(wrapper, 'smb', '卸载').trigger('click')
    await flushPromises()
    expect(mockedUnloadPlugin).not.toHaveBeenCalled()
  })

  it('删除：npm 插件确认后调用 deletePlugin', async () => {
    mockedDeletePlugin.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await rowButton(wrapper, 'abc', '删除').trigger('click')
    await flushPromises()
    expect(mockedConfirm).toHaveBeenCalled()
    expect(mockedDeletePlugin).toHaveBeenCalledWith('abc')
  })

  it('搜索 → searchPlugins 结果渲染', async () => {
    mockedSearchPlugins.mockResolvedValue([
      {
        name: '@mqn00/file-manager-plugin-smb',
        version: '1.0.0',
        description: 'SMB 共享插件',
        publisher: 'mqn00',
        date: '2026-01-01',
        links: { npm: 'https://npmjs.com/x' },
      },
    ])
    const wrapper = await mountView()
    const searchInput = wrapper.get('input[placeholder="搜索 npm registry 中的插件…"]')
    await searchInput.setValue('smb')
    await searchInput.trigger('keyup.enter')
    await flushPromises()
    expect(mockedSearchPlugins).toHaveBeenCalledWith('smb')
    expect(wrapper.text()).toContain('@mqn00/file-manager-plugin-smb')
    expect(wrapper.text()).toContain('SMB 共享插件')
  })
})
