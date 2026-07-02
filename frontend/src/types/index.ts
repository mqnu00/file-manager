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
  disk: {
    path: string
    total: number
    free: number
    used: number
    usagePercent: number
    totalFormatted: string
    freeFormatted: string
    usedFormatted: string
  }
  node: {
    version: string
    pid: number
  }
}
