/**
 * 插件页面导航注册表（平台挂载点）
 *
 * 让前端插件能把页面入口（图标按钮）注册到文件浏览器顶栏导航区，
 * 点击后跳转到插件页面路由（如 system-info 的「系统信息」页）。
 *
 * 加载顺序保证：本模块作为主应用静态依赖（main.ts 显式 import），
 * 在 initPlugins() 执行前完成模块求值并设置 window.__fm_nav_actions；
 * 插件 install(ctx) 时可安全注册，Toolbar 渲染时可读到全部已注册导航项
 * （注册发生在 mount 之前，与 __fm_bulk_actions 同一时序约定）。
 */
import { ref, type Component } from 'vue'

/** 插件注册的页面导航项 */
export interface NavAction {
  /** 唯一 id（重复注册时按 id 覆盖替换） */
  id: string
  /** 悬停提示/无障碍标签 */
  label: string
  /** 点击跳转的路由路径 */
  path: string
  /** 图标组件（插件自绘 SVG 或经类型门面引入的图标组件） */
  icon?: Component
}

export interface NavActionsApi {
  register(action: NavAction): void
  /** 按 id 移除已注册导航项（插件 teardown 用）；不存在则为 no-op */
  unregister(id: string): void
  list(): NavAction[]
  subscribe(fn: () => void): () => void
}

const actions = ref<NavAction[]>([])
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

const api: NavActionsApi = {
  register(action) {
    actions.value = actions.value.filter((a) => a.id !== action.id).concat(action)
    notify()
  },
  unregister(id) {
    actions.value = actions.value.filter((a) => a.id !== id)
    notify()
  },
  list() {
    return actions.value
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

// 模块求值即暴露全局，确保插件 install 时可用（幂等）。
// window 扩展声明见 env.d.ts（与发布类型入口 frontend-types.ts 的 declare global 同构）。
if (typeof window !== 'undefined') {
  window.__fm_nav_actions = api
}

/** 读取已注册的导航项（响应式：插件注册/覆盖后自动更新） */
export function useNavActions() {
  return { actions }
}

/** 供插件读取注册 API（与 window.__fm_nav_actions 同一实例） */
export function getNavActionsApi(): NavActionsApi {
  return api
}