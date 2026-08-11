import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElSelect, ElOption } from 'element-plus'
import PluginVersionSelect from './PluginVersionSelect.vue'
import { getPluginVersions } from '@/api/plugins'

vi.mock('@/api/plugins', () => ({
  getPluginVersions: vi.fn(),
}))

const mockedGetPluginVersions = vi.mocked(getPluginVersions)

function mountSelect(installedVersion?: string | null) {
  return mount(PluginVersionSelect, {
    props: {
      packageName: '@mqn00/file-manager-plugin-test',
      modelValue: '1.0.0',
      installedVersion,
    },
    global: {
      stubs: {
        teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

async function loadVersions(wrapper: any) {
  wrapper.findComponent(ElSelect).vm.$emit('visible-change', true)
  await flushPromises()
}

function optionLabels(wrapper: any): string[] {
  return wrapper.findAllComponents(ElOption).map((o: any) => o.props('label'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PluginVersionSelect.vue 版本标注', () => {
  it('已安装版本非最新 → 分别标注（最新）与（当前）', async () => {
    mockedGetPluginVersions.mockResolvedValue({
      versions: ['0.2.0', '1.0.0', '2.0.0'],
      latest: '2.0.0',
    })
    const wrapper = mountSelect('1.0.0')
    await loadVersions(wrapper)

    const labels = optionLabels(wrapper)
    expect(labels).toContain('v2.0.0（最新）')
    expect(labels).toContain('v1.0.0（当前）')
    expect(labels).toContain('v0.2.0')
  })

  it('已安装版本即最新 → 合并标注（最新 · 当前）', async () => {
    mockedGetPluginVersions.mockResolvedValue({
      versions: ['1.0.0', '2.0.0'],
      latest: '2.0.0',
    })
    const wrapper = mountSelect('2.0.0')
    await loadVersions(wrapper)

    expect(optionLabels(wrapper)).toContain('v2.0.0（最新 · 当前）')
  })

  it('未安装 → 仅标注最新', async () => {
    mockedGetPluginVersions.mockResolvedValue({
      versions: ['0.2.0', '1.0.0', '2.0.0'],
      latest: '2.0.0',
    })
    const wrapper = mountSelect(null)
    await loadVersions(wrapper)

    const labels = optionLabels(wrapper)
    expect(labels).toContain('v2.0.0（最新）')
    expect(labels.some((l: string) => l.includes('当前'))).toBe(false)
  })
})
