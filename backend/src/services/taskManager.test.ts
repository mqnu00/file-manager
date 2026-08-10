import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * mock fileService：copyWithCancel/compressWithCancel 返回永不 resolve 的 Promise，
 * 使任务稳定保持 running/copy 状态，冲突检测与取消逻辑可确定性测试。
 * （真实文件复制/压缩行为已由 routes/files.test.ts 集成覆盖）
 */
vi.mock('./fileService', () => ({
  copyWithCancel: vi.fn(() => new Promise(() => {})),
  removeSources: vi.fn(),
  compressWithCancel: vi.fn(() => new Promise(() => {})),
}))

import { createMoveTask, createCompressTask, getTask, getAllTasks, cancelTask } from './taskManager'

const TASKS_FILE = path.join(path.dirname(process.env.CONFIG_PATH!), 'tasks.json')

/** 等待异步 startMoveTask 完成首次 updateTask（触发 persist） */
const tick = () => new Promise((r) => setTimeout(r, 10))

interface PersistedTask {
  id: string
  status: string
}

function readPersisted(): PersistedTask[] {
  if (!fs.existsSync(TASKS_FILE)) return []
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8')) as PersistedTask[]
}

/** 捕获 createMoveTask 抛出的错误，返回其 code */
function conflictCode(fn: () => unknown): string | undefined {
  try {
    fn()
    return undefined
  } catch (e) {
    return (e as { code?: string }).code
  }
}

describe('taskManager 任务注册', () => {
  it('createMoveTask 创建任务并注册到 registry', () => {
    const task = createMoveTask(['reg-src.txt'], ['reg-src.txt'], 'reg-target')
    expect(task.type).toBe('move')
    expect(task.status).toBe('running')
    expect(task.phase).toBe('copy')
    expect(task.progress).toBe(0)
    expect(task.metadata).toMatchObject({
      sourcePaths: ['reg-src.txt'],
      sourceNames: ['reg-src.txt'],
      targetPath: 'reg-target',
    })
    expect(getTask(task.id)).toBe(task)
    expect(getAllTasks().some((t) => t.id === task.id)).toBe(true)
  })

  it('createCompressTask 创建压缩任务', () => {
    const task = createCompressTask('reg-folder')
    expect(task.type).toBe('compress')
    expect(task.status).toBe('running')
    expect(task.phase).toBe('compress')
    expect(task.metadata).toMatchObject({
      sourcePath: 'reg-folder',
      sourceName: 'reg-folder',
      targetPath: './reg-folder.zip',
    })
  })

  it('getTask 对不存在的 id 返回 undefined', () => {
    expect(getTask('no-such-id')).toBeUndefined()
  })
})

describe('taskManager 冲突检测', () => {
  it('新任务源路径与运行中任务源重叠 → TASK_CONFLICT', () => {
    createMoveTask(['conflict-src.txt'], ['conflict-src.txt'], 'target-a')
    expect(conflictCode(() => createMoveTask(['conflict-src.txt'], ['conflict-src.txt'], 'target-b'))).toBe(
      'TASK_CONFLICT'
    )
  })

  it('新任务源路径与运行中任务目标重叠 → TASK_CONFLICT', () => {
    // 已有任务的目标文件为 conflict-target/other-src.txt
    createMoveTask(['other-src.txt'], ['other-src.txt'], 'conflict-target')
    // 新任务以该目标文件作为源 → 源/目标交叉重叠
    expect(conflictCode(() => createMoveTask(['conflict-target/other-src.txt'], ['x.txt'], 'elsewhere'))).toBe(
      'TASK_CONFLICT'
    )
  })

  it('新任务目标与运行中任务源重叠 → TASK_CONFLICT', () => {
    createMoveTask(['victim-src.txt'], ['victim-src.txt'], 'victim-target')
    expect(conflictCode(() => createMoveTask(['victim-target'], ['victim-target'], 'elsewhere'))).toBe(
      'TASK_CONFLICT'
    )
  })

  it('无路径重叠可正常创建', () => {
    expect(() => createMoveTask(['free-src.txt'], ['free-src.txt'], 'free-target')).not.toThrow()
  })
})

describe('cancelTask', () => {
  it('running + copy 阶段任务可取消，状态变为 cancelling', () => {
    const task = createMoveTask(['cancel-src.txt'], ['cancel-src.txt'], 'cancel-target')
    expect(cancelTask(task.id)).toBe(true)
    expect(getTask(task.id)!.status).toBe('cancelling')
  })

  it('不存在的任务 → false', () => {
    expect(cancelTask('no-such-id')).toBe(false)
  })

  it('已处于 cancelling 的任务不可重复取消', () => {
    const task = createMoveTask(['cancel2-src.txt'], ['cancel2-src.txt'], 'cancel2-target')
    cancelTask(task.id)
    expect(cancelTask(task.id)).toBe(false)
  })
})

describe('任务持久化', () => {
  it('创建任务后写入 tasks.json（位于 CONFIG_DIR）', async () => {
    const task = createMoveTask(['persist-src.txt'], ['persist-src.txt'], 'persist-target')
    await tick()
    expect(fs.existsSync(TASKS_FILE)).toBe(true)
    expect(readPersisted().some((t) => t.id === task.id)).toBe(true)
  })

  it('取消后任务以 cancelling 状态记录（记录当前行为）', async () => {
    const task = createMoveTask(['persist2-src.txt'], ['persist2-src.txt'], 'persist2-target')
    await tick()
    cancelTask(task.id)
    const item = readPersisted().find((t) => t.id === task.id)
    expect(item?.status).toBe('cancelling')
  })
})
