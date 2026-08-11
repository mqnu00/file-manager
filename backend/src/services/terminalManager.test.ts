import { describe, it, expect, vi, beforeEach } from 'vitest'

/** 捕获最近一次 node-pty spawn 返回的 fake pty，供测试触发 onData/onExit */
const h = vi.hoisted(() => ({
  lastPty: null as unknown as {
    onData: ReturnType<typeof vi.fn>
    onExit: ReturnType<typeof vi.fn>
    write: ReturnType<typeof vi.fn>
    kill: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    pid: number
  },
}))

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    const pty = {
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
      pid: 4242,
    }
    h.lastPty = pty
    return pty
  }),
}))

import { createSession, killSession, attachViewer, detachViewer, isRunning, getSession } from './terminalManager'

interface FakeWs {
  readyState: number
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  _emit: (evt: string, data?: unknown) => void
}

function fakeWs(): FakeWs {
  const handlers: Record<string, (data?: unknown) => void> = {}
  const ws = {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((evt: string, cb: (data?: unknown) => void) => {
      handlers[evt] = cb
    }),
    _emit(evt: string, data?: unknown) {
      handlers[evt]?.(data)
    },
  }
  return ws
}

beforeEach(() => {
  // 强制清理上一用例残留会话：触发 pty.onExit 使 session 置空（killSession 有 2s 定时器，等不起）
  if (h.lastPty && getSession()) {
    const exitCb = h.lastPty.onExit.mock.calls[0]?.[0]
    exitCb?.({ exitCode: 0 })
  }
  vi.clearAllMocks()
})

describe('terminalManager', () => {
  it('createSession：spawn 并注册 onData/onExit，isRunning 为 true', () => {
    const onExit = vi.fn()
    createSession('bash', ['-c', 'ls'], onExit)
    expect(h.lastPty).toBeTruthy()
    expect(isRunning()).toBe(true)
    expect(getSession()).toMatchObject({ buffer: [], exitCode: null })
  })

  it('attachViewer：无会话返回 false', () => {
    expect(attachViewer(fakeWs())).toBe(false)
  })

  it('attachViewer：重放缓冲并转发数据', () => {
    createSession('bash', [], vi.fn())
    // 模拟 pty 输出写入缓冲
    h.lastPty.onData.mock.calls[0][0]('hello')
    const ws = fakeWs()
    expect(attachViewer(ws)).toBe(true)
    expect(ws.send).toHaveBeenCalledWith('hello')

    // 新输出同时广播给 viewer
    h.lastPty.onData.mock.calls[0][0](' world')
    expect(ws.send).toHaveBeenCalledWith(' world')
  })

  it('viewer 输入转发到 pty（input 类型）', () => {
    createSession('bash', [], vi.fn())
    const ws = fakeWs()
    attachViewer(ws)
    ws._emit('message', JSON.stringify({ type: 'input', data: 'ls\n' }))
    expect(h.lastPty.write).toHaveBeenCalledWith('ls\n')
  })

  it('viewer resize 转发到 pty', () => {
    createSession('bash', [], vi.fn())
    const ws = fakeWs()
    attachViewer(ws)
    ws._emit('message', JSON.stringify({ type: 'resize', cols: 80, rows: 24 }))
    expect(h.lastPty.resize).toHaveBeenCalledWith(80, 24)
  })

  it('viewer 断开只移除不杀会话', () => {
    createSession('bash', [], vi.fn())
    const ws = fakeWs()
    attachViewer(ws)
    ws._emit('close')
    // 会话仍在运行
    expect(isRunning()).toBe(true)
  })

  it('pty 退出：广播 exit、关闭 viewer、清除会话并回调', () => {
    const onExit = vi.fn()
    createSession('bash', [], onExit)
    const ws = fakeWs()
    attachViewer(ws)

    h.lastPty.onExit.mock.calls[0][0]({ exitCode: 0 })
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'exit', code: 0 }))
    expect(ws.close).toHaveBeenCalled()
    expect(isRunning()).toBe(false)
    expect(onExit).toHaveBeenCalledWith(0)
    expect(getSession()).toBeNull()
  })

  it('killSession：标记停止中，isRunning 返回 false', () => {
    createSession('bash', [], vi.fn())
    expect(isRunning()).toBe(true)
    killSession()
    expect(isRunning()).toBe(false)
    expect(h.lastPty.write).toHaveBeenCalledWith('\x03')
  })

  it('detachViewer：从会话移除 viewer 后不再收到广播', () => {
    createSession('bash', [], vi.fn())
    const ws = fakeWs()
    attachViewer(ws)
    detachViewer(ws)
    h.lastPty.onData.mock.calls[0][0]('no one sees this')
    expect(ws.send).not.toHaveBeenCalled()
  })
})
