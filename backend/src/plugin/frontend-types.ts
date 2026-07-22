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
  startCompressTask(sourcePath: string, onComplete?: () => void): Promise<void>
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
  compress(sourcePath: string): Promise<{ taskId: string }>
  upload(formData: FormData, onProgress?: (pct: number) => void): Promise<void>
  download(path: string): Promise<Blob>
  search(query: string, dir?: string): Promise<{ files: FileItem[] }>
}

/** 配置 API */
export interface ConfigApi {
  get(): Promise<Record<string, unknown>>
  update(updates: Record<string, unknown>): Promise<void>
}

/** SMB API */
export interface SmbApi {
  getStatus(): Promise<{ running: boolean; port?: number }>
  start(): Promise<void>
  stop(): Promise<void>
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
  config: ConfigApi
  smb: SmbApi
  task: TaskApi
  system: SystemApi
}

// ==================== Composable 类型 ====================

/** useTheme 返回类型 */
export interface ThemeComposable {
  isDark: Ref<boolean>
  toggleTheme(): void
  setTheme(theme: string): void
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
    addRoute: Router['addRoute']
  }
}

// ==================== 便捷类型别名 ====================

/** 前端插件 install 函数签名 */
export type FrontendPluginInstallFunction = PluginInstallFunction<FrontendPluginContext>
