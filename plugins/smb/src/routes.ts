import { execSync } from 'child_process'
import fs from 'fs'
import { getStatus, start, stop } from './smbManager.js'
import type { BackendPluginContext, Request, Response, Router } from '@mqn00/file-manager/plugin'
import type { SmbShare, SmbUser, SmbConfig } from './smbManager.js'

let _ctx: BackendPluginContext | null = null

function getCtx(): BackendPluginContext {
  if (!_ctx) throw new Error('SMB routes not initialized')
  return _ctx
}

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

function saveSmbConfig(smbCfg: SmbConfig): void {
  const cfg = getCtx().config.get()
  const plugins = { ...(cfg.plugins || {}), smb: smbCfg }
  getCtx().config.update({ plugins })
}

// ==================== 安装信息检测 ====================

interface InstallInfo {
  manager: string
  command: string
  rawCommand: string
  pkexecAvailable: boolean
  osName: string
}

let cachedInstallInfo: InstallInfo | null = null

function detectOS(): string {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf-8')
    const match = content.match(/^PRETTY_NAME="(.+)"$/m)
    if (match) return match[1]
    const idMatch = content.match(/^ID="(.+)"$/m)
    if (idMatch) return idMatch[1]
  } catch { /* */ }
  return 'Linux'
}

function hasCmd(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function detectPackageManagerForSamba(): InstallInfo {
  if (cachedInstallInfo) return cachedInstallInfo

  const osName = detectOS()
  let manager = ''
  let rawCommand = ''

  if (hasCmd('apt-get')) {
    manager = 'apt'
    rawCommand = 'sudo apt-get install -y samba'
  } else if (hasCmd('dnf')) {
    manager = 'dnf'
    rawCommand = 'sudo dnf install -y samba'
  } else if (hasCmd('yum')) {
    manager = 'yum'
    rawCommand = 'sudo yum install -y samba'
  } else if (hasCmd('pacman')) {
    manager = 'pacman'
    rawCommand = 'sudo pacman -S --noconfirm samba'
  } else if (hasCmd('apk')) {
    manager = 'apk'
    rawCommand = 'sudo apk add samba'
  } else if (hasCmd('zypper')) {
    manager = 'zypper'
    rawCommand = 'sudo zypper install -y samba'
  }

  cachedInstallInfo = { manager, command: rawCommand, rawCommand, pkexecAvailable: false, osName }
  return cachedInstallInfo
}

// ==================== 路由 ====================

export function createRouter(ctx: BackendPluginContext): Router {
  _ctx = ctx
  const router: Router = ctx.express.Router()

/**
 * GET /api/smb/status
 */
router.get('/status', (_req: Request, res: Response) => {
  const status = getStatus()
  res.json(status)
})

/**
 * POST /api/smb/start
 */
router.post('/start', (_req: Request, res: Response) => {
  try {
    const result = start()
    res.json({ success: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '启动 SMB 服务失败'
    res.status(400).json({ success: false, error: message })
  }
})

/**
 * POST /api/smb/stop
 */
router.post('/stop', (_req: Request, res: Response) => {
  try {
    stop()
    res.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '停止 SMB 服务失败'
    res.status(400).json({ success: false, error: message })
  }
})

/**
 * GET /api/smb/install-info
 */
router.get('/install-info', (_req: Request, res: Response) => {
  const info = detectPackageManagerForSamba()
  res.json(info)
})

/**
 * PUT /api/smb/settings
 */
router.put('/settings', (req: Request, res: Response) => {
  const { port, workgroup, serverString, enabled } = req.body

  const currentSmb = getSmbConfig()
  const updates: Partial<SmbConfig> = {}
  if (port !== undefined) updates.port = port
  if (workgroup !== undefined) updates.workgroup = workgroup
  if (serverString !== undefined) updates.serverString = serverString
  if (enabled !== undefined) updates.enabled = enabled

  saveSmbConfig({ ...currentSmb, ...updates })
  res.json({ success: true })
})

/**
 * GET /api/smb/shares
 */
router.get('/shares', (_req: Request, res: Response) => {
  const smbCfg = getSmbConfig()
  res.json(smbCfg.shares || [])
})

/**
 * POST /api/smb/shares - 新增共享
 */
router.post('/shares', (req: Request, res: Response) => {
  const { name, path, readOnly, guestOk } = req.body

  if (!name || !path) {
    res.status(400).json({ success: false, error: '共享名称和路径不能为空' })
    return
  }

  const smbCfg = getSmbConfig()

  if (smbCfg.shares.some(s => s.name === name)) {
    res.status(400).json({ success: false, error: `共享 "${name}" 已存在` })
    return
  }

  const newShare: SmbShare = {
    name,
    path,
    readOnly: readOnly ?? false,
    guestOk: guestOk ?? true
  }

  saveSmbConfig({ ...smbCfg, shares: [...smbCfg.shares, newShare] })
  res.json({ success: true, share: newShare })
})

/**
 * PUT /api/smb/shares/:name - 修改共享
 */
router.put('/shares/:name', (req: Request, res: Response) => {
  const { name } = req.params
  const { path: newPath, readOnly, guestOk, newName } = req.body

  const smbCfg = getSmbConfig()
  const idx = smbCfg.shares.findIndex(s => s.name === name)
  if (idx === -1) {
    res.status(404).json({ success: false, error: `共享 "${name}" 不存在` })
    return
  }

  const shares = [...smbCfg.shares]
  shares[idx] = {
    ...shares[idx],
    name: newName ?? shares[idx].name,
    path: newPath ?? shares[idx].path,
    readOnly: readOnly ?? shares[idx].readOnly,
    guestOk: guestOk ?? shares[idx].guestOk
  }

  saveSmbConfig({ ...smbCfg, shares })
  res.json({ success: true, share: shares[idx] })
})

/**
 * DELETE /api/smb/shares/:name
 */
router.delete('/shares/:name', (req: Request, res: Response) => {
  const { name } = req.params

  const smbCfg = getSmbConfig()
  const shares = smbCfg.shares.filter(s => s.name !== name)

  if (shares.length === smbCfg.shares.length) {
    res.status(404).json({ success: false, error: `共享 "${name}" 不存在` })
    return
  }

  saveSmbConfig({ ...smbCfg, shares })
  res.json({ success: true })
})

// ==================== 用户管理 ====================

/**
 * GET /api/smb/users
 */
router.get('/users', (_req: Request, res: Response) => {
  const smbCfg = getSmbConfig()
  const users = (smbCfg.users || []).map((u: SmbUser) => ({
    username: u.username,
    password: '****'
  }))
  res.json(users)
})

/**
 * POST /api/smb/users - 新增用户
 */
router.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' })
      return
    }

    const smbCfg = getSmbConfig()

    if (smbCfg.users.some(u => u.username === username)) {
      res.status(400).json({ success: false, error: `用户 "${username}" 已存在` })
      return
    }

    saveSmbConfig({ ...smbCfg, users: [...smbCfg.users, { username, password }] })
    res.json({ success: true, user: { username } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '添加用户失败'
    console.error('添加 SMB 用户失败:', err)
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * PUT /api/smb/users/:username - 修改用户密码
 */
router.put('/users/:username', (req: Request, res: Response) => {
  const username = req.params.username as string
  const { password } = req.body

  if (!password) {
    res.status(400).json({ success: false, error: '密码不能为空' })
    return
  }

  const smbCfg = getSmbConfig()
  const idx = smbCfg.users.findIndex(u => u.username === username)
  if (idx === -1) {
    res.status(404).json({ success: false, error: `用户 "${username}" 不存在` })
    return
  }

  const users = [...smbCfg.users]
  users[idx] = { username, password }

  saveSmbConfig({ ...smbCfg, users })
  res.json({ success: true, user: { username } })
})

/**
 * DELETE /api/smb/users/:username
 */
router.delete('/users/:username', (req: Request, res: Response) => {
  const username = req.params.username as string

  const smbCfg = getSmbConfig()
  const users = smbCfg.users.filter(u => u.username !== username)

  if (users.length === smbCfg.users.length) {
    res.status(404).json({ success: false, error: `用户 "${username}" 不存在` })
    return
  }

  saveSmbConfig({ ...smbCfg, users })
  res.json({ success: true })
})

  return router
}
