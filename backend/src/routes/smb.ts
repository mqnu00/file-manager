import { Router, Request, Response } from 'express'
import { getConfig, updateConfig, SmbShare } from '../config'
import { getStatus, start, stop } from '../services/smbManager'
import { detectPackageManager } from '../utils/packageManager'

const router = Router()

/**
 * GET /api/smb/status - 获取 SMB 服务状态
 */
router.get('/status', (_req: Request, res: Response) => {
  const status = getStatus()
  res.json(status)
})

/**
 * POST /api/smb/start - 启动 SMB 服务（创建持久化 PTY 会话）
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
 * POST /api/smb/stop - 停止 SMB 服务（关闭终端会话）
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
 * GET /api/smb/install-info - 获取安装信息
 */
router.get('/install-info', (_req: Request, res: Response) => {
  const info = detectPackageManager()
  res.json(info)
})

/**
 * PUT /api/smb/settings - 更新 SMB 全局设置
 */
router.put('/settings', (req: Request, res: Response) => {
  const { port, workgroup, serverString, enabled } = req.body

  const updates: Record<string, unknown> = {}
  if (port !== undefined) updates.port = port
  if (workgroup !== undefined) updates.workgroup = workgroup
  if (serverString !== undefined) updates.serverString = serverString
  if (enabled !== undefined) updates.enabled = enabled

  const currentSmb = getConfig().smb || {
    enabled: false,
    port: 1445,
    workgroup: 'WORKGROUP',
    serverString: 'File Manager',
    shares: [],
    users: []
  }

  updateConfig({
    smb: {
      ...currentSmb,
      ...updates,
      shares: currentSmb.shares
    }
  })

  res.json({ success: true })
})

/**
 * GET /api/smb/shares - 获取所有共享列表
 */
router.get('/shares', (_req: Request, res: Response) => {
  const smbCfg = getConfig().smb
  res.json(smbCfg?.shares || [])
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

  const smbCfg = getConfig().smb || {
    enabled: false,
    port: 1445,
    workgroup: 'WORKGROUP',
    serverString: 'File Manager',
    shares: [],
    users: []
  }

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

  const shares = [...smbCfg.shares, newShare]

  updateConfig({
    smb: { ...smbCfg, shares }
  })

  res.json({ success: true, share: newShare })
})

/**
 * PUT /api/smb/shares/:name - 修改共享
 */
router.put('/shares/:name', (req: Request, res: Response) => {
  const { name } = req.params
  const { path: newPath, readOnly, guestOk, newName } = req.body

  const smbCfg = getConfig().smb
  if (!smbCfg) {
    res.status(404).json({ success: false, error: '未配置 SMB 服务' })
    return
  }

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

  updateConfig({
    smb: { ...smbCfg, shares }
  })

  res.json({ success: true, share: shares[idx] })
})

/**
 * DELETE /api/smb/shares/:name - 删除共享
 */
router.delete('/shares/:name', (req: Request, res: Response) => {
  const { name } = req.params

  const smbCfg = getConfig().smb
  if (!smbCfg) {
    res.status(404).json({ success: false, error: '未配置 SMB 服务' })
    return
  }

  const shares = smbCfg.shares.filter(s => s.name !== name)

  if (shares.length === smbCfg.shares.length) {
    res.status(404).json({ success: false, error: `共享 "${name}" 不存在` })
    return
  }

  updateConfig({
    smb: { ...smbCfg, shares }
  })

  res.json({ success: true })
})

// ==================== 用户管理 ====================

/**
 * GET /api/smb/users - 获取所有用户（密码仅返回掩码）
 */
router.get('/users', (_req: Request, res: Response) => {
  const smbCfg = getConfig().smb
  const users = (smbCfg?.users || []).map(u => ({
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

    const smbCfg = getConfig().smb || {
      enabled: false,
      port: 1445,
      workgroup: 'WORKGROUP',
      serverString: 'File Manager',
      shares: [],
      users: []
    }

    if (smbCfg.users.some(u => u.username === username)) {
      res.status(400).json({ success: false, error: `用户 "${username}" 已存在` })
      return
    }

    const users = [...smbCfg.users, { username, password }]

    updateConfig({
      smb: { ...smbCfg, users }
    })

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

  const smbCfg = getConfig().smb
  if (!smbCfg) {
    res.status(404).json({ success: false, error: '未配置 SMB 服务' })
    return
  }

  const idx = smbCfg.users.findIndex(u => u.username === username)
  if (idx === -1) {
    res.status(404).json({ success: false, error: `用户 "${username}" 不存在` })
    return
  }

  const users = [...smbCfg.users]
  users[idx] = { username, password }

  updateConfig({
    smb: { ...smbCfg, users }
  })

  res.json({ success: true, user: { username } })
})

/**
 * DELETE /api/smb/users/:username - 删除用户
 */
router.delete('/users/:username', (req: Request, res: Response) => {
  const username = req.params.username as string

  const smbCfg = getConfig().smb
  if (!smbCfg) {
    res.status(404).json({ success: false, error: '未配置 SMB 服务' })
    return
  }

  const users = smbCfg.users.filter(u => u.username !== username)

  if (users.length === smbCfg.users.length) {
    res.status(404).json({ success: false, error: `用户 "${username}" 不存在` })
    return
  }

  updateConfig({
    smb: { ...smbCfg, users }
  })

  res.json({ success: true })
})

export default router
