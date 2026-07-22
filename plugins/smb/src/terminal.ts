import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import xtermCss from '@xterm/xterm/css/xterm.css'

// 注入 xterm CSS（esbuild text loader 将 CSS 转为字符串）
if (typeof document !== 'undefined') {
  const styleId = 'xterm-plugin-style'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = xtermCss
    document.head.appendChild(style)
  }
}

const STORAGE_KEY_SESSION = 'session_token'

/**
 * 创建终端 WebSocket 连接并挂载到 xterm.js 实例。
 * 返回清理函数。
 */
export function createTerminal(
  container: HTMLElement,
  command: string | undefined,
  onExit: (code: number) => void,
  onClose: () => void,
  onClosedChange: (v: boolean) => void,
  onExitCodeChange: (v: number | null) => void,
): () => void {
  const term = new Terminal({
    theme: {
      background: '#1a1a2e',
      foreground: '#e0e0e0',
      cursor: '#00c853',
      cursorAccent: '#1a1a2e',
      green: '#00c853',
      red: '#f44336',
    },
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
    cursorBlink: true,
    allowProposedApi: true,
    cols: 100,
    rows: 20,
  })

  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(container)
  fitAddon.fit()

  let cleanup: (() => void) | null = null

  const sessionToken = localStorage.getItem(STORAGE_KEY_SESSION)
  if (sessionToken) {
    const base = window.location.origin
    const wsProtocol = base.startsWith('https') ? 'wss' : 'ws'
    const baseUrl = base.replace(/^https?:\/\//, '')

    let wsUrl: string
    if (command) {
      const cmdParts = command.split(' ')
      const cmd = cmdParts[0]
      const args = cmdParts.slice(1).join(' ')
      wsUrl = `${wsProtocol}://${baseUrl}/ws/terminal?token=${encodeURIComponent(sessionToken)}&cmd=${encodeURIComponent(cmd)}&args=${encodeURIComponent(args)}`
    } else {
      wsUrl = `${wsProtocol}://${baseUrl}/ws/terminal?token=${encodeURIComponent(sessionToken)}`
    }

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      if (command) {
        term.writeln(`$ ${command}`)
      }
      term.focus()
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'exit') {
          onExitCodeChange(msg.code)
          onClosedChange(true)
          term.options.disableStdin = true
          onExit(msg.code)
        } else if (msg.type === 'error') {
          term.writeln(`\x1b[31m[错误] ${msg.message}\x1b[0m`)
          onClosedChange(true)
          term.options.disableStdin = true
        }
      } catch {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      onClosedChange(true)
      term.options.disableStdin = true
    }

    term.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    cleanup = () => {
      term.dispose()
      ws.close()
    }
  } else {
    onClosedChange(true)
    cleanup = () => { term.dispose() }
  }

  // resize observer for FitAddon
  const observer = new ResizeObserver(() => {
    try { fitAddon.fit() } catch { /* */ }
  })
  observer.observe(container)

  return () => {
    observer.disconnect()
    if (cleanup) cleanup()
  }
}
