/**
 * 插件信息 API — 向前端暴露已配置的插件列表（含启用状态），以及运行时加载/卸载
 */

import { Router, Request, Response } from 'express'
import { getAllPluginInfos, loadPlugin, unloadPluginByName } from '../plugin/loader'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// 查询所有已配置插件及启用状态（无需认证）
router.get('/', (_req: Request, res: Response) => {
  const plugins = getAllPluginInfos().map((p) => ({
    name: p.name,
    enabled: p.enabled,
    local: p.local,
    frontendPath: p.frontendPath
      ? `/plugins-assets/${p.name}/${p.frontendPath.replace(/^\.\//, '')}`
      : null,
  }))
  res.json(plugins)
})

// 运行时加载插件
router.post('/load', authMiddleware, async (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Missing or invalid plugin name' })
    return
  }

  const plugin = await loadPlugin(name)
  if (!plugin) {
    res.status(404).json({ error: `Plugin "${name}" not found or already loaded` })
    return
  }

  res.json({
    name: plugin.name,
    enabled: true,
    local: plugin.local,
    frontendPath: plugin.frontendPath
      ? `/plugins-assets/${plugin.name}/${plugin.frontendPath.replace(/^\.\//, '')}`
      : null,
  })
})

// 运行时卸载插件
router.post('/:name/unload', authMiddleware, (req: Request, res: Response) => {
  const name = req.params.name as string
  const ok = unloadPluginByName(name)
  if (!ok) {
    res.status(404).json({ error: `Plugin "${name}" is not loaded` })
    return
  }
  res.json({ success: true })
})

export default router
