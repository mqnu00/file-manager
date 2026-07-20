import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { getConfig, SmbConfig } from '../config'
import { detectSamba, clearSambaCache } from '../utils/sambaDetect'
import { safePath } from '../utils/safePath'
import { isRunning as terminalRunning, killSession, createSession } from './terminalManager'

export type SmbState = 'stopped' | 'running' | 'not_installed' | 'error'

export interface SmbStatus {
  state: SmbState
  port: number
  workgroup: string
  serverString: string
  shares: { name: string; path: string; readOnly: boolean; guestOk: boolean }[]
  error?: string
  startedAt?: number
  authMode: 'password' | 'guest'
}

let currentPort: number = 1445
let startedAt: number | null = null

function getSmbConfPath(): string {
  return path.join(os.tmpdir(), `file-manager-smb-${process.pid}.conf`)
}

function getSmbStateDir(): string {
  return path.join(os.tmpdir(), `file-manager-smb-state-${process.pid}`)
}

function generateSmbConf(config: SmbConfig): string {
  const stateDir = getSmbStateDir()
  const hasUsers = config.users && config.users.length > 0

  const lines: string[] = [
    '[global]',
    `   workgroup = ${config.workgroup}`,
    `   server string = ${config.serverString}`,
    `   smb ports = ${config.port}`,
    '   log file = /dev/null',
    '   max log size = 0',
    '   server min protocol = SMB2',
  ]

  if (hasUsers) {
    lines.push('   security = user')
    lines.push('   map to guest = Bad Password')
  } else {
    lines.push('   map to guest = Bad User')
  }

  lines.push(
    '   disable netbios = yes',
    '   ntlm auth = yes',
    '   enable core files = no',
    `   pid directory = ${stateDir}`,
    `   lock directory = ${stateDir}`,
    `   state directory = ${stateDir}`,
    `   cache directory = ${stateDir}`,
    ''
  )

  for (const share of config.shares) {
    const absPath = safePath(share.path)
    lines.push(`[${share.name}]`)
    lines.push(`   path = ${absPath}`)
    lines.push(`   read only = ${share.readOnly ? 'yes' : 'no'}`)
    lines.push(`   guest ok = ${share.guestOk ? 'yes' : 'no'}`)
    lines.push(`   browseable = yes`)
    if (hasUsers && !share.guestOk) {
      const userList = config.users.map(u => u.username).join(' ')
      lines.push(`   valid users = ${userList}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function getSetupScriptPath(): string {
  return path.join(os.tmpdir(), `file-manager-smb-setup-${process.pid}.sh`)
}

function generateSetupScript(config: SmbConfig, confPath: string): string {
  const hasUsers = config.users && config.users.length > 0
  const escapedConfPath = confPath.replace(/'/g, "'\\''")

  let script = '#!/bin/bash\nset -e\n\n'

  if (hasUsers) {
    script += '# 创建/更新 Samba 用户\n'
    for (const user of config.users) {
      // 转义特殊字符：单引号 -> '\''
      const escapedUser = user.username.replace(/'/g, "'\\''")
      const escapedPass = user.password.replace(/'/g, "'\\''")
      script += `smbpasswd -x '${escapedUser}' 2>/dev/null || true\n`
      script += `(echo '${escapedPass}'; echo '${escapedPass}') | smbpasswd -a -s '${escapedUser}'\n`
    }
    script += '\n'
  }

  script += `exec smbd --foreground --no-process-group --configfile='${escapedConfPath}' --debug-stdout\n`

  return script
}

export function getStatus(): SmbStatus {
  const sambaInfo = detectSamba()
  if (!sambaInfo.installed) {
    return {
      state: 'not_installed',
      port: 0,
      workgroup: '',
      serverString: '',
      shares: [],
      authMode: 'guest',
      error: 'Samba (smbd) 未安装，请先安装 samba 包'
    }
  }

  const cfg = getConfig()
  const smbCfg = cfg.smb || {
    enabled: false,
    port: 1445,
    workgroup: 'WORKGROUP',
    serverString: 'File Manager',
    shares: [],
    users: []
  }

  const state: SmbState = terminalRunning() ? 'running' : 'stopped'

  return {
    state,
    port: smbCfg.port,
    workgroup: smbCfg.workgroup,
    serverString: smbCfg.serverString,
    shares: smbCfg.shares.map(s => ({
      name: s.name,
      path: s.path,
      readOnly: s.readOnly,
      guestOk: s.guestOk
    })),
    authMode: (smbCfg.users && smbCfg.users.length > 0) ? 'password' : 'guest',
    startedAt: startedAt || undefined
  }
}

export function start(): { port: number } {
  const sambaInfo = detectSamba()
  if (!sambaInfo.installed) {
    throw new Error('Samba (smbd) 未安装')
  }

  if (terminalRunning()) {
    throw new Error('SMB 服务已在运行中')
  }

  const cfg = getConfig().smb || {
    enabled: false,
    port: 1445,
    workgroup: 'WORKGROUP',
    serverString: 'File Manager',
    shares: [],
    users: []
  }

  if (cfg.shares.length === 0) {
    throw new Error('请至少添加一个共享文件夹')
  }

  const confPath = getSmbConfPath()
  fs.writeFileSync(confPath, generateSmbConf(cfg), 'utf-8')

  const stateDir = getSmbStateDir()
  try { fs.mkdirSync(stateDir, { recursive: true }) } catch { /* ignore */ }

  const setupScriptPath = getSetupScriptPath()
  fs.writeFileSync(setupScriptPath, generateSetupScript(cfg, confPath), { mode: 0o755, encoding: 'utf-8' })

  currentPort = cfg.port
  startedAt = Date.now()

  // 创建持久化 PTY 会话（不和 WebSocket 绑定，刷新页面后仍运行）
  createSession('sudo', [setupScriptPath], (exitCode) => {
    if (exitCode === 0) {
      clearSambaCache()
    }
    startedAt = null
    console.log(`SMB 进程退出，退出码: ${exitCode}`)
  })

  console.log(`SMB 已启动，端口: ${cfg.port}`)
  return { port: cfg.port }
}

export function stop(): void {
  killSession()
  startedAt = null

  // 兜底：直接 pkill 可能残留的 smbd 进程（忽略 sudo 密码/权限错误）
  try {
    execSync('sudo pkill -f "smbd.*file-manager-smb"', { timeout: 3000 })
  } catch { /* 非关键，忽略所有错误 */ }

  // 清理临时文件
  try {
    const scriptPath = getSetupScriptPath()
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
    const confPath = getSmbConfPath()
    if (fs.existsSync(confPath)) fs.unlinkSync(confPath)
  } catch { /* ignore */ }

  console.log('SMB 服务已停止')
}

// 进程退出时清理
process.on('exit', () => {
  try {
    const confPath = getSmbConfPath()
    if (fs.existsSync(confPath)) fs.unlinkSync(confPath)
    const scriptPath = getSetupScriptPath()
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath)
  } catch { /* */ }
})
