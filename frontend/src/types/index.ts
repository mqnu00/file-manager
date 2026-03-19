export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface FileState {
  currentPath: string
  files: FileItem[]
  selectedFiles: string[]
}
