import type { BackendPluginContext, PluginInstallFunction, Request, Response } from '@mqn00/file-manager/plugin'

/**
 * 读取插件自身 package.json（name/version）。
 * 使用 require 相对路径：CJS 产物位于 dist/，package.json 在上一级目录。
 * 热重载 cacheBust 临时目录场景下读取失败时兜底为 'unknown'。
 */
function readPackageInfo(): { name: string; version: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json') as { name?: string; version?: string }
    return {
      name: pkg.name ?? 'unknown',
      version: pkg.version ?? 'unknown',
    }
  } catch {
    return { name: 'unknown', version: 'unknown' }
  }
}

const pkg = readPackageInfo()

// 模块加载时刻：切换版本后模块重新加载，该值必然变化，用于生产环境验证
const loadedAt = new Date().toISOString()

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      plugin: 'test',
      name: pkg.name,
      version: pkg.version,
      loadedAt,
      message: `Hello from test plugin v${pkg.version}`,
      timestamp: new Date().toISOString(),
    })
  })

  ctx.app.use('/api/plugin/test', router)
  ctx.utils.logger.log('INFO', 'Plugin', `Test plugin v${pkg.version}: registered GET /api/plugin/test`)
}
