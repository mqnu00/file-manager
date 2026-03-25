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
