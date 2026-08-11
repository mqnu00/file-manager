import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { SystemInfo } from '@/types'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/system', () => ({
  getSystemInfo: vi.fn(),
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

import SystemInfoView from './SystemInfoView.vue'
import { getSystemInfo } from '@/api/system'
import { ElMessage } from 'element-plus'

const mockedGetSystemInfo = vi.mocked(getSystemInfo)

function makeDisk(device: string, usedPercent: number) {
  const total = 100 * 1024 ** 3
  const used = Math.round((total * usedPercent) / 100)
  return {
    device,
    vendor: 'ACME',
    model: `${device}-model`,
    mountpoint: '/',
    mountpoints: ['/'],
    fstype: 'ext4',
    total,
    free: total - used,
    used,
    totalFormatted: '100 GB',
    freeFormatted: '50 GB',
    usedFormatted: '50 GB',
    partitions: [{ mountpoint: '/', totalFormatted: '100 GB', usedFormatted: '50 GB', percent: usedPercent }],
  }
}

const fakeInfo: SystemInfo = {
  os: { type: 'Linux', platform: 'linux', arch: 'x64', release: '5.15', hostname: 'test-host', uptime: 3600, uptimeFormatted: '1 小时' },
  cpu: { model: 'Test CPU', cores: 8, physicalCores: 4, speed: 2400, usage: 12 },
  memory: { total: 16 * 1024 ** 3, free: 8 * 1024 ** 3, used: 8 * 1024 ** 3, usagePercent: 50, totalFormatted: '16 GB', freeFormatted: '8 GB', usedFormatted: '8 GB' },
  disk: makeDisk('/dev/sda', 50),
  disks: [makeDisk('/dev/sda', 50), makeDisk('/dev/sdb', 70)],
  node: { version: 'v22.0.0', pid: 1234 },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetSystemInfo.mockResolvedValue(fakeInfo)
})

async function mountView() {
  const wrapper = mount(SystemInfoView)
  await flushPromises()
  return wrapper
}

describe('SystemInfoView.vue', () => {
  it('加载成功 → 渲染操作系统/CPU/内存/硬盘/Node.js 卡片', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).toContain('操作系统')
    expect(text).toContain('test-host')
    expect(text).toContain('Test CPU')
    expect(text).toContain('16 GB')
    expect(text).toContain('/dev/sda')
    expect(text).toContain('v22.0.0')
  })

  it('多磁盘时显示磁盘选择器，切换后展示对应设备', async () => {
    const wrapper = await mountView()
    const select = wrapper.getComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(wrapper.text()).toContain('/dev/sdb')
  })

  it('加载失败 → 显示错误提示与重试按钮，点击重试重新请求', async () => {
    mockedGetSystemInfo.mockRejectedValueOnce(new Error('network'))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('获取系统信息失败')
    expect(ElMessage.error).toHaveBeenCalledWith('获取系统信息失败')

    mockedGetSystemInfo.mockResolvedValueOnce(fakeInfo)
    const retryBtn = wrapper.findAll('button').find((b) => b.text() === '重试')
    await retryBtn!.trigger('click')
    await flushPromises()
    expect(mockedGetSystemInfo).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('test-host')
  })
})
