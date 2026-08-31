/**
 * 系统信息插件前端入口
 *
 * 1. 注册页面路由 /plugin/system-info（requiresAuth，由主应用路由守卫兜底登录）
 * 2. 向主应用导航注册表（window.__fm_nav_actions，类型契约由
 *    @mqn00/file-manager/plugin/frontend 发布）注册顶栏入口按钮
 */
import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  NavAction,
} from '@mqn00/file-manager/plugin/frontend'
import { Monitor } from '@element-plus/icons-vue'
import { injectStyles, removeStyles } from './style'
import { createSystemInfoPage } from './page'

/** 注册导航项（重复注册按 id 覆盖）；旧版本主应用缺失注册表时降级（无操作） */
function registerNavAction(action: NavAction): void {
  // window.__fm_nav_actions 类型由发布入口 declare global 提供（可选属性）
  const api = window.__fm_nav_actions
  if (!api || typeof api.register !== 'function') {
    console.warn('[system-info] 主应用未暴露导航注册表（__fm_nav_actions），入口按钮不可用')
    return
  }
  api.register(action)
}

/** 按 id 移除导航项（插件 teardown 调用） */
function unregisterNavAction(id: string): void {
  const api = window.__fm_nav_actions
  if (api && typeof api.unregister === 'function') {
    api.unregister(id)
  }
}

export const install: FrontendPluginInstallFunction = (ctx: FrontendPluginContext) => {
  injectStyles()

  ctx.router.addRoute({
    path: '/plugin/system-info',
    component: createSystemInfoPage(ctx) as never,
    meta: { requiresAuth: true },
  })

  registerNavAction({
    id: 'system-info',
    label: '系统信息',
    path: '/plugin/system-info',
    icon: Monitor,
  })

  // teardown 契约：卸载/重载时移除顶栏入口并移除注入样式（路由由平台统一清理）
  return () => {
    unregisterNavAction('system-info')
    removeStyles()
  }
}