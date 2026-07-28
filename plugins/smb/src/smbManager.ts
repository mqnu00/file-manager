import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { detectSamba, clearSambaCache } from './sambaDetect.js'
import type { BackendPluginContext } from '@mqn00/file-manager/plugin'

// ==================== 类型 ====================

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

export interface SmbShare {
  name: string
  path: string
  readOnly: boolean
  guestOk: boolean
}

export interface SmbUser {
  username: string
  password: string
}

export interface SmbConfig {
  enabled: boolean
  port: number
  workgroup: string
  serverString: string
  shares: SmbShare[]
  users: SmbUser[]
}

// ==================== 插件上下文 ====================

let _ctx: BackendPluginContext | null = null

export function initSmbManager(ctx: BackendPluginContext): void {
  _ctx = ctx
}

function getCtx(): BackendPluginContext {
  if (!_ctx) throw new Error('SMB manager not initialized')
  return _ctx
}

// ==================== 配置辅助 ====================

const DEFAULT_SMB_CONFIG: SmbConfig = {
  enabled: false,
  port: 1445,
  workgroup: 'WORKGROUP',
  serverString: 'File Manager',
  shares: [],
  users: [],
}

function getSmbConfig(): SmbConfig {
  const cfg = getCtx().config.get()
  const saved = (cfg.plugins?.smb || {}) as Partial<SmbConfig>
  return { ...DEFAULT_SMB_CONFIG, ...saved }
}

// ==================== 状态 ====================

let currentPort: number = 1445
let startedAt: number | null = null

function getSmbConfPath(): string {
  return path.join(os.tmpdir(), `file-manager-smb-${process.pid}.conf`)
}

function getSmbStateDir(): string {
  return path.join(os.tmpdir(), `file-manager-smb-state-${process.pid}`)
}

// ==================== smb.conf 生成 ====================

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

  const ctx = getCtx()

  for (const share of config.shares) {
    const absPath = ctx.utils.path.safe(share.path)
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

// ==================== setup 脚本 ====================

function getSetupScriptPath(): string {
  return path.join(os.tmpdir(), `file-manager-smb-setup-${process.pid}.sh`)
}

function generateSetupScript(config: SmbConfig, confPath: string): string {
  const hasUsers = config.users && config.users.length > 0
  const escapedConfPath = confPath.replace(/'/g, "'\\''")

  let script = '#!/bin/bash\nset -e\n\n'

  script += '# 确保 smbd 所需的运行时目录存在\nmkdir -p /run/samba\n\n'

  if (hasUsers) {
    script += '# 创建/更新 Samba 用户\n'
    for (const user of config.users) {
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

// ==================== 公开 API ====================

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

  const ctx = getCtx()
  const smbCfg = getSmbConfig()
  const state: SmbState = ctx.services.terminal.isRunning() ? 'running' : 'stopped'

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

  const ctx = getCtx()

  if (ctx.services.terminal.isRunning()) {
    throw new Error('SMB 服务已在运行中')
  }

  const smbCfg = getSmbConfig()

  if (smbCfg.shares.length === 0) {
    throw new Error('请至少添加一个共享文件夹')
  }

  const confPath = getSmbConfPath()
  fs.writeFileSync(confPath, generateSmbConf(smbCfg), 'utf-8')

  const stateDir = getSmbStateDir()
  try { fs.mkdirSync(stateDir, { recursive: true }) } catch { /* ignore */ }

  const setupScriptPath = getSetupScriptPath()
  fs.writeFileSync(setupScriptPath, generateSetupScript(smbCfg, confPath), { mode: 0o755, encoding: 'utf-8' })

  currentPort = smbCfg.port
  startedAt = Date.now()

  ctx.services.terminal.createSession('sudo', [setupScriptPath], (exitCode) => {
    if (exitCode === 0) {
      clearSambaCache()
    }
    startedAt = null
    console.log(`SMB 进程退出，退出码: ${exitCode}`)
  })

  console.log(`SMB 已启动，端口: ${smbCfg.port}`)
  return { port: smbCfg.port }
}

export function stop(): void {
  const ctx = getCtx()
  ctx.services.terminal.killSession()
  startedAt = null

  // 兜底：直接 pkill 可能残留的 smbd 进程
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
