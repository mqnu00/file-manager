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

export interface ZipCancelRequest {
  path: string
}

export interface CreateFolderRequest {
  path?: string
  name: string
}

/**
 * Express app.locals 类型
 */
export interface ArchiveLocals {
  activeArchives?: Record<string, any>
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
 * 压缩任务元数据
 */
export interface CompressTaskMetadata {
  sourcePath: string
  sourceName: string
  targetPath: string    // zip 文件路径
  totalBytes: number    // 源文件夹总字节数
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
 * 创建压缩任务请求
 */
export interface CompressTaskRequest {
  sourcePath: string
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
