import type { BackendPluginContext, PluginInstallFunction, Request, Response } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      plugin: 'test',
      message: 'Hello from test plugin\!',
      timestamp: new Date().toISOString(),
    })
  })

  ctx.app.use('/api/plugin/test', router)
  ctx.utils.logger.log('INFO', 'Plugin', 'Test plugin: registered GET /api/plugin/test')
}
