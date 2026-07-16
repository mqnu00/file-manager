import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TaskInfo } from '@/types'
import { startMoveTask as startMoveTaskApi, getTasks, cancelTask as cancelTaskApi, subscribeTask } from '@/api/task'
import { ElMessage } from 'element-plus'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<TaskInfo[]>([])

  // 活跃的 SSE 取消函数映射 taskId → cleanup
  const subscriptions = new Map<string, () => void>()

  // 任务完成回调 taskId → callback
  const completeCallbacks = new Map<string, () => void>()

  /**
   * 页面加载时初始化：获取任务列表，为 running 状态的任务建立 SSE 订阅
   */
  async function init(): Promise<void> {
    try {
      const res = await getTasks()
      tasks.value = res.tasks

      // 为正在运行的任务重新建立 SSE 订阅
      for (const task of res.tasks) {
        if (task.status === 'running' || task.status === 'cancelling') {
          subscribeToTask(task.id)
        }
      }
    } catch {
      // 静默失败（可能是 demo 模式或网络问题）
    }
  }

  /**
   * 订阅单个任务的 SSE 流
   */
  function subscribeToTask(taskId: string): void {
    // 避免重复订阅
    if (subscriptions.has(taskId)) return

    const unsubscribe = subscribeTask(taskId, {
      onState(data: TaskInfo) {
        updateTaskFromServer(taskId, data)
      },
      onProgress(data) {
        const task = tasks.value.find((t) => t.id === taskId)
        if (task) {
          task.progress = data.progress
          task.speed = data.speed
          task.totalSize = data.totalSize
          task.currentFile = data.currentFile
          task.completedCount = data.completedCount
          task.totalCount = data.totalCount
          task.phase = data.phase as TaskInfo['phase']
        }
      },
      onComplete() {
        updateTaskFromServer(taskId, { status: 'completed', progress: 100, phase: 'delete' })
        unsubscribeFromTask(taskId)
        // 调用完成回调
        const cb = completeCallbacks.get(taskId)
        completeCallbacks.delete(taskId)
        if (cb) cb()
      },
      onCancelled(message) {
        updateTaskFromServer(taskId, { status: 'cancelled', progress: 0 })
        ElMessage.info(message || '任务已取消')
        unsubscribeFromTask(taskId)
      },
      onError(message) {
        updateTaskFromServer(taskId, { status: 'failed', error: message })
        ElMessage.error(message)
        unsubscribeFromTask(taskId)
      },
    })

    subscriptions.set(taskId, unsubscribe)
  }

  /**
   * 根据服务端数据更新本地任务状态
   */
  function updateTaskFromServer(taskId: string, partial: Partial<TaskInfo>): void {
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...partial }
    } else if (partial.id) {
      tasks.value.push(partial as TaskInfo)
    }
  }

  /**
   * 取消 SSE 订阅
   */
  function unsubscribeFromTask(taskId: string): void {
    const cleanup = subscriptions.get(taskId)
    if (cleanup) {
      cleanup()
      subscriptions.delete(taskId)
    }
  }

  /**
   * 发起移动任务
   */
  async function startMoveTask(
    sourcePaths: string[],
    sourceNames: string[],
    targetPath: string,
    onComplete?: () => void
  ): Promise<void> {
    try {
      const { taskId } = await startMoveTaskApi(sourcePaths, targetPath)

      // 添加本地任务（乐观更新）
      tasks.value.unshift({
        id: taskId,
        type: 'move',
        status: 'running',
        phase: 'copy',
        progress: 0,
        speed: 0,
        totalSize: 0,
        startTime: Date.now(),
        metadata: { sourcePaths, sourceNames, targetPath },
        completedCount: 0,
        totalCount: sourcePaths.length,
        totalItemCount: 0,
        processedItemCount: 0,
      })

      ElMessage.success('移动任务已启动')

      // 存储完成回调
      if (onComplete) {
        completeCallbacks.set(taskId, onComplete)
      }

      // 订阅 SSE 进度
      subscribeToTask(taskId)
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || '启动移动任务失败')
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId: string): Promise<void> {
    try {
      await cancelTaskApi(taskId)
      // 取消 SSE 订阅 + 更新本地状态
      unsubscribeFromTask(taskId)
      updateTaskFromServer(taskId, { status: 'cancelled', progress: 0 })
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || '取消失败')
    }
  }

  /**
   * 从面板移除已完成/已取消的任务
   */
  function dismissTask(taskId: string): void {
    unsubscribeFromTask(taskId)
    tasks.value = tasks.value.filter((t) => t.id !== taskId)
  }

  return {
    tasks,
    init,
    startMoveTask,
    cancelTask,
    dismissTask,
  }
})
