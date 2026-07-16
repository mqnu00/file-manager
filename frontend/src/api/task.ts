import api from './index'
import type { TaskInfo } from '@/types'

/**
 * 创建移动任务
 */
export const startMoveTask = (
  sourcePaths: string[],
  targetPath: string
): Promise<{ taskId: string }> => {
  return api.post('/tasks/move', { sourcePaths, targetPath }).then((res) => res.data)
}

/**
 * 创建压缩任务
 */
export const startCompressTask = (
  sourcePath: string
): Promise<{ taskId: string }> => {
  return api.post('/tasks/compress', { sourcePath }).then((res) => res.data)
}

/**
 * 获取所有任务
 */
export const getTasks = (): Promise<{ tasks: TaskInfo[] }> => {
  return api.get('/tasks').then((res) => res.data)
}

/**
 * 取消任务
 */
export const cancelTask = (taskId: string): Promise<{ success: boolean }> => {
  return api.post(`/tasks/${taskId}/cancel`).then((res) => res.data)
}

/**
 * 订阅任务 SSE 流
 * 返回取消订阅函数
 */
export interface TaskEventCallbacks {
  onState?: (task: TaskInfo) => void
  onProgress?: (data: {
    progress: number
    speed: number
    totalSize: number
    currentFile?: string
    completedCount: number
    totalCount: number
    phase: string
  }) => void
  onComplete?: () => void
  onCancelled?: (message?: string) => void
  onError?: (message: string) => void
}

export function subscribeTask(taskId: string, callbacks: TaskEventCallbacks): () => void {
  let aborted = false
  const controller = new AbortController()

  // Demo 模式：模拟 SSE 事件
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    let progress = 0
    const totalBytes = 50 * 1024 * 1024 // 模拟 50MB

    const interval = setInterval(() => {
      if (aborted) {
        clearInterval(interval)
        return
      }

      const speed = Math.random() * 3 * 1024 * 1024 + 1 * 1024 * 1024 // 1-4 MB/s
      progress += (speed * 0.4 / totalBytes) * 100 // 每 0.4s 的进度增量
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        callbacks.onProgress?.({ progress: 100, speed: 0, totalSize: totalBytes, completedCount: 1, totalCount: 1, phase: '' })
        setTimeout(() => {
          if (!aborted) callbacks.onComplete?.()
        }, 500)
      } else {
        callbacks.onProgress?.({
          progress: Math.round(progress),
          speed,
          totalSize: totalBytes,
          currentFile: 'demo-folder',
          completedCount: 0,
          totalCount: 1,
          phase: '',
        })
      }
    }, 400)

    return () => {
      aborted = true
      clearInterval(interval)
    }
  }

  // 生产模式：使用 fetch SSE
  const token = localStorage.getItem('session_token') || ''

  fetch(`/api/tasks/${taskId}/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        callbacks.onError?.(`订阅失败: ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError?.('无法读取响应流')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      const processStream = (): void => {
        if (aborted) return

        reader.read().then(({ done, value }) => {
          if (done || aborted) return

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (data.type) {
                  case 'state':
                    callbacks.onState?.(data.task)
                    break
                  case 'progress':
                    callbacks.onProgress?.({
                      progress: data.progress,
                      speed: data.speed || 0,
                      totalSize: data.totalSize || 0,
                      currentFile: data.currentFile,
                      completedCount: data.completedCount || 0,
                      totalCount: data.totalCount || 0,
                      phase: data.phase || 'copy',
                    })
                    break
                  case 'complete':
                    callbacks.onComplete?.()
                    return
                  case 'cancelled':
                    callbacks.onCancelled?.(data.message)
                    return
                  case 'error':
                    callbacks.onError?.(data.message || '未知错误')
                    return
                }
              } catch {
                // 忽略 JSON 解析错误
              }
            }
          }

          processStream()
        })
      }

      processStream()
    })
    .catch((err) => {
      if (!aborted) {
        callbacks.onError?.(err.message || '连接失败')
      }
    })

  // 返回取消订阅函数
  return () => {
    aborted = true
    controller.abort()
  }
}
