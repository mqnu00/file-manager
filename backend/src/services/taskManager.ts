import { Response } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { TaskInfo, TaskStatus, TaskPhase, TaskType, MoveTaskMetadata, SSETaskMessage } from '../types'
import { setSSEHeaders, sendSSEMessage, endSSE } from '../utils/sse'
import { log } from '../utils/logger'
import { safePath } from '../utils/safePath'
import { copyWithCancel, removeSources } from './fileService'

/**
 * 任务持久化路径（与 config.yml 同目录）
 */
const CONFIG_DIR = process.env.CONFIG_PATH
  ? path.dirname(process.env.CONFIG_PATH)
  : path.join(__dirname, '../..')

const TASKS_FILE = path.join(CONFIG_DIR, 'tasks.json')

// ===== 任务清理定时器 =====
// 已完成/已取消的任务保留 5 分钟后自动清除
const TASK_RETENTION_MS = 5 * 60 * 1000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

// ===== 任务注册表 =====
interface TaskEntry {
  info: TaskInfo
  abortController: AbortController
  subscribers: Set<Response>
  completedCopies: string[] // Phase 1 已完成的复制目标路径（Phase 2 用于删除源文件）
}

const tasks = new Map<string, TaskEntry>()

// ===== 内部工具函数 =====

function generateId(): string {
  return crypto.randomUUID()
}

function now(): number {
  return Date.now()
}

/**
 * 计算总条目数（目录递归计文件数），用于进度计算
 */
function countItems(filePath: string): number {
  const fullPath = path.resolve(filePath)
  try {
    const stat = fs.statSync(fullPath)
    if (!stat.isDirectory()) return 1
    let count = 0
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
    for (const entry of entries) {
      count += countItems(path.join(fullPath, entry.name))
    }
    return count
  } catch {
    return 0
  }
}

// ===== 持久化 =====

function persist(): void {
  try {
    const data: Array<{
      id: string
      type: TaskType
      status: TaskStatus
      phase: TaskPhase
      progress: number
      speed: number
      totalSize: number
      startTime: number
      metadata: MoveTaskMetadata
      currentFile?: string
      completedCount: number
      totalCount: number
      totalItemCount: number
      processedItemCount: number
      error?: string
      _completedCopies?: string[]
    }> = []
    for (const [, entry] of tasks) {
      data.push({
        id: entry.info.id,
        type: entry.info.type,
        status: entry.info.status,
        phase: entry.info.phase,
        progress: entry.info.progress,
        speed: entry.info.speed,
        totalSize: entry.info.totalSize,
        startTime: entry.info.startTime,
        metadata: entry.info.metadata,
        currentFile: entry.info.currentFile,
        completedCount: entry.info.completedCount,
        totalCount: entry.info.totalCount,
        totalItemCount: entry.info.totalItemCount,
        processedItemCount: entry.info.processedItemCount,
        error: entry.info.error,
        _completedCopies: entry.completedCopies,
      })
    }
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    log('ERROR', 'task', `持久化任务失败: ${(e as Error).message}`)
  }
}

/**
 * 从磁盘加载任务。running 状态标记为 failed（服务器重启）。
 */
function load(): void {
  try {
    if (!fs.existsSync(TASKS_FILE)) return
    const raw = fs.readFileSync(TASKS_FILE, 'utf-8')
    const data = JSON.parse(raw) as Array<{
      id: string
      type: TaskType
      status: TaskStatus
      phase: TaskPhase
      progress: number
      speed: number
      totalSize: number
      startTime: number
      metadata: MoveTaskMetadata
      currentFile?: string
      completedCount: number
      totalCount: number
      totalItemCount: number
      processedItemCount: number
      error?: string
      _completedCopies?: string[]
    }>

    const nowTs = now()
    for (const item of data) {
      // 服务器重启，正在运行的任务标记为失败
      if (item.status === 'running' || item.status === 'cancelling') {
        item.status = 'failed'
        item.error = '服务器重启，任务中断'
      }

      const entry: TaskEntry = {
        info: {
          id: item.id,
          type: item.type,
          status: item.status,
          phase: item.phase,
          progress: item.progress,
          speed: item.speed,
          totalSize: item.totalSize,
          startTime: item.startTime || nowTs,
          metadata: item.metadata,
          currentFile: item.currentFile,
          completedCount: item.completedCount || 0,
          totalCount: item.totalCount || 0,
          totalItemCount: item.totalItemCount || 0,
          processedItemCount: item.processedItemCount || 0,
          error: item.error,
        },
        abortController: new AbortController(),
        subscribers: new Set(),
        completedCopies: item._completedCopies || [],
      }
      tasks.set(item.id, entry)
    }

    if (data.length > 0) {
      log('INFO', 'task', `从磁盘恢复 ${data.length} 个任务`)
    }
  } catch (e) {
    log('ERROR', 'task', `加载任务失败: ${(e as Error).message}`)
  }
}

// ===== 广播 =====

function broadcast(taskId: string, message: SSETaskMessage): void {
  const entry = tasks.get(taskId)
  if (!entry) return

  const deadSubscribers: Response[] = []
  for (const res of entry.subscribers) {
    try {
      sendSSEMessage(res, message)
    } catch {
      deadSubscribers.push(res)
    }
  }
  for (const res of deadSubscribers) {
    entry.subscribers.delete(res)
  }
}

// ===== 任务更新 =====

function updateTask(
  taskId: string,
  partial: Partial<TaskInfo> & { _completedCopies?: string[] }
): void {
  const entry = tasks.get(taskId)
  if (!entry) return

  Object.assign(entry.info, partial)
  if (partial._completedCopies) {
    entry.completedCopies = partial._completedCopies
  }

  // 广播进度
  const msg: SSETaskMessage = {
    type: 'progress',
    task: entry.info,
    progress: entry.info.progress,
    speed: entry.info.speed,
    totalSize: entry.info.totalSize,
    currentFile: entry.info.currentFile,
    completedCount: entry.info.completedCount,
    totalCount: entry.info.totalCount,
    phase: entry.info.phase,
  }
  broadcast(taskId, msg)
  persist()
}

// ===== 公开 API =====

export function createMoveTask(sourcePaths: string[], sourceNames: string[], targetPath: string): TaskInfo {
  const id = generateId()

  // 计算总条目数（含目录内嵌套文件）
  let totalItems = 0
  for (const p of sourcePaths) {
    totalItems += countItems(p)
  }

  const info: TaskInfo = {
    id,
    type: 'move',
    status: 'running',
    phase: 'copy',
    progress: 0,
    speed: 0,
    totalSize: 0,
    startTime: now(),
    metadata: { sourcePaths, sourceNames, targetPath },
    completedCount: 0,
    totalCount: sourcePaths.length,
    totalItemCount: totalItems,
    processedItemCount: 0,
  }

  const entry: TaskEntry = {
    info,
    abortController: new AbortController(),
    subscribers: new Set(),
    completedCopies: [],
  }

  tasks.set(id, entry)

  log('INFO', 'task', `创建移动任务 ${id}: ${sourceNames.length} 项 → ${targetPath}`)

  // 异步启动任务
  startMoveTask(id)

  return info
}

export function getTask(id: string): TaskInfo | undefined {
  return tasks.get(id)?.info
}

export function getAllTasks(): TaskInfo[] {
  return Array.from(tasks.values()).map((e) => e.info)
}

export function cancelTask(id: string): boolean {
  const entry = tasks.get(id)
  if (!entry) return false

  // 只有复制阶段可以取消
  if (entry.info.phase !== 'copy' || entry.info.status !== 'running') {
    return false
  }

  entry.info.status = 'cancelling'
  entry.abortController.abort()

  log('INFO', 'task', `取消移动任务 ${id}`)
  persist()
  return true
}

export function subscribe(taskId: string, res: Response): void {
  const entry = tasks.get(taskId)
  if (!entry) {
    sendSSEMessage(res, { type: 'error', message: '任务不存在' })
    endSSE(res)
    return
  }

  setSSEHeaders(res)
  entry.subscribers.add(res)

  // 立即发送当前状态快照
  const stateMsg: SSETaskMessage = {
    type: 'state',
    task: entry.info,
    progress: entry.info.progress,
    speed: entry.info.speed,
    totalSize: entry.info.totalSize,
    currentFile: entry.info.currentFile,
    completedCount: entry.info.completedCount,
    totalCount: entry.info.totalCount,
    phase: entry.info.phase,
  }
  sendSSEMessage(res, stateMsg)

  // 客户端断开时清理
  res.on('close', () => {
    entry.subscribers.delete(res)
  })
}

// ===== 定时清理 =====

function startCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = now() - TASK_RETENTION_MS
    for (const [id, entry] of tasks) {
      if (
        (entry.info.status === 'completed' || entry.info.status === 'cancelled' || entry.info.status === 'failed') &&
        entry.info.startTime < cutoff
      ) {
        tasks.delete(id)
      }
    }
    persist()
  }, 60_000) // 每分钟检查一次
}

// ===== 任务执行器 =====

async function startMoveTask(taskId: string): Promise<void> {
  const entry = tasks.get(taskId)
  if (!entry) return

  const { sourcePaths, sourceNames, targetPath } = entry.info.metadata
  const abortSignal = entry.abortController.signal

  // ===== Phase 1: 复制（可取消） =====
  for (let i = 0; i < sourcePaths.length; i++) {
    // 检查取消信号
    if (abortSignal.aborted) {
      break
    }

    const srcPath = sourcePaths[i]
    const srcName = sourceNames[i]
    const destPath = targetPath.replace(/\/$/, '') + '/' + srcName

    // 同目录跳过
    const srcDir = srcPath.substring(0, srcPath.lastIndexOf('/'))
    if (srcDir === targetPath) {
      entry.info.completedCount++
      continue
    }

    updateTask(taskId, {
      currentFile: srcName,
      completedCount: i + 1,
    })

    try {
      const itemCount = countItems(srcPath)

      const processedCount = await copyWithCancel(
        srcPath,
        destPath,
        abortSignal,
        (percent) => {
          // percent: 0-99, 当前源条目的复制进度
          const totalItems = entry.info.totalItemCount
          const baseItems = entry.info.processedItemCount
          const overallProgress = totalItems > 0
            ? Math.min(99, Math.floor(((baseItems + (percent / 100) * itemCount) / totalItems) * 100))
            : percent

          entry.info.progress = overallProgress
          broadcast(taskId, {
            type: 'progress',
            progress: overallProgress,
            speed: entry.info.speed,
            totalSize: entry.info.totalSize,
            currentFile: srcName,
            completedCount: entry.info.completedCount,
            totalCount: sourcePaths.length,
            phase: 'copy',
          })
        }
      )

      // 记录已复制的项目数
      entry.info.processedItemCount += processedCount
      entry.info.completedCount = i + 1
      entry.completedCopies.push(destPath)
    } catch (e: any) {
      if (e.message === 'CANCELLED') {
        break
      }
      // 复制失败，记录错误但继续
      entry.info.completedCount = i + 1
      log('ERROR', 'task', `复制失败: ${srcPath} → ${destPath}: ${e.message}`)
      continue
    }
  }

  // 如果被取消，清理目标位置
  if (abortSignal.aborted) {
    // 清理所有已复制到目标的内容
    for (const destPath of entry.completedCopies) {
      try {
        const fullPath = safePath(destPath)
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true })
        }
      } catch { /* ignore cleanup errors */ }
    }

    entry.info.status = 'cancelled'
    entry.info.progress = 0
    log('INFO', 'task', `移动任务 ${taskId} 已取消`)

    broadcast(taskId, { type: 'cancelled', message: '任务已取消' })
    persist()
    return
  }

  // ===== Phase 2: 删除（不可取消） =====
  entry.info.phase = 'delete'
  entry.info.progress = 99

  broadcast(taskId, {
    type: 'progress',
    progress: 99,
    speed: 0,
    phase: 'delete',
    completedCount: sourcePaths.length,
    totalCount: sourcePaths.length,
  })

  try {
    // 收集需要删除的源路径（跳过同目录的）
    const sourcesToRemove: string[] = []
    for (let i = 0; i < sourcePaths.length; i++) {
      const srcPath = sourcePaths[i]
      const srcDir = srcPath.substring(0, srcPath.lastIndexOf('/'))
      if (srcDir !== targetPath) {
        sourcesToRemove.push(srcPath)
      }
    }

    removeSources(sourcesToRemove)

    entry.info.status = 'completed'
    entry.info.progress = 100

    log('INFO', 'task', `移动任务 ${taskId} 完成`)

    broadcast(taskId, { type: 'complete' })
  } catch (e: any) {
    entry.info.status = 'failed'
    entry.info.error = `删除源文件失败: ${e.message}`
    log('ERROR', 'task', `移动任务 ${taskId} 删除阶段失败: ${e.message}`)

    broadcast(taskId, { type: 'error', message: entry.info.error })
  }

  persist()
}

// ===== 初始化 =====
load()
startCleanup()
