import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { STORAGE_ROOT } from '../../test/setup'

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

import { createMoveTask, createCompressTask, getTask, getAllTasks, cancelTask, subscribe } from './taskManager'
import { copyWithCancel, removeSources, compressWithCancel } from './fileService'

const mockedCopyWithCancel = vi.mocked(copyWithCancel)
const mockedRemoveSources = vi.mocked(removeSources)
const mockedCompressWithCancel = vi.mocked(compressWithCancel)

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

/** mock 的 express Response（subscribe/SSE 用） */
function makeRes() {
  const handlers: Record<string, () => void> = {}
  return {
    write: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb
    }),
    _emitClose: () => handlers['close']?.(),
  }
}

describe('taskManager 订阅与执行分支', () => {
  afterEach(() => {
    // 恢复默认：复制/压缩永不完成（与文件顶部 mock 一致）
    mockedCopyWithCancel.mockImplementation(() => new Promise(() => {}))
    mockedRemoveSources.mockImplementation(() => {})
    mockedCompressWithCancel.mockImplementation(() => new Promise(() => {}))
  })

  it('subscribe 立即发送 state 快照并注册 close 清理', async () => {
    const task = createMoveTask(['sub-src.txt'], ['sub-src.txt'], 'sub-target')
    await tick()
    const res = makeRes()
    subscribe(task.id, res)
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"type":"state"'))
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('subscribe 不存在的任务 → error 并结束响应', () => {
    const res = makeRes()
    subscribe('no-such-task', res)
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('任务不存在'))
    expect(res.end).toHaveBeenCalled()
  })

  it('断开连接的订阅者在广播时被剔除', async () => {
    const resolvers: Array<(n: number) => void> = []
    mockedCopyWithCancel.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve) }))
    const task = createMoveTask(['dead-src-1.txt', 'dead-src-2.txt'], ['dead-src-1.txt', 'dead-src-2.txt'], 'dead-target')
    await tick() // i=0 复制挂起（此时无订阅者）
    const res = makeRes()
    subscribe(task.id, res) // 快照 → 1 次写入
    // 快照发送后 arm：模拟客户端断开（写入抛错）
    res.write.mockImplementation(() => {
      throw new Error('closed')
    })
    resolvers[0]!(1) // i=0 完成 → i=1 updateTask 广播抛错 → 订阅者被剔除
    await tick()
    expect(res.write.mock.calls.length).toBe(2) // 1 快照 + 1 次抛错广播
    resolvers[1]!(1) // i=1 完成 → Phase2 complete 广播（订阅者已移除，不再写入）
    await tick()
    await tick()
    expect(res.write.mock.calls.length).toBe(2)
  })

  it('复制完成后取消 → 清理已复制目标并置 cancelled', async () => {
    let resolveCopy: ((n: number) => void) | undefined
    mockedCopyWithCancel.mockImplementation(() => new Promise((resolve) => { resolveCopy = resolve }))
    // 目标位置存在"已复制"的文件（用独有路径避免与其他用例冲突）
    fs.mkdirSync(path.join(STORAGE_ROOT, 'cancel-cleanup-target'), { recursive: true })
    fs.writeFileSync(path.join(STORAGE_ROOT, 'cancel-cleanup-target', 'cancel-cleanup-src.txt'), 'x', 'utf-8')

    const task = createMoveTask(['cancel-cleanup-src.txt'], ['cancel-cleanup-src.txt'], 'cancel-cleanup-target')
    await tick() // copyWithCancel 挂起
    expect(cancelTask(task.id)).toBe(true)
    resolveCopy!(1) // 复制完成，写入 completedCopies
    await tick()
    await tick()
    expect(getTask(task.id)!.status).toBe('cancelled')
    expect(getTask(task.id)!.progress).toBe(0)
    // 已复制到目标的文件被清理
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'cancel-cleanup-target', 'cancel-cleanup-src.txt'))).toBe(false)
  })

  it('Phase 2 删除源失败 → 任务 failed 并广播 error', async () => {
    let resolveCopy: ((n: number) => void) | undefined
    mockedCopyWithCancel.mockImplementation(() => new Promise((resolve) => { resolveCopy = resolve }))
    mockedRemoveSources.mockImplementation(() => {
      throw new Error('EACCES')
    })
    const res = makeRes()
    const task = createMoveTask(['del-fail-src.txt'], ['del-fail-src.txt'], 'del-fail-target')
    await tick() // copyWithCancel 挂起
    subscribe(task.id, res) // 快照
    resolveCopy!(1) // 复制完成 → Phase 2 removeSources 抛错 → 广播 error
    await tick()
    await tick()
    const info = getTask(task.id)!
    expect(info.status).toBe('failed')
    expect(info.error).toContain('删除源文件失败')
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
  })

  it('单文件复制失败不中断整体任务', async () => {
    mockedCopyWithCancel
      .mockImplementationOnce(async () => {
        throw new Error('boom')
      })
      .mockImplementation(async () => 1)
    mockedRemoveSources.mockImplementation(() => {})
    const task = createMoveTask(['fail1.txt', 'fail2.txt'], ['fail1.txt', 'fail2.txt'], 'resume-target')
    await tick()
    await tick()
    await tick()
    expect(getTask(task.id)!.status).toBe('completed')
    expect(mockedRemoveSources).toHaveBeenCalledWith(['fail1.txt', 'fail2.txt'])
  })

  it('压缩任务取消 → cancelled 并广播', async () => {
    mockedCompressWithCancel.mockImplementation((_s, _t, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('CANCELLED')), { once: true })
    }))
    const res = makeRes()
    const task = createCompressTask('zip-cancel-folder')
    await tick()
    subscribe(task.id, res)
    expect(cancelTask(task.id)).toBe(true)
    await tick()
    await tick()
    expect(getTask(task.id)!.status).toBe('cancelled')
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"type":"cancelled"'))
  })
})
