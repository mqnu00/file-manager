// ===== 后台任务类型 =====

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

export interface FileState {
  currentPath: string
  files: FileItem[]
  selectedFiles: string[]
}

export interface DiskInfo {
  device: string
  vendor: string
  model: string
  mountpoint: string
  mountpoints: string[]
  fstype: string
  total: number
  free: number
  used: number
  totalFormatted: string
  freeFormatted: string
  usedFormatted: string
  partitions: Array<{
    mountpoint: string
    totalFormatted: string
    usedFormatted: string
    percent: number
  }>
}

export interface SystemInfo {
  os: {
    type: string
    platform: string
    arch: string
    release: string
    hostname: string
    uptime: number
    uptimeFormatted: string
  }
  cpu: {
    model: string
    cores: number
    physicalCores: number
    speed: number
    usage: number
  }
  memory: {
    total: number
    free: number
    used: number
    usagePercent: number
    totalFormatted: string
    freeFormatted: string
    usedFormatted: string
  }
  disk: DiskInfo
  disks: DiskInfo[]
  node: {
    version: string
    pid: number
  }
}
