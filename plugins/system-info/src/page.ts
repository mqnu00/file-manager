/**
 * 系统信息页面（render 函数实现，插件无法 import 主应用 .vue 组件）
 *
 * 自主应用 SystemInfoView.vue 转写，UI 结构与样式保持一致；
 * Element Plus 组件取自 ctx.ElementPlus，图标取自 @element-plus/icons-vue
 * （构建时仅打包用到的图标，vue 运行时经 vue-shim 转发 window.Vue）。
 */

import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'
import {
  ArrowLeft,
  Refresh,
  Monitor,
  Cpu,
  Coin,
  Box,
  Tickets,
  Loading,
  WarningFilled,
} from '@element-plus/icons-vue'

/** 系统信息数据结构（与后端 /api/plugin/system-info/info 返回一致） */
export interface SystemInfo {
  os: {
    type: string
    platform: string
    arch: string
    release: string
    hostname: string
    uptime: number
    uptimeFormatted: string
  }
  cpu: {
    model: string
    cores: number
    physicalCores: number
    speed: number
    usage: number
  }
  memory: {
    total: number
    free: number
    used: number
    usagePercent: number
    totalFormatted: string
    freeFormatted: string
    usedFormatted: string
  }
  disk: DiskInfo
  disks: DiskInfo[]
  node: {
    version: string
    pid: number
  }
}

export interface DiskInfo {
  device: string
  vendor: string
  model: string
  mountpoint: string
  mountpoints: string[]
  fstype: string
  total: number
  free: number
  used: number
  totalFormatted: string
  freeFormatted: string
  usedFormatted: string
  partitions: Array<{
    mountpoint: string
    totalFormatted: string
    usedFormatted: string
    percent: number
  }>
}

/** SPA 导航：平台路由 API 经 ctx.router.push 完成（适配 history/hash 双模式） */
function spaNavigate(ctx: FrontendPluginContext, url: string): void {
  void ctx.router.push(url)
}

export function createSystemInfoPage(ctx: FrontendPluginContext) {
  const { defineComponent, h, ref, computed, onMounted } = ctx.Vue
  const {
    ElButton,
    ElIcon,
    ElCard,
    ElSelect,
    ElOption,
    ElProgress,
    ElTooltip,
    ElMessage,
  } = ctx.ElementPlus
  const api = ctx.api.instance

  return defineComponent({
    name: 'SystemInfoPage',
    setup() {
      const systemInfo = ref<SystemInfo | null>(null)
      const loading = ref(false)
      const error = ref<string | null>(null)
      const selectedDiskIndex = ref(0)

      const selectedDisk = computed(() => {
        if (!systemInfo.value) return null
        return systemInfo.value.disks[selectedDiskIndex.value] || systemInfo.value.disk
      })

      const diskUsageColor = computed(() => {
        const disk = selectedDisk.value
        if (!disk?.total) return ''
        const percent = Math.round((disk.used / disk.total) * 100)
        return percent > 85 ? '#F56C6C' : percent > 65 ? '#E6A23C' : '#409EFF'
      })

      const fetchSystemInfo = async () => {
        loading.value = true
        error.value = null
        try {
          // ctx.api.instance 的 baseURL 为 '/api'，路径不带 /api 前缀
          const resp = await api.get('/plugin/system-info/info')
          systemInfo.value = resp.data as SystemInfo
        } catch (e: any) {
          error.value = e?.response?.data?.message || '获取系统信息失败'
          ElMessage.error('获取系统信息失败')
        } finally {
          loading.value = false
        }
      }

      onMounted(() => {
        void fetchSystemInfo()
      })

      return () => {
        const infoItem = (label: string, value: string, version = false) =>
          h('div', { class: 'fci-item' }, [
            h('span', { class: 'fci-label' }, label),
            h('span', { class: version ? 'fci-value fci-version' : 'fci-value' }, value),
          ])

        const diskSelect =
          systemInfo.value && systemInfo.value.disks.length > 1
            ? h(
                ElSelect,
                {
                  modelValue: selectedDiskIndex.value,
                  size: 'small',
                  class: 'fci-disk-select',
                  'onUpdate:modelValue': (v: number) => {
                    selectedDiskIndex.value = v
                  },
                },
                {
                  default: () =>
                    systemInfo.value!.disks.map((d, i) =>
                      h(
                        ElOption as never,
                        {
                          key: i,
                          label: `${d.device} (${d.mountpoints[0] || '未挂载'})`,
                          value: i,
                        }
                      )
                    ),
                }
              )
            : null

        const infoCard = (icon: any, title: string, children: any[], headerExtra?: any) =>
          h(
            ElCard as never,
            { class: 'fci-info-card', shadow: 'never' },
            {
              header: () =>
                h('div', { class: 'fci-card-header' }, [
                  h(ElIcon, { size: 16 }, { default: () => h(icon as never) }),
                  h('span', title),
                  headerExtra || null,
                ]),
              default: () => h('div', { class: 'fci-list' }, children),
            }
          )

        // 已加载：信息网格
        let body: any
        if (systemInfo.value) {
          const info = systemInfo.value
          const disk = selectedDisk.value
          const diskPercent = disk?.total
            ? Math.round((disk.used / disk.total) * 100)
            : 0

          body = h('div', { class: 'fci-grid' }, [
            // 操作系统
            infoCard(Monitor, '操作系统', [
              infoItem('类型', info.os.type),
              infoItem('平台', info.os.platform),
              infoItem('架构', info.os.arch),
              infoItem('版本', info.os.release, true),
              infoItem('主机名', info.os.hostname),
              infoItem('运行时间', info.os.uptimeFormatted),
            ]),
            // CPU
            infoCard(Cpu, 'CPU', [
              infoItem('型号', info.cpu.model, true),
              infoItem('核心数', String(info.cpu.cores)),
              infoItem('频率', `${info.cpu.speed} MHz`),
            ]),
            // 内存
            infoCard(Coin, '内存', [
              infoItem('总量', info.memory.totalFormatted),
              infoItem('已用', info.memory.usedFormatted),
              infoItem('可用', info.memory.freeFormatted),
            ]),
            // 硬盘
            infoCard(
              Box,
              '硬盘',
              [
                infoItem('设备', disk?.device || '--'),
                ...(disk?.vendor || disk?.model
                  ? [infoItem('制造商', disk?.vendor || '未知')]
                  : []),
                ...(disk?.model ? [infoItem('型号', disk?.model)] : []),
                infoItem(
                  '挂载点',
                  disk?.mountpoints && disk.mountpoints.length > 1
                    ? disk.mountpoints.join(', ')
                    : disk?.mountpoint || '--',
                  true
                ),
                infoItem('文件系统', disk?.fstype || '--'),
                h('div', { class: 'fci-item fci-disk-progress' }, [
                  h(
                    ElTooltip,
                    { placement: 'top' },
                    {
                      content: () =>
                        (disk?.partitions || []).map((p) =>
                          h(
                            'div',
                            { key: p.mountpoint, style: { whiteSpace: 'nowrap' } },
                            `${p.mountpoint}: ${p.percent}% | ${p.usedFormatted} / ${p.totalFormatted}`
                          )
                        ),
                      default: () =>
                        h(ElProgress as never, {
                          percentage: diskPercent,
                          format: (p: number) => `${p}% | ${disk?.totalFormatted || '0 B'}`,
                          color: diskUsageColor.value,
                        }),
                    }
                  ),
                ]),
              ],
              diskSelect
            ),
            // Node.js
            infoCard(Tickets, 'Node.js', [
              infoItem('版本', info.node.version),
              infoItem('进程 ID', String(info.node.pid)),
            ]),
          ])
        } else if (loading.value) {
          body = h('div', { class: 'fci-state' }, [
            h(ElIcon, { class: 'is-loading', size: 32 }, { default: () => h(Loading) }),
            h('p', '加载系统信息中...'),
          ])
        } else {
          body = h('div', { class: 'fci-state' }, [
            h(ElIcon, { size: 32, color: '#f56c6c' }, { default: () => h(WarningFilled) }),
            h('p', error.value || '获取系统信息失败'),
            h(ElButton, { type: 'primary', onClick: () => void fetchSystemInfo() }, () => '重试'),
          ])
        }

        return h('div', { class: 'fci-container' }, [
          h('div', { class: 'fci-card' }, [
            h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
              h(
                ElButton,
                { text: true, class: 'fci-back', onClick: () => spaNavigate(ctx, '/') },
                {
                  default: () => [
                    h(ElIcon, null, { default: () => h(ArrowLeft) }),
                    h('span', '返回'),
                  ],
                }
              ),
            ]),
            h('div', { style: { padding: '20px 36px' } }, [
              h('div', { class: 'fci-header' }, [
                h('h3', { class: 'fci-title' }, '系统信息'),
                h(
                  ElButton,
                  { size: 'small', loading: loading.value, onClick: () => void fetchSystemInfo() },
                  {
                    default: () => [
                      h(ElIcon, null, { default: () => h(Refresh) }),
                      h('span', '刷新'),
                    ],
                  }
                ),
              ]),
              // 硬盘下拉已内嵌于硬盘卡片 header
              body,
            ]),
          ]),
        ])
      }
    },
  })
}