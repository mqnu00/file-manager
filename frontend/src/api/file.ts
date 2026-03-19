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

// 创建文件夹
export const createFolder = (path: string, name: string): Promise<{ success: boolean }> => {
  return api.post('/folders', { path, name }).then(res => res.data)
}

// 移动文件/文件夹
export const moveFile = (fromPath: string, toPath: string): Promise<{ success: boolean }> => {
  return api.put('/files/move', { fromPath, toPath }).then(res => res.data)
}

// 压缩文件夹
export const zipFolder = (path: string): Promise<{ success: boolean; zipPath: string }> => {
  return api.post('/files/zip', { path }).then(res => res.data)
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
