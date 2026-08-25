/**
 * 系统信息插件前端入口
 *
 * 1. 注册页面路由 /plugin/system-info（requiresAuth，由主应用路由守卫兜底登录）
 * 2. 向主应用导航注册表（window.__fm_nav_actions）注册顶栏入口按钮
 */
import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
} from '@mqn00/file-manager/plugin/frontend'
import { Monitor } from '@element-plus/icons-vue'
import { injectStyles } from './style'
import { createSystemInfoPage } from './page'

interface NavActionLike {
  id: string
  label: string
  path: string
  icon?: unknown
}

interface NavActionsApiLike {
  register(action: NavActionLike): void
}

/** 与主应用挂载点同定义：注册导航项（重复注册按 id 覆盖） */
function registerNavAction(action: NavActionLike): void {
  const api = (window as unknown as Record<string, unknown>)['__fm_nav_actions'] as
    | NavActionsApiLike
    | undefined
  if (!api || typeof api.register !== 'function') {
    console.warn('[system-info] 主应用未暴露导航注册表（__fm_nav_actions），入口按钮不可用')
    return
  }
  api.register(action)
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
}