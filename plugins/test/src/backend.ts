/**
 * Test Plugin — 后端入口
 *
 * 运行时通过 import() 动态加载，接收 ctx 访问所有后端公共资源。
 * 使用 any 类型因为插件独立编译，不直接依赖主项目的类型定义。
 */

export function install(ctx: any): void {
  const router = ctx.express.Router()

  router.get('/', (_req: any, res: any) => {
    res.json({
      plugin: 'test',
      message: 'Hello from test plugin!',
      timestamp: new Date().toISOString(),
    })
  })

  ctx.app.use('/api/plugin/test', router)
  ctx.utils.logger.log('INFO', 'Plugin', 'Test plugin: registered GET /api/plugin/test')
}
