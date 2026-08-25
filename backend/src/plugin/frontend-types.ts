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
 */

import type { AxiosInstance } from 'axios'
import type {
  RouterOptions,
  Router,
  RouterHistory,
  RouteRecordRaw,
  RouteLocationNormalizedLoaded,
} from 'vue-router'
import type { Ref } from 'vue'

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
  sourcePath: string
  sourceName: string
  targetPath: string
  totalBytes: number
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
  cancelTask(taskId: string): Promise<void>
  dismissTask(taskId: string): void
}

// ==================== API 模块类型 ====================

/** 认证 API */
export interface AuthApi {
  login(token: string): Promise<{ sessionToken: string }>
  logout(): Promise<void>
  checkAuth(): Promise<{ valid: boolean }>
}

/** 文件 API */
export interface FileApi {
  list(dirPath?: string): Promise<{ files: FileItem[] }>
  get(path: string): Promise<unknown>
  createDir(path: string): Promise<void>
  delete(paths: string[]): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  move(sourcePaths: string[], targetPath: string): Promise<{ taskId: string }>
  upload(formData: FormData, onProgress?: (pct: number) => void): Promise<void>
  download(path: string): Promise<Blob>
  search(query: string, dir?: string): Promise<{ files: FileItem[] }>
}

/** 配置 API */
export interface ConfigApi {
  get(): Promise<Record<string, unknown>>
  update(updates: Record<string, unknown>): Promise<void>
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

/** 任务 API */
export interface TaskApi {
  getTasks(): Promise<{ tasks: TaskInfo[] }>
  cancelTask(taskId: string): Promise<void>
  subscribeTask(
    taskId: string,
    handlers: {
      onState?(data: TaskInfo): void
      onProgress?(data: { progress: number; speed: number; totalSize: number;
        currentFile?: string; completedCount: number; totalCount: number; phase?: TaskPhase }): void
      onComplete?(): void
      onCancelled?(message: string): void
      onError?(message: string): void
    }
  ): () => void
}

/** 系统 API */
export interface SystemApi {
  info(): Promise<Record<string, unknown>>
}

/** 前端 API 集合 */
export interface FrontendApi {
  instance: AxiosInstance
  auth: AuthApi
  file: FileApi
  fileIO: FileIOApi
  config: ConfigApi
  task: TaskApi
  system: SystemApi
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
  isCyber: Ref<boolean>
  setTheme(theme: string): void
  registerTheme(def: ThemeDefinition): void
}

/** useContextMenu 返回类型 */
export interface ContextMenuComposable {
  visible: Ref<boolean>
  position: Ref<{ x: number; y: number }>
  open(event: unknown): void
  close(): void
}

/** useFileProgress 返回类型 */
export interface FileProgressComposable {
  progress: Ref<number>
  speed: Ref<number>
  reset(): void
}

/** useFileSort 返回类型 */
export interface FileSortComposable {
  sortField: Ref<string>
  sortOrder: Ref<string>
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
    useFileSort(): FileSortComposable
  }

  /** 工具函数 */
  utils: {
    formatSize(bytes: number): string
    formatTime(ms: number): string
    formatSpeed(bytesPerSec: number): string
    formatProgress(pct: number): string
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
    /** 当前路由信息（Ref，读取 .value.query 等；与 frontend/src/context.ts 一致） */
    currentRoute: Ref<RouteLocationNormalizedLoaded>
  }
}

// ==================== 便捷类型别名 ====================

/** 前端插件 install 函数签名 */
export type FrontendPluginInstallFunction = PluginInstallFunction<FrontendPluginContext>
