/**
 * Test Plugin — 前端入口
 *
 * 浏览器运行时通过 import() 动态加载，接收 ctx 访问所有前端公共资源。
 * 不得直接 import vue / element-plus —— 所有依赖通过 ctx 获取。
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 *
 * 本插件注册一个独立页面 /plugin/test，展示插件运行状态。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

export const install: FrontendPluginInstallFunction = (ctx) => {
  const { h, ref, defineComponent } = ctx.Vue
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

  const PageComponent = defineComponent({
    name: 'PluginTestPage',
    setup() {
      const loadTime = ref(new Date().toLocaleString())
      const counter = ref(0)

      const refreshTime = () => {
        loadTime.value = new Date().toLocaleString()
        ElMessage.success('时间已刷新')
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
                  h(ElTag, { type: 'success', size: 'small' }, () => '运行中'),
                ]),
              default: () => [
                h(ElDescriptions, { column: 2, border: true }, () => [
                  h(ElDescriptionsItem, { label: '插件名称' }, () => 'file-manager-plugin-test'),
                  h(ElDescriptionsItem, { label: '版本' }, () => '0.1.0'),
                  h(ElDescriptionsItem, { label: '页面路由' }, () => '/plugin/test'),
                  h(ElDescriptionsItem, { label: '加载时间' }, () => loadTime.value),
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
                ]),

                h('div', { style: { height: '16px' } }),

                h(ElDivider),

                h(ElAlert, {
                  type: 'info',
                  showIcon: false,
                  title: '插件说明',
                  description:
                    '这是一个示例插件页面，展示了如何通过 ctx.Vue.defineComponent + h() 定义组件，' +
                    '并通过 ctx.router.addRoute() 注册路由。所有 UI 组件来自 ctx.ElementPlus，无需直接依赖。',
                  closable: false,
                }),
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
