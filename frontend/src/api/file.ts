import api from './index'
import type { FileItem } from '@/types'

export interface FileListResponse {
  path: string
  files: FileItem[]
}

// 获取文件列表
export const getFiles = (path: string = ''): Promise<FileListResponse> => {
  return api.get('/files', { params: { path } }).then((res) => res.data)
}

// 获取文件夹列表（仅文件夹）
export const getFolders = (path: string = ''): Promise<FileItem[]> => {
  return api
    .get('/files', { params: { path } })
    .then((res) => res.data.files.filter((f: FileItem) => f.isDirectory))
}

// 获取文件夹大小
export const getDirSize = (path: string): Promise<{ size: number }> => {
  return api.get('/files/dirsize', { params: { path } }).then((res) => res.data)
}

// 创建文件夹
export const createFolder = (path: string, name: string): Promise<{ success: boolean }> => {
  return api.post('/folders', { path, name }).then((res) => res.data)
}

// 移动文件/文件夹（返回 ReadableStream — 内部使用）
export const moveFile = (fromPath: string, toPath: string): ReadableStream<Uint8Array> | null => {
  const response = fetch('/api/files/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('session_token') || ''}`,
    },
    body: JSON.stringify({ fromPath, toPath }),
  })
  return null // Will be handled by moveFileAsync
}

// 移动文件/文件夹（Promise 版本 + 进度回调 — 给 composable 使用）
export const moveFileAsync = (
  fromPath: string,
  toPath: string,
  onProgress?: (progress: number, speed: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    fetch('/api/files/move', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('session_token') || ''}`,
      },
      body: JSON.stringify({ fromPath, toPath }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('移动失败')
        }
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法读取响应流')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        const processStream = (): void => {
          reader.read().then(({ done, value }) => {
            if (done) {
              resolve()
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type === 'progress') {
                    onProgress?.(data.progress, data.speed || 0)
                  } else if (data.type === 'complete') {
                    resolve()
                    return
                  } else if (data.type === 'error') {
                    reject(new Error(data.message || '移动失败'))
                    return
                  }
                } catch {
                  // Ignore JSON parse errors
                }
              }
            }

            processStream()
          })
        }

        processStream()
      })
      .catch((error) => {
        reject(error instanceof Error ? error : new Error('移动失败'))
      })
  })
}

// 压缩文件夹（返回 EventSource — 内部使用）
export const zipFolder = (path: string): EventSource => {
  return new EventSource(`/api/files/zip?path=${encodeURIComponent(path)}`)
}

// 压缩文件夹（Promise 版本 + 进度回调 — 给 composable 使用）
export const zipFolderAsync = (
  path: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const es = zipFolder(path)

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
        onProgress?.(data.progress)
      } else if (data.type === 'complete') {
        es.close()
        resolve()
      } else if (data.type === 'error') {
        es.close()
        reject(new Error(data.message || '压缩失败'))
      }
    }

    es.onerror = () => {
      es.close()
      reject(new Error('压缩失败，请重试'))
    }
  })
}

// 取消压缩
export const cancelZip = (path: string): Promise<{ success: boolean }> => {
  return api.post('/files/zip/cancel', { path }).then((res) => res.data)
}

// 删除文件/文件夹
export const deleteFile = (path: string): Promise<{ success: boolean }> => {
  return api.delete('/files', { params: { path } }).then((res) => res.data)
}

export interface BatchDeleteResponse {
  success: number
  failed: { path: string; message: string }[]
}

// 批量删除文件/文件夹
export const batchDeleteFiles = (paths: string[]): Promise<BatchDeleteResponse> => {
  return api.post('/files/batch-delete', { paths }).then((res) => res.data)
}

// 重命名文件/文件夹
export const renameFile = (path: string, newName: string): Promise<{ success: boolean }> => {
  return api.put('/files/rename', { path, newName }).then((res) => res.data)
}

export default api
