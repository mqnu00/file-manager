import { spawn, IPty } from 'node-pty'
import { WebSocket } from 'ws'

interface TerminalSession {
  pty: IPty
  viewers: Set<WebSocket>
  buffer: string[]
  onExit: (code: number) => void
  exitCode: number | null
  killing: boolean
}

let session: TerminalSession | null = null
const MAX_BUFFER = 500

// ==================== 内部辅助 ====================

function broadcast(data: string): void {
  if (!session) return
  for (const ws of session.viewers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }
}

function pushBuffer(data: string): void {
  if (!session) return
  session.buffer.push(data)
  if (session.buffer.length > MAX_BUFFER) {
    session.buffer.shift()
  }
}

// ==================== 创建/销毁会话 ====================

/**
 * 创建一个新的持久化 PTY 会话（不绑定到特定 WebSocket）。
 * 会立刻关闭已有会话。
 */
export function createSession(
  command: string,
  args: string[],
  onExit: (code: number) => void
): void {
  if (session) {
    killSession()
  }

  const pty = spawn(command, args, {
    name: 'xterm-256color',
    cols: 100,
    rows: 30,
    cwd: process.cwd(),
    env: process.env as Record<string, string>
  })

  session = {
    pty,
    viewers: new Set(),
    buffer: [],
    onExit,
    exitCode: null,
    killing: false
  }

  pty.onData((data: string) => {
    pushBuffer(data)
    broadcast(data)
  })

  pty.onExit(({ exitCode }) => {
    if (session) {
      session.exitCode = exitCode
      broadcast(JSON.stringify({ type: 'exit', code: exitCode }))
      // 通知所有 viewer 后关闭它们的 WebSocket
      for (const ws of session.viewers) {
        try { ws.close() } catch { /* ignore */ }
      }
      const cb = session.onExit
      session = null
      cb(exitCode)
    }
  })

  console.log(`Terminal session: ${command} ${args.join(' ')}`)
}

/**
 * 强制杀死当前会话（用于"停止"操作）。
 * 先发送 Ctrl+C，2 秒后强制 SIGKILL。
 */
export function killSession(): void {
  if (!session) return

  session.killing = true  // 立即标记为"停止中"，isRunning() 返回 false

  const s = session
  s.pty.write('\x03')

  setTimeout(() => {
    try { s.pty.kill('SIGKILL') } catch { /* ignore */ }
    for (const ws of s.viewers) {
      try { ws.close() } catch { /* ignore */ }
    }
    if (session === s) {
      session = null
    }
  }, 2000)
}

// ==================== Viewer 管理 ====================

/**
 * 将一个 WebSocket 作为 viewer 附加到当前会话。
 * 会自动重放缓冲区内容。
 * 返回 false 表示没有运行中的会话。
 */
export function attachViewer(ws: WebSocket): boolean {
  if (!session) return false

  session.viewers.add(ws)

  // 重放缓冲区
  for (const chunk of session.buffer) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk)
    }
  }

  // 如果进程已退出，发送退出消息
  if (session.exitCode !== null) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: session.exitCode }))
    }
    return true
  }

  // 处理 viewer 输入
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'input' && session?.pty) {
        session.pty.write(msg.data)
      } else if (msg.type === 'resize' && session?.pty) {
        session.pty.resize(msg.cols, msg.rows)
      }
    } catch {
      if (session?.pty) {
        session.pty.write(raw.toString())
      }
    }
  })

  // viewer 断开：只移除，不杀会话
  ws.on('close', () => {
    if (session) {
      session.viewers.delete(ws)
    }
  })

  return true
}

/** 从会话中移除 viewer（不杀会话） */
export function detachViewer(ws: WebSocket): void {
  if (session) {
    session.viewers.delete(ws)
  }
}

// ==================== 状态查询 ====================

export function isRunning(): boolean {
  return session !== null && !session.killing && session.pty.pid > 0
}

export function getSession(): { buffer: string[]; exitCode: number | null } | null {
  if (!session) return null
  return { buffer: session.buffer, exitCode: session.exitCode }
}
