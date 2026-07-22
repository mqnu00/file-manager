/**
 * Test Plugin — 后端入口
 *
 * 运行时通过 import() 动态加载，接收 ctx 访问所有后端公共资源。
 * 类型由 @mqn00/file-manager/plugin 提供（通过 peerDependencies 声明依赖）。
 */

import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'
import type { Request, Response } from 'express'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      plugin: 'test',
      message: 'Hello from test plugin!',
      timestamp: new Date().toISOString(),
    })
  })

  ctx.app.use('/api/plugin/test', router)
  ctx.utils.logger.log('INFO', 'Plugin', 'Test plugin: registered GET /api/plugin/test')
}
