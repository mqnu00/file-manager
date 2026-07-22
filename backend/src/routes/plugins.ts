/**
 * 插件信息 API — 向前端暴露已启用的插件列表及其前端入口 URL
 */

import { Router, Request, Response } from 'express'
import { getLoadedPlugins } from '../plugin/loader'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const plugins = getLoadedPlugins().map((p) => ({
    name: p.name,
    frontendPath: p.frontendPath
      ? `/plugins-assets/${p.name}/${p.frontendPath.replace(/^\.\//, '')}`
      : null,
  }))
  res.json(plugins)
})

export default router
