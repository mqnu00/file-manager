/**
 * Test Plugin — 前端入口
 *
 * 浏览器运行时通过 import() 动态加载，接收 ctx 访问所有前端公共资源。
 * 不得直接 import vue / element-plus —— 所有依赖通过 ctx 获取。
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 *
 * 本插件注册一个独立页面 /plugin/test，展示插件运行状态。
 * 版本号/加载时刻等状态由后端 GET /api/plugin/test 动态返回，
 * 切换插件版本后页面显示随之变化，用于生产环境版本切换验证。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

export const install: FrontendPluginInstallFunction = (ctx) => {
  // 注册演示主题：安装插件后主项目主题下拉框出现"午夜"选项
  // （覆盖 --app-* 核心变量，选择器对应 className）
  ctx.composables.useTheme().registerTheme({
    name: 'midnight',
    label: '午夜',
    className: 'midnight',
    css: `
html.midnight {
  --app-bg: #0d1117;
  --app-panel: #161b22;
  --app-panel-solid: #161b22;
  --app-border: #30363d;
  --app-shadow: 0 2px 8px rgb(0 0 0 / 40%);
  --app-glow: none;
  --app-text: #c9d1d9;
  --app-text-dim: #8b949e;
  --app-text-bright: #f0f6fc;
  --app-accent: #58a6ff;
  --app-accent-bg: rgb(88 166 255 / 10%);
  --app-accent-bg-hover: rgb(88 166 255 / 15%);
  --app-accent-bg-subtle: rgb(88 166 255 / 8%);
  --app-accent-border: rgb(88 166 255 / 25%);
  --app-accent-border-light: rgb(88 166 255 / 15%);
  --app-input-bg: #0d1117;
  --app-table-header-bg: #161b22;
  --app-table-header-border: #21262d;
  --app-table-row-hover: #161b22;
  --app-table-cell-border: #21262d;
  --app-blur: none;
  --app-text-shadow: none;
  --app-text-glow: none;
  --app-text-glow-hover: none;
  --app-checkbox-border: #30363d;
  --app-checkbox-shadow: none;
  --app-mask-bg: rgb(13 17 23 / 70%);
  --app-select-caret: #8b949e;
  --app-scrollbar-track: transparent;
  --app-scrollbar-thumb: #30363d;
  --app-scrollbar-thumb-hover: #484f58;
  --el-color-primary-light-9: rgb(88 166 255 / 10%);
}`,
  })

  const { h, ref, onMounted, defineComponent } = ctx.Vue
  const {
    ElCard,
    ElTag,
    ElButton,
    ElIcon,
    ElDivider,
    ElDescriptions,
    ElDescriptionsItem,
    ElMessage,
    ElAlert,
    ElSpace,
  } = ctx.ElementPlus

  interface TestPluginStatus {
    plugin?: string
    name?: string
    version?: string
    loadedAt?: string
    message?: string
    timestamp?: string
  }

  interface TestServiceStatus {
    running: boolean
    port: number
    startedAt: number | null
    startCount: number
  }

  const PageComponent = defineComponent({
    name: 'PluginTestPage',
    setup() {
      const loadTime = ref(new Date().toLocaleString())
      const counter = ref(0)
      const version = ref('获取中…')
      const pluginName = ref('')
      const loadedAt = ref('')
      const fetchFailed = ref(false)

      // 托管服务状态
      const serviceRunning = ref(false)
      const servicePort = ref(18765)
      const serviceStartedAt = ref<number | null>(null)
      const serviceStartCount = ref(0)
      const serviceResponse = ref('')
      const serviceOperating = ref(false)

      const fetchStatus = async () => {
        try {
          const resp = await fetch('/api/plugin/test')
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = (await resp.json()) as TestPluginStatus
          version.value = data.version ?? 'unknown'
          pluginName.value = data.name ?? ''
          loadedAt.value = data.loadedAt ?? ''
          fetchFailed.value = false
        } catch {
          fetchFailed.value = true
          version.value = '获取失败'
        }
      }

      onMounted(() => {
        fetchStatus()
        fetchService()
      })

      const refreshTime = () => {
        loadTime.value = new Date().toLocaleString()
        ElMessage.success('时间已刷新')
      }

      const refreshStatus = async () => {
        await fetchStatus()
        if (!fetchFailed.value) {
          ElMessage.success('插件状态已刷新')
        } else {
          ElMessage.error('获取插件状态失败')
        }
      }

      // ==================== 托管服务 ====================

      const fetchService = async () => {
        try {
          const resp = await fetch('/api/plugin/test/service')
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = (await resp.json()) as TestServiceStatus
          serviceRunning.value = data.running
          servicePort.value = data.port
          serviceStartedAt.value = data.startedAt
          serviceStartCount.value = data.startCount
        } catch {
          ElMessage.error('获取服务状态失败')
        }
      }

      const startService = async () => {
        serviceOperating.value = true
        try {
          const resp = await fetch('/api/plugin/test/service/start', { method: 'POST' })
          const data = (await resp.json()) as { success?: boolean; error?: string; port?: number }
          if (!resp.ok || !data.success) {
            throw new Error(data.error || `HTTP ${resp.status}`)
          }
          ElMessage.success(`测试服务已启动（端口 ${data.port}）`)
          await fetchService()
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '启动失败'
          ElMessage.error(`启动测试服务失败: ${message}`)
        } finally {
          serviceOperating.value = false
        }
      }

      const stopService = async () => {
        serviceOperating.value = true
        try {
          const resp = await fetch('/api/plugin/test/service/stop', { method: 'POST' })
          const data = (await resp.json()) as { success?: boolean; error?: string }
          if (!resp.ok || !data.success) {
            throw new Error(data.error || `HTTP ${resp.status}`)
          }
          ElMessage.success('测试服务已停止')
          await fetchService()
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '停止失败'
          ElMessage.error(`停止测试服务失败: ${message}`)
        } finally {
          serviceOperating.value = false
        }
      }

      const testRequest = async () => {
        serviceResponse.value = ''
        try {
          // 服务仅监听 127.0.0.1 且端口未对外暴露，浏览器直连会被 CSP connect-src 拦截，
          // 统一走同源接口由后端代发请求
          const resp = await fetch('/api/plugin/test/service/request')
          const data = (await resp.json()) as { error?: string }
          if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
          serviceResponse.value = JSON.stringify(data, null, 2)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '请求失败'
          serviceResponse.value = `请求失败: ${message}`
        }
      }

      return () =>
        h('div', { style: { padding: '40px 20px', maxWidth: '860px', margin: '0 auto' } }, [
          // 返回按钮
          h(ElButton, { text: true, onClick: () => window.history.back() }, () => [
            h(ElIcon, { style: { marginRight: '4px' } }, () =>
              h('i', { class: 'el-icon-arrow-left' })
            ),
            '返回插件管理',
          ]),

          h('div', { style: { height: '16px' } }),

          // 主卡片
          h(
            ElCard,
            {},
            {
              header: () =>
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                  h('h2', { style: { margin: 0, fontSize: '20px' } }, 'Test Plugin'),
                  h(ElTag, { type: 'primary', size: 'small' }, () => `v${version.value}`),
                  h(ElTag, { type: 'success', size: 'small' }, () => '运行中'),
                ]),
              default: () => [
                h(ElDescriptions, { column: 2, border: true }, () => [
                  h(ElDescriptionsItem, { label: '插件名称' }, () =>
                    pluginName.value || 'file-manager-plugin-test'
                  ),
                  h(ElDescriptionsItem, { label: '版本' }, () => version.value),
                  h(ElDescriptionsItem, { label: '页面路由' }, () => '/plugin/test'),
                  h(ElDescriptionsItem, { label: '后端加载时刻' }, () => loadedAt.value || '—'),
                  h(ElDescriptionsItem, { label: '页面加载时间' }, () => loadTime.value),
                ]),

                h('div', { style: { height: '16px' } }),

                h(ElSpace, { wrap: true }, () => [
                  h(ElButton, { onClick: refreshTime }, () => '刷新时间'),
                  h(
                    ElButton,
                    {
                      type: 'primary',
                      onClick: () => {
                        counter.value++
                      },
                    },
                    () => `计数: ${counter.value}`
                  ),
                  h(ElButton, { onClick: refreshStatus }, () => '重新获取状态'),
                ]),

                h('div', { style: { height: '16px' } }),

                h(ElDivider),

                h(
                  ElAlert,
                  {
                    type: fetchFailed.value ? 'error' : 'info',
                    showIcon: false,
                    title: '版本切换验证',
                    description:
                      '版本号与后端加载时刻来自 GET /api/plugin/test（读取当前安装的 package.json）。' +
                      '在"插件管理 → 发现插件"中切换版本后刷新本页，' +
                      '版本号应变为新版本、后端加载时刻应更新。',
                    closable: false,
                  }
                ),
              ],
            }
          ),

          h('div', { style: { height: '16px' } }),

          // 托管服务卡片（自动启动验证）
          h(
            ElCard,
            {},
            {
              header: () =>
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                  h('h2', { style: { margin: 0, fontSize: '20px' } }, '托管服务测试'),
                  h(
                    ElTag,
                    { type: serviceRunning.value ? 'success' : 'info', size: 'small' },
                    () => (serviceRunning.value ? '运行中' : '已停止')
                  ),
                ]),
              default: () => [
                h(ElDescriptions, { column: 2, border: true }, () => [
                  h(ElDescriptionsItem, { label: '服务名' }, () => 'test-service'),
                  h(ElDescriptionsItem, { label: '监听地址' }, () =>
                    serviceRunning.value ? `127.0.0.1:${servicePort.value}` : '—'
                  ),
                  h(ElDescriptionsItem, { label: '启动次数' }, () => serviceStartCount.value),
                  h(ElDescriptionsItem, { label: '最近启动时间' }, () =>
                    serviceStartedAt.value
                      ? new Date(serviceStartedAt.value).toLocaleString()
                      : '—'
                  ),
                ]),

                h('div', { style: { height: '16px' } }),

                h(ElSpace, { wrap: true }, () => [
                  h(
                    ElButton,
                    {
                      type: 'primary',
                      disabled: serviceRunning.value || serviceOperating.value,
                      loading: serviceOperating.value && !serviceRunning.value,
                      onClick: startService,
                    },
                    () => '启动服务'
                  ),
                  h(
                    ElButton,
                    {
                      type: 'danger',
                      disabled: !serviceRunning.value || serviceOperating.value,
                      onClick: stopService,
                    },
                    () => '停止服务'
                  ),
                  h(
                    ElButton,
                    { disabled: !serviceRunning.value, onClick: testRequest },
                    () => '发送测试请求'
                  ),
                  h(ElButton, { onClick: fetchService }, () => '刷新状态'),
                ]),

                h('div', { style: { height: '16px' } }),

                h(
                  'pre',
                  {
                    style: {
                      margin: 0,
                      padding: '12px',
                      background: '#f5f7fa',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      minHeight: '40px',
                    },
                  },
                  serviceResponse.value || '点击"发送测试请求"查看服务响应（服务需先启动）'
                ),

                h('div', { style: { height: '16px' } }),

                h(
                  ElAlert,
                  {
                    type: 'warning',
                    showIcon: false,
                    title: '自动启动验证',
                    description:
                      '1. 点击"启动服务"，服务状态写入 config.yml plugins.test.startedServices。' +
                      '2. 重启文件管理器，服务应自动恢复为运行中（启动次数 +1）。' +
                      '3. 点击"停止服务"后重启，服务不应自动启动。',
                    closable: false,
                  }
                ),
              ],
            }
          ),
        ])
    },
  })

  // 向主应用注册路由
  ctx.router.addRoute({ path: '/plugin/test', component: PageComponent })

  console.log('[Test Plugin] Frontend loaded — page registered at /plugin/test')
}
