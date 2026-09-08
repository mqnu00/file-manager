import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const routerReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: routerReplace }),
}))

const authMock = { clearSession: vi.fn() }

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('@/api/config', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  cleanLogs: vi.fn(),
}))

vi.mock('@/api/system', () => ({
  getSystemInfo: vi.fn(),
  checkUpdate: vi.fn(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ElMessageBox: { alert: vi.fn(), confirm: vi.fn() },
  }
})

import ConfigView from './ConfigView.vue'
import { getConfig, updateConfig, cleanLogs } from '@/api/config'
import { getSystemInfo, checkUpdate } from '@/api/system'
import { ElMessage, ElMessageBox } from 'element-plus'

const mockedGetConfig = vi.mocked(getConfig)
const mockedUpdateConfig = vi.mocked(updateConfig)
const mockedCleanLogs = vi.mocked(cleanLogs)
const mockedGetSystemInfo = vi.mocked(getSystemInfo)
const mockedCheckUpdate = vi.mocked(checkUpdate)
const mockedAlert = vi.mocked(ElMessageBox.alert)

const fakeConfig = {
  auth: { token: '****abcd', tokenExpiryHours: 24 },
  storageRoot: '/data',
  log: { cleanupOnStartup: true, retentionDays: 30 },
  pluginInstallDir: '/plugins',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetConfig.mockResolvedValue(JSON.parse(JSON.stringify(fakeConfig)))
  mockedUpdateConfig.mockResolvedValue({ success: true, config: JSON.parse(JSON.stringify(fakeConfig)), sessionsCleared: false })
  mockedCleanLogs.mockResolvedValue({ success: true, deleted: 3 })
  mockedGetSystemInfo.mockResolvedValue({
    version: '3.0.2',
    repoUrl: 'https://github.com/mqnu00/file-manager',
  })
  mockedCheckUpdate.mockResolvedValue({ current: '3.0.2', latest: '3.0.2', hasUpdate: false })
  mockedAlert.mockResolvedValue(undefined)
})

async function mountView() {
  const wrapper = mount(ConfigView)
  await flushPromises()
  return wrapper
}

function findButton(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text().trim() === text)
}

describe('ConfigView.vue', () => {
  it('mount 加载配置并回显（令牌脱敏/storageRoot/安装目录）', async () => {
    const wrapper = await mountView()
    expect(mockedGetConfig).toHaveBeenCalled()
    expect(wrapper.text()).toContain('当前令牌：****abcd')
    const storageInput = wrapper.get('input[placeholder="留空使用项目根目录"]')
    expect((storageInput.element as HTMLInputElement).value).toBe('/data')
    const pluginDirInput = wrapper.get('input[placeholder="~/.file-manager/node_modules"]')
    expect((pluginDirInput.element as HTMLInputElement).value).toBe('/plugins')
  })

  it('无修改时保存 → 提示"没有修改"，不调用 updateConfig', async () => {
    const wrapper = await mountView()
    await findButton(wrapper, '保存配置')!.trigger('click')
    await flushPromises()
    expect(ElMessage.info).toHaveBeenCalledWith('没有修改')
    expect(mockedUpdateConfig).not.toHaveBeenCalled()
  })

  it('修改存储根目录后保存 → updateConfig 携带正确 body', async () => {
    const wrapper = await mountView()
    await wrapper.get('input[placeholder="留空使用项目根目录"]').setValue('/new-data')
    await findButton(wrapper, '保存配置')!.trigger('click')
    await flushPromises()
    expect(mockedUpdateConfig).toHaveBeenCalledWith({ auth: {}, storageRoot: '/new-data' })
    expect(ElMessage.success).toHaveBeenCalledWith('配置已保存')
  })

  it('保存后 sessionsCleared=true → 提示重新登录并跳转 /login', async () => {
    mockedUpdateConfig.mockResolvedValue({ success: true, config: fakeConfig, sessionsCleared: true })
    const wrapper = await mountView()
    await wrapper.get('input[placeholder="留空使用项目根目录"]').setValue('/new-data')
    await findButton(wrapper, '保存配置')!.trigger('click')
    await flushPromises()
    expect(mockedAlert).toHaveBeenCalled()
    expect(authMock.clearSession).toHaveBeenCalled()
    expect(routerReplace).toHaveBeenCalledWith('/login')
  })

  it('执行清理 → cleanLogs 调用并显示清理数量', async () => {
    const wrapper = await mountView()
    await findButton(wrapper, '执行清理')!.trigger('click')
    await flushPromises()
    expect(mockedCleanLogs).toHaveBeenCalled()
    expect(ElMessage.success).toHaveBeenCalledWith('已清理 3 个过期日志文件')
    expect(wrapper.text()).toContain('已清理 3 个过期日志文件')
  })

  it('getConfig 失败 → 提示获取配置失败', async () => {
    mockedGetConfig.mockRejectedValue(new Error('500'))
    await mountView()
    expect(ElMessage.error).toHaveBeenCalledWith('获取配置失败')
  })
})

describe('ConfigView.vue 关于区块', () => {
  it('mount 加载系统信息并显示当前版本与项目地址', async () => {
    const wrapper = await mountView()
    expect(mockedGetSystemInfo).toHaveBeenCalled()
    expect(wrapper.text()).toContain('v3.0.2')
    const link = wrapper.get('a.about-link')
    expect(link.attributes('href')).toBe('https://github.com/mqnu00/file-manager')
  })

  it('getSystemInfo 失败 → 静默降级，不影响配置页', async () => {
    mockedGetSystemInfo.mockRejectedValue(new Error('500'))
    const wrapper = await mountView()
    expect(mockedGetConfig).toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('获取配置失败') // 关于失败不提示，配置加载照常
  })

  it('检测更新 → 已是最新版本提示', async () => {
    const wrapper = await mountView()
    await findButton(wrapper, '检测更新')!.trigger('click')
    await flushPromises()
    expect(mockedCheckUpdate).toHaveBeenCalled()
    expect(wrapper.text()).toContain('已是最新版本（v3.0.2）')
  })

  it('检测更新 → 发现新版本时显示版本号与升级命令', async () => {
    mockedCheckUpdate.mockResolvedValue({
      current: '3.0.2',
      latest: '3.1.0',
      hasUpdate: true,
      releaseUrl: 'https://github.com/mqnu00/file-manager/releases/tag/v3.1.0',
    })
    const wrapper = await mountView()
    await findButton(wrapper, '检测更新')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('可更新到 v3.1.0')
    expect(wrapper.text()).toContain('发现新版本 v3.1.0（当前 v3.0.2）')
    expect(wrapper.get('a.about-link[href*="releases/tag/v3.1.0"]').attributes('href')).toBe(
      'https://github.com/mqnu00/file-manager/releases/tag/v3.1.0'
    )
    expect(wrapper.text()).toContain('npm i -g @mqn00/file-manager')
  })

  it('检测更新失败 → 显示错误原因', async () => {
    mockedCheckUpdate.mockRejectedValue({ response: { data: { error: 'npm registry request timed out' } } })
    const wrapper = await mountView()
    await findButton(wrapper, '检测更新')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('检测失败：npm registry request timed out')
  })
})
