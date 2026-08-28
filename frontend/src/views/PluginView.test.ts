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
  unloadPluginFrontend: vi.fn(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  // ElMessageBox 既可作为函数调用 ElMessageBox({...})，也有 .alert/.confirm 静态方法
  const mockMessageBox = Object.assign(
    vi.fn().mockResolvedValue('confirm'),
    { alert: vi.fn(), confirm: vi.fn().mockResolvedValue('confirm'), prompt: vi.fn() }
  )
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ElMessageBox: mockMessageBox,
  }
})

import PluginView from './PluginView.vue'
import { getPlugins, loadPlugin, unloadPlugin, searchPlugins, deletePlugin } from '@/api/plugins'
import { loadPluginFrontend, unloadPluginFrontend } from '@/pluginLoader'
import { ElMessage, ElMessageBox } from 'element-plus'

const mockedGetPlugins = vi.mocked(getPlugins)
const mockedLoadPlugin = vi.mocked(loadPlugin)
const mockedUnloadPlugin = vi.mocked(unloadPlugin)
const mockedSearchPlugins = vi.mocked(searchPlugins)
const mockedDeletePlugin = vi.mocked(deletePlugin)
const mockedLoadFrontend = vi.mocked(loadPluginFrontend)
const mockedUnloadFrontend = vi.mocked(unloadPluginFrontend)
const mockedConfirm = vi.mocked(ElMessageBox.confirm)

const installedPlugins: PluginInfo[] = [
  { name: 'smb', enabled: true, local: true, source: 'local', frontendPath: null, frontendPage: null, version: '1.2.0' },
  { name: 'test', enabled: false, local: true, source: 'local', frontendPath: '/plugins-assets/test/frontend/index.js', frontendPage: null, version: '0.3.0' },
  { name: 'abc', enabled: false, local: false, source: 'npm', frontendPath: null, frontendPage: null, version: '2.1.0' },
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
        PluginVersionSelect: {
          template:
            '<div class="pvs-stub" :data-pkg="packageName" :data-installed-version="installedVersion" />',
          props: ['packageName', 'installedVersion'],
        },
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
    const loaded: PluginInfo = { name: 'test', enabled: true, local: true, source: 'local', frontendPath: '/plugins-assets/test/frontend/index.js', frontendPage: null, version: '0.3.0' }
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

  it('卸载：前端先行清理（unloadPluginFrontend）再卸载后端并刷新列表', async () => {
    const wrapper = await mountView()
    mockedGetPlugins.mockClear()
    await rowButton(wrapper, 'smb', '卸载').trigger('click')
    await flushPromises()
    expect(mockedConfirm).toHaveBeenCalled()
    // teardown 契约：前端实例先清理（路由/主题/teardown），后端随后卸载
    expect(mockedUnloadFrontend).toHaveBeenCalledWith('smb')
    expect(mockedUnloadPlugin).toHaveBeenCalledWith('smb')
    expect(mockedGetPlugins).toHaveBeenCalled()
  })

  it('卸载：取消后不调用 unloadPlugin 与 unloadPluginFrontend', async () => {
    mockedConfirm.mockRejectedValue(new Error('cancel'))
    const wrapper = await mountView()
    await rowButton(wrapper, 'smb', '卸载').trigger('click')
    await flushPromises()
    expect(mockedUnloadPlugin).not.toHaveBeenCalled()
    expect(mockedUnloadFrontend).not.toHaveBeenCalled()
  })

  it('重载：前端先清理 → 后端卸载+加载 → 重新加载前端', async () => {
    const reloaded: PluginInfo = { name: 'smb', enabled: true, local: true, source: 'local', frontendPath: '/plugins-assets/smb/frontend/index.js', frontendPage: '/plugin/smb', version: '1.2.0' }
    mockedLoadPlugin.mockResolvedValue(reloaded)
    const wrapper = await mountView()
    await rowButton(wrapper, 'smb', '重载').trigger('click')
    await flushPromises()
    // 顺序：前端卸载 → 后端卸载 → 后端加载 → 前端加载
    expect(mockedUnloadFrontend).toHaveBeenCalledWith('smb')
    expect(mockedUnloadPlugin).toHaveBeenCalledWith('smb')
    expect(mockedLoadPlugin).toHaveBeenCalledWith('smb')
    expect(mockedLoadFrontend).toHaveBeenCalledWith(reloaded)
  })

  it('卸载进行中：整卡遮罩 + 操作按钮禁用；完成后恢复', async () => {
    let resolveUnload!: () => void
    mockedUnloadPlugin.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUnload = resolve
      })
    )
    const wrapper = await mountView()
    await rowButton(wrapper, 'smb', '卸载').trigger('click')
    await flushPromises()

    // 后端卸载挂起中 → 忙状态：遮罩出现、其他操作按钮禁用
    expect(wrapper.find('.el-loading-mask').exists()).toBe(true)
    expect(wrapper.find('.el-loading-text').text()).toContain('正在卸载插件')
    const loadBtn = rowButton(wrapper, 'test', '加载')
    expect(loadBtn.attributes('disabled')).toBeDefined()

    // 卸载完成 → 忙状态解除（按钮恢复可用；遮罩自身带 300ms 淡出过渡，不在此断言）
    resolveUnload()
    await flushPromises()
    expect(rowButton(wrapper, 'test', '加载').attributes('disabled')).toBeUndefined()
    expect(ElMessage.success).toHaveBeenCalledWith('插件 "smb" 已卸载')
  })

  it('重载进行中：前端重装（loadPluginFrontend）完成前遮罩保持', async () => {
    let resolveFrontend!: () => void
    const reloaded: PluginInfo = { name: 'smb', enabled: true, local: true, source: 'local', frontendPath: '/plugins-assets/smb/frontend/index.js', frontendPage: '/plugin/smb', version: '1.2.0' }
    mockedLoadPlugin.mockResolvedValue(reloaded)
    mockedLoadFrontend.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFrontend = resolve
      })
    )
    const wrapper = await mountView()
    await rowButton(wrapper, 'smb', '重载').trigger('click')
    await flushPromises()

    // 后端已重载、前端重装挂起 → 仍处于忙状态
    expect(mockedLoadFrontend).toHaveBeenCalled()
    expect(wrapper.find('.el-loading-mask').exists()).toBe(true)
    expect(wrapper.find('.el-loading-text').text()).toContain('正在重载插件')

    // 前端重装完成 → 忙状态解除（按钮恢复可用；遮罩自身带淡出过渡，不在此断言）
    resolveFrontend()
    await flushPromises()
    expect(rowButton(wrapper, 'smb', '卸载').attributes('disabled')).toBeUndefined()
    expect(ElMessage.success).toHaveBeenCalledWith('插件 "smb" 已重载')
  })

  it('删除：npm 插件确认后调用 deletePlugin', async () => {
    mockedDeletePlugin.mockResolvedValue(undefined as never)
    const wrapper = await mountView()
    await rowButton(wrapper, 'abc', '删除').trigger('click')
    await flushPromises()
    // 确认对话框以 ElMessageBox({...}) 函数形式调用（非 .confirm）
    expect(ElMessageBox).toHaveBeenCalled()
    expect(mockedDeletePlugin).toHaveBeenCalledWith('abc', false)
  })

  it('搜索 → searchPlugins 结果渲染', async () => {
    mockedSearchPlugins.mockResolvedValue({
      total: 1,
      results: [
        {
          name: '@mqn00/file-manager-plugin-smb',
          version: '1.0.0',
          description: 'SMB 共享插件',
          publisher: 'mqn00',
          date: '2026-01-01',
          links: { npm: 'https://npmjs.com/x' },
        },
      ],
    })
    const wrapper = await mountView()
    const searchInput = wrapper.get('input[placeholder="搜索 npm registry 中的插件…"]')
    await searchInput.setValue('smb')
    await searchInput.trigger('keyup.enter')
    await flushPromises()
    expect(mockedSearchPlugins).toHaveBeenCalledWith('smb', 1, 20)
    expect(wrapper.text()).toContain('@mqn00/file-manager-plugin-smb')
    expect(wrapper.text()).toContain('SMB 共享插件')
  })

  it('搜索：已安装插件的版本下拉框传入当前版本', async () => {
    // @mqn00/file-manager-plugin-smb 的 shortName 为 smb，已安装插件 smb 版本 1.2.0
    mockedSearchPlugins.mockResolvedValue({
      total: 1,
      results: [
        {
          name: '@mqn00/file-manager-plugin-smb',
          version: '3.0.0',
          description: 'SMB 共享插件',
          publisher: 'mqn00',
          date: '2026-01-01',
          links: { npm: 'https://npmjs.com/x' },
        },
      ],
    })
    const wrapper = await mountView()
    const searchInput = wrapper.get('input[placeholder="搜索 npm registry 中的插件…"]')
    await searchInput.setValue('smb')
    await searchInput.trigger('keyup.enter')
    await flushPromises()

    const select = wrapper.find('.pvs-stub')
    expect(select.attributes('data-pkg')).toBe('@mqn00/file-manager-plugin-smb')
    expect(select.attributes('data-installed-version')).toBe('1.2.0')
  })

  it('搜索：结果超过一页时渲染分页组件，翻页触发带 page 的请求', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      name: `file-manager-plugin-p${i}`,
      version: '1.0.0',
      description: `插件 ${i}`,
      publisher: 'mqn00',
      date: '2026-01-01',
      links: { npm: 'https://npmjs.com/x' },
    }))
    mockedSearchPlugins.mockResolvedValue({ total: 45, results: items })
    const wrapper = await mountView()
    const searchInput = wrapper.get('input[placeholder="搜索 npm registry 中的插件…"]')
    await searchInput.setValue('smb')
    await searchInput.trigger('keyup.enter')
    await flushPromises()

    const pagination = wrapper.getComponent({ name: 'ElPagination' })
    pagination.vm.$emit('update:current-page', 2)
    pagination.vm.$emit('current-change', 2)
    await flushPromises()
    expect(mockedSearchPlugins).toHaveBeenLastCalledWith('smb', 2, 20)

    // 每页条数变化：页码重置为 1
    pagination.vm.$emit('update:page-size', 50)
    pagination.vm.$emit('size-change', 50)
    await flushPromises()
    expect(mockedSearchPlugins).toHaveBeenLastCalledWith('smb', 1, 50)
  })

  it('搜索：结果不足一页时不渲染分页组件', async () => {
    mockedSearchPlugins.mockResolvedValue({
      total: 3,
      results: [
        {
          name: '@mqn00/file-manager-plugin-smb',
          version: '1.0.0',
          description: 'SMB 共享插件',
          publisher: 'mqn00',
          date: '2026-01-01',
          links: { npm: 'https://npmjs.com/x' },
        },
      ],
    })
    const wrapper = await mountView()
    const searchInput = wrapper.get('input[placeholder="搜索 npm registry 中的插件…"]')
    await searchInput.setValue('smb')
    await searchInput.trigger('keyup.enter')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElPagination' }).exists()).toBe(false)
  })
})
