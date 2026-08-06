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

  const PageComponent = defineComponent({
    name: 'PluginTestPage',
    setup() {
      const loadTime = ref(new Date().toLocaleString())
      const counter = ref(0)
      const version = ref('获取中…')
      const pluginName = ref('')
      const loadedAt = ref('')
      const fetchFailed = ref(false)

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

      onMounted(fetchStatus)

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
        ])
    },
  })

  // 向主应用注册路由
  ctx.router.addRoute({ path: '/plugin/test', component: PageComponent })

  console.log('[Test Plugin] Frontend loaded — page registered at /plugin/test')
}
