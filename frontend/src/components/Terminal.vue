<template>
  <div class="terminal-wrapper">
    <div ref="termRef" class="terminal" />
    <div v-if="closed" class="terminal-closed">
      <span v-if="exitCode === 0" class="exit-success">进程已结束 (退出码: 0)</span>
      <span v-else class="exit-error">进程已结束 (退出码: {{ exitCode }})</span>
      <el-button size="small" text @click="$emit('close')">关闭终端</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { STORAGE_KEY_SESSION } from '@/constants'

const props = defineProps<{
  command?: string
}>()

const emit = defineEmits<{
  exit: [code: number]
  close: []
}>()

const termRef = ref<HTMLElement | null>(null)
const closed = ref(false)
const exitCode = ref<number | null>(null)

let terminal: Terminal | null = null
let ws: WebSocket | null = null
const fitAddon = new FitAddon()

function connect() {
  const sessionToken = localStorage.getItem(STORAGE_KEY_SESSION)
  if (!sessionToken) {
    return
  }

  const base = window.location.origin
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws'
  const baseUrl = base.replace(/^https?:\/\//, '')

  let wsUrl: string
  if (props.command) {
    // 模式 A：提供了命令 → 创建新会话（安装等）
    const cmdParts = props.command.split(' ')
    const cmd = cmdParts[0]
    const args = cmdParts.slice(1).join(' ')
    wsUrl = `${wsProtocol}://${baseUrl}/ws/terminal?token=${encodeURIComponent(sessionToken)}&cmd=${encodeURIComponent(cmd)}&args=${encodeURIComponent(args)}`
  } else {
    // 模式 B：无命令 → 附加到现有会话作为 viewer
    wsUrl = `${wsProtocol}://${baseUrl}/ws/terminal?token=${encodeURIComponent(sessionToken)}`
  }

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    if (terminal) {
      if (props.command) {
        terminal.writeln(`$ ${props.command}`)
      }
      terminal.focus()
    }
  }

  ws.onmessage = (event) => {
    if (!terminal) return
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'exit') {
        exitCode.value = msg.code
        closed.value = true
        terminal.options.disableStdin = true
        emit('exit', msg.code)
      } else if (msg.type === 'error') {
        terminal.writeln(`\x1b[31m[错误] ${msg.message}\x1b[0m`)
        closed.value = true
        terminal.options.disableStdin = true
      }
    } catch {
      terminal.write(event.data)
    }
  }

  ws.onclose = () => {
    if (terminal && !closed.value) {
      closed.value = true
      terminal.options.disableStdin = true
    }
  }
}

onMounted(() => {
  if (!termRef.value) return

  terminal = new Terminal({
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

  terminal.loadAddon(fitAddon)
  terminal.open(termRef.value)
  fitAddon.fit()

  terminal.onData((data) => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }))
    }
  })

  connect()
})

watch(() => props.command, () => {
  if (props.command && terminal) {
    connect()
  }
})

onBeforeUnmount(() => {
  if (terminal) {
    terminal.dispose()
    terminal = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
})
</script>

<style scoped>
.terminal-wrapper {
  margin: 12px 0;
}

.terminal {
  border-radius: 6px;
  overflow: hidden;
}

.terminal :deep(.xterm-viewport) {
  border-radius: 6px;
}

.terminal-closed {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.exit-success {
  color: #00c853;
  font-size: 12px;
}

.exit-error {
  color: #f44336;
  font-size: 12px;
}
</style>
