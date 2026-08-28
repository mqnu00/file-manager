/**
 * 插件文件打开注册表（平台挂载点）
 *
 * 让前端插件（如 file-viewer 查看器核心）声明"能打开哪些文件"并接收打开请求：
 * - 主应用渲染文件列表时按 canOpen 判定并打 `is-openable` 标记（数据驱动，代替插件扫描 DOM）
 * - 主应用单击文件名时分发给首个 canOpen 命中的 handler（按注册序）
 * - 插件不再需要 document 捕获阶段劫持点击 / 依赖主应用内部类名
 *
 * 加载顺序保证：本模块作为主应用静态依赖（main.ts 显式 import，见加载顺序注释），
 * 在 initPlugins() 执行前即完成模块求值并设置 window.__fm_file_open；
 * 插件 install(ctx) 时可安全注册，FileTable 渲染时可读到全部已注册 handler。
 */
import { ref } from 'vue'
import type { FileItem } from '@/types'

/** 文件打开 handler：插件声明打开能力并在主应用分发时消费 */
export interface FileOpenHandler {
  /** 唯一 id（重复注册时按 id 覆盖替换） */
  id: string
  /** 该文件是否可由此 handler 打开（同步、轻量，渲染期会被逐行调用） */
  canOpen(file: FileItem): boolean
  /** 消费打开请求（主应用单击文件且 canOpen 命中时调用） */
  open(file: FileItem): void | Promise<void>
}

export interface FileOpenApi {
  /** 注册 handler；同 id 覆盖替换。返回注销函数（插件 teardown 用） */
  register(handler: FileOpenHandler): () => void
  /** 按 id 移除已注册 handler（插件 teardown 用）；不存在则为 no-op */
  unregister(id: string): void
  /** 按注册序返回第一个 canOpen 命中的 handler；无则 null */
  resolve(file: FileItem): FileOpenHandler | null
  /** 当前全部 handler（注册顺序） */
  list(): FileOpenHandler[]
  /** 注册表变化订阅（插件加载/卸载时触发，主应用据此重算 is-openable），返回取消订阅函数 */
  subscribe(fn: () => void): () => void
  /** 主动触发重算：handler 内部能力来源（如查看器注册表）变化但 handler 本身未增删时，
   *  用于通知主应用重算 is-openable 标记（重新赋值响应式 handers ref 触发渲染） */
  refresh(): void
}

/** 插件集合变化事件：插件管理页在加载/卸载/重载完成后广播，供查看器核心等重算可打开集合 */
export const PLUGINS_CHANGED_EVENT = 'fm:plugins:changed'

export function emitPluginsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLUGINS_CHANGED_EVENT))
  }
}

export const FILE_OPEN_GLOBAL_KEY = '__fm_file_open'

const handlers = ref<FileOpenHandler[]>([])
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

const api: FileOpenApi = {
  register(handler) {
    handlers.value = handlers.value.filter((h) => h.id !== handler.id).concat(handler)
    notify()
    return () => api.unregister(handler.id)
  },
  unregister(id) {
    handlers.value = handlers.value.filter((h) => h.id !== id)
    notify()
  },
  resolve(file) {
    return handlers.value.find((h) => h.canOpen(file)) ?? null
  },
  list() {
    return handlers.value
  },
  subscribe(fn) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  refresh() {
    // 重新赋值响应式数组，触发依赖此 handers ref 的组件（如 FileTable）重算 is-openable
    handlers.value = [...handlers.value]
    notify()
  },
}

// 模块求值即暴露全局，确保插件 install 时可用（幂等）
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>)[FILE_OPEN_GLOBAL_KEY] = api
}

/** 读取已注册的打开 handler（响应式：插件注册/注销后自动更新，FileTable 渲染期依赖） */
export function useFileOpenActions() {
  return { handlers }
}

/** 供插件读取注册 API（与 window.__fm_file_open 同一实例） */
export function getFileOpenApi(): FileOpenApi {
  return api
}
