/**
 * 前端插件上下文类型定义
 *
 * 定义前端插件 install(ctx) 中 ctx 的完整类型。
 * 保持与 frontend/src/context.ts 中的 ScriptContext 接口一致。
 *
 * 注意：本文件在 backend 包中定义，是因为前端包为 private 不发布。
 * 此处手工维护接口定义，前端 ScriptContext 变更时需同步更新。
 *
 * @keep-in-sync frontend/src/context.ts
 * @keep-in-sync frontend/src/stores/auth.ts
 * @keep-in-sync frontend/src/stores/file.ts
 * @keep-in-sync frontend/src/stores/task.ts
 * @keep-in-sync frontend/src/types/index.ts
 * @keep-in-sync frontend/src/api/auth.ts
 * @keep-in-sync frontend/src/api/file.ts
 * @keep-in-sync frontend/src/api/fileIO.ts
 * @keep-in-sync frontend/src/api/config.ts
 * @keep-in-sync frontend/src/api/task.ts
 * @keep-in-sync frontend/src/composables/useTheme.ts
 * @keep-in-sync frontend/src/composables/useContextMenu.ts
 * @keep-in-sync frontend/src/composables/useFileProgress.ts
 * @keep-in-sync frontend/src/composables/useFileSort.ts
 * @keep-in-sync frontend/src/platform/fileOpen.ts
 * @keep-in-sync frontend/src/utils/format.ts
 * @keep-in-sync frontend/src/pluginNav.ts
 * 漂移防线：frontend/test/types-sync.test-d.ts（vitest typecheck 双向断言，漂移即编译失败）
 */

import type { AxiosInstance } from 'axios'
import type {
  RouterOptions,
  Router,
  RouterHistory,
  RouteRecordRaw,
  RouteLocationNormalizedLoaded,
} from 'vue-router'
import type { Ref, ComputedRef } from 'vue'

import type { PluginInstallFunction } from './types'

// ==================== 基础数据类型（同步自 frontend/src/types/index.ts） ====================

export type TaskStatus = 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed'
export type TaskPhase = 'copy' | 'delete' | 'compress'
export type TaskType = 'move' | 'compress'

export interface MoveTaskMetadata {
  sourcePaths: string[]
  sourceNames: string[]
  targetPath: string
}

export interface CompressTaskMetadata {
  /** 待压缩条目（相对路径） */
  paths: string[]
  /** 显示用名称（与 paths 同序） */
  names: string[]
  /** 输出目录（相对路径） */
  outputDir: string
  /** 输出 zip 相对路径；创建时预计算，完成时由执行器回写最终值 */
  targetPath: string
}

export interface TaskInfo {
  id: string
  type: TaskType
  status: TaskStatus
  phase: TaskPhase
  progress: number
  speed: number
  totalSize: number
  startTime: number
  metadata: MoveTaskMetadata | CompressTaskMetadata
  currentFile?: string
  completedCount: number
  totalCount: number
  totalItemCount: number
  processedItemCount: number
  error?: string
}

export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  broken?: boolean
}

/** 插件页面导航项（注册进主应用顶栏导航区，经 window.__fm_nav_actions） */
export interface NavAction {
  /** 唯一 id（重复注册按 id 覆盖） */
  id: string
  /** 悬停提示/无障碍标签 */
  label: string
  /** 点击跳转的路由路径 */
  path: string
  /** 图标组件（插件自绘 SVG 组件或经类型门面引入的图标组件） */
  icon?: unknown
}

// ==================== Store 类型 ====================

/** Auth Store 公共 API（Pinia setup store，ref 已自动解包） */
export interface AuthStore {
  initialized: boolean
  sessionToken: string | null
  loginError: string | null
  isAuthenticated: boolean
  init(): Promise<void>
  login(token: string): Promise<boolean>
  logout(): Promise<void>
  clearSession(): void
}

/** File Store 公共 API */
export interface FileStore {
  currentPath: string
  files: FileItem[]
  selectedFiles: string[]
  loading: boolean
  error: string | null
  setFiles(fileList: FileItem[]): void
  setCurrentPath(path: string): void
  setSelectedFiles(paths: string[]): void
  setLoading(value: boolean): void
  setError(msg: string | null): void
  readonly selectedFileInfos: FileItem[]
  readonly isSingleFileSelected: boolean
  readonly isSingleFolderSelected: boolean
}

/** Task Store 公共 API */
export interface TaskStore {
  tasks: TaskInfo[]
  init(): Promise<void>
  startMoveTask(
    sourcePaths: string[],
    sourceNames: string[],
    targetPath: string,
    onComplete?: () => void
  ): Promise<void>
  /**
   * 挂载插件创建的后台任务（如压缩）：乐观插入 + 注册完成回调 + 建立 SSE 订阅。
   * 任务条目的创建/执行由插件后端完成。
   */
  attachTask(taskId: string, info: TaskInfo, onComplete?: () => void): void
  cancelTask(taskId: string): Promise<void>
  dismissTask(taskId: string): void
}

// ==================== API 模块类型 ====================

/** 认证 API（同步自 frontend/src/api/auth.ts） */
export interface AuthApi {
  login(token: string): Promise<{ success: boolean; sessionToken: string; expiresIn: number }>
  logout(): Promise<{ success: boolean }>
  checkAuth(): Promise<{ valid: boolean }>
}

/** 文件 API（同步自 frontend/src/api/file.ts） */
export interface FileApi {
  getFiles(path?: string): Promise<{ path: string; files: FileItem[] }>
  getFolders(path?: string): Promise<FileItem[]>
  getDirSize(path: string): Promise<{ size: number }>
  createFolder(path: string, name: string): Promise<{ success: boolean }>
  createFile(path: string, name: string): Promise<{ success: boolean }>
  moveFileAsync(
    fromPath: string,
    toPath: string,
    onProgress?: (progress: number, speed: number, totalSize: number) => void
  ): Promise<void>
  downloadFile(filePath: string): Promise<void>
  deleteFile(path: string): Promise<{ success: boolean }>
  batchDeleteFiles(
    paths: string[]
  ): Promise<{ success: number; failed: { path: string; message: string }[] }>
  renameFile(path: string, newName: string): Promise<{ success: boolean }>
  getLogs(params?: {
    date?: string
    startDate?: string
    endDate?: string
    level?: string
    action?: string
    keyword?: string
    page?: number
    pageSize?: number
  }): Promise<{
    logs: { time: string; level: string; action: string; detail: string }[]
    total: number
  }>
  getAvailableLogDates(): Promise<{ dates: string[] }>
}

/** 配置 API（同步自 frontend/src/api/config.ts） */
export interface ConfigApi {
  getConfig(): Promise<{
    auth: { token: string; tokenExpiryHours: number }
    storageRoot: string
    log: { cleanupOnStartup: boolean; retentionDays: number }
    pluginInstallDir?: string
  }>
  updateConfig(data: {
    auth?: { token?: string; tokenExpiryHours?: number }
    storageRoot?: string
    log?: { cleanupOnStartup?: boolean; retentionDays?: number }
    pluginInstallDir?: string
  }): Promise<{
    success: boolean
    config: {
      auth: { token: string; tokenExpiryHours: number }
      storageRoot: string
      log: { cleanupOnStartup: boolean; retentionDays: number }
      pluginInstallDir?: string
    }
    sessionsCleared: boolean
  }>
  cleanLogs(): Promise<{ success: boolean; deleted: number }>
}

/**
 * 通用文件 I/O 读取结果（同步自 frontend/src/api/fileIO.ts）
 *
 * 平台只做二进制透传：返回原始字节（base64）+ 文件总大小。
 * 是否文本、是否超限、如何解码，由消费方插件自行判断。
 */
export interface FileIOReadResult {
  /** 本次返回的起始偏移 */
  offset: number
  /** 实际返回字节数（≤ 8MB） */
  length: number
  /** 文件总大小（应用据此自行判断"太大"） */
  size: number
  /** base64 编码的原始字节 */
  data: string
}

/** 通用文件 I/O API（查看器等插件使用；由 file-viewer 插件后端上收的平台能力） */
export interface FileIOApi {
  /**
   * 读取文件二进制。省略 offset/length = 整文件读取（截断到 8MB，size 返回真实大小）；
   * 传 offset/length = 分页读取
   */
  read(path: string, offset?: number, length?: number): Promise<FileIOReadResult>
  /**
   * 写回文件二进制。省略 offset = 整文件覆盖（允许空内容清空文件）；
   * 传 offset = 定位写入
   */
  write(path: string, data: Uint8Array, offset?: number): Promise<void>
  /** 签发流令牌（有效期内可多次使用，供 <video>/<audio>/<iframe> 等无法带 header 的场景） */
  createToken(path: string): Promise<string>
  /** 构造流式 URL（需携带令牌） */
  streamUrl(token: string): string
  /** 将 base64 解码为 Uint8Array（兼容大块数据分批处理） */
  base64ToBytes(base64: string): Uint8Array
  /** 将 Uint8Array 编码为 base64 */
  bytesToBase64(bytes: Uint8Array): string
}

/** 任务 API（同步自 frontend/src/api/task.ts） */
export interface TaskApi {
  startMoveTask(sourcePaths: string[], targetPath: string): Promise<{ taskId: string }>
  getTasks(): Promise<{ tasks: TaskInfo[] }>
  cancelTask(taskId: string): Promise<{ success: boolean }>
  subscribeTask(
    taskId: string,
    handlers: {
      onState?(data: TaskInfo): void
      onProgress?(data: {
        progress: number
        speed: number
        totalSize: number
        currentFile?: string
        completedCount: number
        totalCount: number
        phase: string
      }): void
      onComplete?(): void
      onCancelled?(message?: string): void
      onError?(message: string): void
    }
  ): () => void
}

/** 前端 API 集合 */
export interface FrontendApi {
  instance: AxiosInstance
  auth: AuthApi
  file: FileApi
  fileIO: FileIOApi
  config: ConfigApi
  task: TaskApi
}

// ==================== Composable 类型 ====================

/** 主题定义（registerTheme 入参） */
export interface ThemeDefinition {
  /** 主题唯一标识，同时作为 localStorage 持久化值 */
  name: string
  /** 下拉框显示名称 */
  label: string
  /** 应用到 <html> 的类；light 为 ''（:root 即白天，无类） */
  className: string
  /** 可选主题样式文本，提供则由主项目注入 <style data-theme="name"> */
  css?: string
}

/** useTheme 返回类型 */
export interface ThemeComposable {
  themes: Ref<ThemeDefinition[]>
  activeTheme: Ref<ThemeDefinition>
  /** 是否为赛博主题（控制 SciFiBackground 等赛博特效显示） */
  isCyber: ComputedRef<boolean>
  setTheme(theme: string): void
  registerTheme(def: ThemeDefinition): void
  /** 反注册主题（插件卸载时由平台调用）：移除列表项/样式；若为活动主题则回退默认 */
  unregisterTheme(name: string): void
}

/** useContextMenu 返回类型（同步自 frontend/src/composables/useContextMenu.ts） */
export interface ContextMenuComposable {
  contextMenuVisible: Ref<boolean>
  contextMenuX: Ref<number>
  contextMenuY: Ref<number>
  contextMenuRow: Ref<FileItem | null>
  /**
   * 右键打开菜单（含视口边缘防溢出处理）。
   * event 参数声明为 any：真实签名接受 DOM MouseEvent，而 backend 无 DOM lib
   * 无法引用该类型；结构替身会因函数参数逆变破坏双向一致性断言，故做类型门面妥协
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowContextmenu(event: any, row: FileItem): void
  /** 关闭菜单 */
  closeContextMenu(): void
}

/** useFileProgress 返回类型（同步自 frontend/src/composables/useFileProgress.ts） */
export interface FileProgressComposable {
  /** 批量移动对话框状态 */
  moveState: {
    visible: boolean
    sourceNames: string[]
    sourcePaths: string[]
    targetPath: string
  }
  /** 打开批量移动对话框（展示已选条目与默认目标目录） */
  showBatchMoveDialog(paths: string[], names: string[]): void
  /** 确认移动：冲突检查 → 启动后台任务 → 关闭对话框 */
  moveFile(onComplete?: () => void): Promise<void>
}

/** useFileSort 返回类型（同步自 frontend/src/composables/useFileSort.ts） */
export interface FileSortComposable {
  sortBy: Ref<'name' | 'type' | 'modified' | 'size'>
  sortOrder: Ref<'asc' | 'desc'>
  handleSortChange(val: unknown): void
  toggleSortOrder(): void
  sortFiles(): void
}

// ==================== 平台扩展注册表 ====================

/**
 * 文件打开 handler：插件声明"能打开哪些文件"，主应用单击文件名时分发调用。
 *
 * 注册表经 `ctx.platform.fileOpen` 访问（与 window.__fm_file_open 同一实例）。
 * 主应用渲染文件列表时逐行调用 canOpen 判定并打 `is-openable` 标记，
 * 单击时调用首个命中 handler 的 open()；不再需要插件劫持 DOM 点击事件。
 */
export interface FileOpenHandler {
  /** 唯一 id（重复注册时按 id 覆盖替换） */
  id: string
  /** 该文件是否可由此 handler 打开（同步、轻量，渲染期会被逐行调用）；
   *  单击时 resolve 按此判定分发到 open() */
  canOpen(file: FileItem): boolean
  /** 控制 is-openable CSS 标记（蓝色悬浮）；缺省时等同 canOpen。
   *  用于将「能打开」和「应标记」分离——如默认打开器打开的文件不标蓝。 */
  isOpenable?(file: FileItem): boolean
  /** 消费打开请求（主应用单击文件且 canOpen 命中时调用） */
  open(file: FileItem): void | Promise<void>
}

/** 文件打开注册表 API（与 frontend/src/platform/fileOpen.ts 同步） */
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

// ==================== 插件路由声明 ====================

/**
 * 插件页面路由记录。
 *
 * 页面是否需要登录由插件自行声明：`meta.requiresAuth: true` 时，
 * 未登录访问该页面将被路由守卫重定向到 /login（登录后跳回原页面）。
 * 不声明（如纯主题、公开页面）则默认放行。
 */
export type PluginRouteRecord = Omit<RouteRecordRaw, 'meta'> & {
  meta?: {
    /** 页面是否需要登录：true 时未登录访问重定向到登录页 */
    requiresAuth?: boolean
  }
}

// ==================== 主接口 ====================

/** 插件 KV 数据接口（前端侧，经 HTTP 调用后端 ctx.storage；与后端 PluginKVStore 对应） */
export interface PluginDataApi {
  /** 读取键值（未设置返回 undefined） */
  get<T = unknown>(key: string): Promise<T | undefined>
  /** 写入键值 */
  set(key: string, value: unknown): Promise<void>
  /** 删除键值 */
  remove(key: string): Promise<void>
  /** 读取全部键值 */
  all(): Promise<Record<string, unknown>>
}

/**
 * 前端插件上下文
 *
 * 浏览器运行时通过 import() 动态加载插件后，调用 install(ctx) 时传入。
 * 插件通过 ctx 访问所有前端公共资源，不得直接 import vue / element-plus。
 */
export interface FrontendPluginContext {
  /** Vue 核心库命名空间 */
  Vue: typeof import('vue')

  /** Element Plus 完整命名空间 */
  ElementPlus: typeof import('element-plus')

  /** 按插件隔离的 KV 数据（经 HTTP 调用后端 ctx.storage；Demo 模式降级 localStorage） */
  pluginData: PluginDataApi

  /** Pinia 状态管理 stores */
  stores: {
    auth: AuthStore
    file: FileStore
    task: TaskStore
  }

  /** API 模块集合 */
  api: FrontendApi

  /** 组合式函数 */
  composables: {
    useTheme(): ThemeComposable
    useContextMenu(): ContextMenuComposable
    useFileProgress(): FileProgressComposable
    useFileSort(
      getFiles: () => FileItem[],
      setFiles: (files: FileItem[]) => void
    ): FileSortComposable
  }

  /** 平台扩展注册表（插件向主应用声明能力的挂载点集合） */
  platform: {
    /** 文件打开钩子：插件声明"能打开哪些文件"，主应用单击文件时分发 */
    fileOpen: FileOpenApi
    /** 插件集合变化事件名（主应用在加载/卸载/重载完成后广播） */
    PLUGINS_CHANGED_EVENT: string
  }

  /** 工具函数 */
  utils: {
    formatSize(size: number): string
    formatTime(time: string): string
    formatSpeed(speed: number): string
    formatProgress(percent: number, speed: number, totalSize?: number): string
  }

  /** 常量 */
  constants: {
    STORAGE_KEY_SESSION: string
    STORAGE_KEY_THEME: string
    THEME_CLASS_CYBER: string
    THEME_VALUE_CYBER: string
    THEME_VALUE_LIGHT: string
    API_BASE_URL: string
  }

  /** Vue Router 工厂函数 + 实例方法 */
  router: {
    createRouter(options: RouterOptions): Router
    createWebHistory(base?: string): RouterHistory
    createWebHashHistory(base?: string): RouterHistory
    /**
     * 注册插件页面路由。需要登录的页面声明 `meta: { requiresAuth: true }`，
     * 未登录访问会被重定向到登录页（登录后跳回原页面）。
     */
    addRoute(route: PluginRouteRecord): () => void
    /** 编程式导航（SPA 内跳转；适配 history/hash 双模式，替代插件自造 pushState hack） */
    push(to: Parameters<Router['push']>[0]): ReturnType<Router['push']>
    /** 编程式替换当前路由（如查看器"上一张/下一张"切换，避免历史栈膨胀） */
    replace(to: Parameters<Router['replace']>[0]): ReturnType<Router['replace']>
    /** 当前路由信息（Ref，读取 .value.query 等；与 frontend/src/context.ts 一致） */
    currentRoute: Ref<RouteLocationNormalizedLoaded>
  }
}

// ==================== 便捷类型别名 ====================

/**
 * 前端插件 teardown 契约：撤销 install 期间产生的全局副作用
 * （移除监听器/注销注册表条目/移除注入样式等）。
 * 平台卸载/重载插件时会调用；路由与主题由平台自动清理，无需插件处理。
 */
export type PluginTeardown = () => void | Promise<void>

/**
 * 前端插件 install 函数签名。
 * 返回值可扩展为 teardown 函数（可选）：返回 teardown = 插件声明
 * "install 期间的全局副作用由我撤销"；不返回 = 无全局副作用（路由由平台代管）。
 */
export type FrontendPluginInstallFunction = (
  ctx: FrontendPluginContext
) => void | Promise<void> | PluginTeardown | Promise<PluginTeardown>
