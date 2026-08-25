/**
 * 插件工具栏操作注册表（平台挂载点）
 *
 * 让前端插件（如 compress 压缩插件）能把自定义操作按钮注册到文件浏览器
 * 的批量操作栏（bulk-actions）里，点按后自行处理（弹对话框等）。
 *
 * 加载顺序保证：本模块作为主应用静态依赖，在 initPlugins() 执行前即完成
 * 模块求值并设置 window.__fm_bulk_actions；插件 install(ctx) 时可安全注册，
 * HomeView 挂载（app.mount 之后）时已能读到全部已注册操作。
 */
import { ref } from 'vue'
import type { FileItem } from '@/types'

/** 操作按钮可见性判定入参 */
export interface BulkActionVisibility {
  /** 当前选择的条目数 */
  count: number
  /** 当前选择中是否包含文件夹 */
  hasFolder: boolean
}

/** 操作点按时的上下文（由主应用在点击时刻快照捕获） */
export interface BulkActionContext {
  /** 已选条目路径（相对路径） */
  selected: string[]
  /** 已选条目信息 */
  infos: FileItem[]
  /** 当前浏览文件夹 */
  currentPath: string
}

/** 插件注册的批量操作 */
export interface BulkAction {
  /** 唯一 id（重复注册时按 id 覆盖替换） */
  id: string
  /** 按钮文案 */
  label: string
  /** 是否在批量操作栏显示 */
  visible(p: BulkActionVisibility): boolean
  /** 点按后的行为（由插件自行挂载对话框等） */
  run(p: BulkActionContext): void
}

export interface BulkActionsApi {
  register(action: BulkAction): void
  /** 按 id 移除已注册操作（插件 teardown 用）；不存在则为 no-op */
  unregister(id: string): void
  list(): BulkAction[]
  subscribe(fn: () => void): () => void
}

/** 主应用工具栏渲染用的视图形态（HomeView 组装后传入 Toolbar） */
export interface BulkActionView {
  id: string
  label: string
  visible(p: BulkActionVisibility): boolean
  onClick(): void
}

export const BULK_ACTIONS_GLOBAL_KEY = '__fm_bulk_actions'

const actions = ref<BulkAction[]>([])
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

const api: BulkActionsApi = {
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

// 模块求值即暴露全局，确保插件 install 时可用（幂等）
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>)[BULK_ACTIONS_GLOBAL_KEY] = api
}

/** 读取已注册的批量操作（响应式：插件注册/覆盖后自动更新） */
export function useBulkActions() {
  return { actions }
}

/** 供插件读取注册 API（与 window.__fm_bulk_actions 同一实例） */
export function getBulkActionsApi(): BulkActionsApi {
  return api
}