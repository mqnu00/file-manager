import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface FileListResponse {
  path: string
  files: FileItem[]
}

// 获取文件列表
export const getFiles = (path: string = ''): Promise<FileListResponse> => {
  return api.get('/files', { params: { path } }).then(res => res.data)
}

// 获取文件夹列表（仅文件夹）
export const getFolders = (path: string = ''): Promise<FileItem[]> => {
  return api.get('/files', { params: { path } })
    .then(res => res.data.files.filter((f: FileItem) => f.isDirectory))
}

// 创建文件夹
export const createFolder = (path: string, name: string): Promise<{ success: boolean }> => {
  return api.post('/folders', { path, name }).then(res => res.data)
}

// 移动文件/文件夹（返回 EventSource）
export const moveFile = (fromPath: string, toPath: string): EventSource => {
  const params = new URLSearchParams()
  params.append('fromPath', fromPath)
  params.append('toPath', toPath)
  return new EventSource(`/api/files/move?${params.toString()}`)
}

// 压缩文件夹（返回 EventSource）
export const zipFolder = (path: string): EventSource => {
  return new EventSource(`/api/files/zip?path=${encodeURIComponent(path)}`)
}

// 取消压缩
export const cancelZip = (path: string): Promise<{ success: boolean }> => {
  return api.post('/files/zip/cancel', { path }).then(res => res.data)
}

// 删除文件/文件夹
export const deleteFile = (path: string): Promise<{ success: boolean }> => {
  return api.delete('/files', { params: { path } }).then(res => res.data)
}

// 重命名文件/文件夹
export const renameFile = (path: string, newName: string): Promise<{ success: boolean }> => {
  return api.put('/files/rename', { path, newName }).then(res => res.data)
}

export default api
