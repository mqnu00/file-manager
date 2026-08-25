/**
 * 文件管理模块类型定义
 */

/**
 * 文件信息对象
 */
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
  broken?: boolean
}

/**
 * SSE 进度消息类型
 */
export interface SSEProgressMessage {
  type: 'progress' | 'complete' | 'error'
  progress?: number
  zipPath?: string
  message?: string
  speed?: number
  totalSize?: number
}

/**
 * 请求体类型
 */
export interface MoveRequest {
  fromPath: string
  toPath: string
}

export interface RenameRequest {
  path: string
  newName: string
}

export interface DeleteRequest {
  path: string
}

export interface BatchDeleteRequest {
  paths: string[]
}

export interface CreateFolderRequest {
  path?: string
  name: string
}

export interface CreateFileRequest {
  path?: string
  name: string
}

/**
 * 后台任务状态
 */
export type TaskStatus = 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed'

/**
 * 移动任务阶段：复制（可取消）→ 删除（不可取消）
 */
export type TaskPhase = 'copy' | 'delete' | 'compress'

/**
 * 任务类型
 */
export type TaskType = 'move' | 'compress'

/**
 * 移动任务元数据
 */
export interface MoveTaskMetadata {
  sourcePaths: string[]
  sourceNames: string[]
  targetPath: string
}

/**
 * 压缩任务元数据（由 compress 插件创建并驱动执行）
 */
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

/**
 * 任务元数据联合类型
 */
export type TaskMetadata = MoveTaskMetadata | CompressTaskMetadata

/**
 * 后台任务信息
 */
export interface TaskInfo {
  id: string
  type: TaskType
  status: TaskStatus
  phase: TaskPhase
  progress: number         // 0-100
  speed: number            // MB/s
  totalSize: number        // bytes
  startTime: number        // timestamp
  metadata: TaskMetadata
  currentFile?: string     // 当前正在处理的文件名
  completedCount: number   // 已完成文件数
  totalCount: number       // 总文件数
  totalItemCount: number   // 总条目数（含目录内嵌套文件，用于进度计算）
  processedItemCount: number // 已处理条目数
  error?: string
}

/**
 * 创建移动任务请求
 */
export interface MoveTaskRequest {
  sourcePaths: string[]
  targetPath: string
}

/**
 * SSE 任务事件
 */
export interface SSETaskMessage {
  type: 'state' | 'progress' | 'complete' | 'cancelled' | 'error'
  task?: TaskInfo
  progress?: number
  speed?: number
  totalSize?: number
  currentFile?: string
  completedCount?: number
  totalCount?: number
  phase?: TaskPhase
  message?: string
}
