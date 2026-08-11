import type { BackendPluginContext, PluginInstallFunction, Request, Response } from '@mqn00/file-manager/plugin'
import { initTestService, start, stop, isRunning, getStatus } from './service.js'

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
  initTestService(ctx)

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

  /**
   * 托管服务状态查询
   */
  router.get('/service', (_req: Request, res: Response) => {
    res.json(getStatus())
  })

  /**
   * 启动托管服务：通过 ctx.startService 包装，持久化 config 中 startedServices，
   * 重启文件管理器后由 startConfiguredServices 自动恢复
   */
  router.post('/service/start', async (_req: Request, res: Response) => {
    try {
      const result = (await ctx.startService('test-service')) as { port: number } | undefined
      res.json({ success: true, ...(result ?? {}) })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '启动测试服务失败'
      res.status(400).json({ success: false, error: message })
    }
  })

  /**
   * 停止托管服务：清理 config 中 startedServices，重启后不再自动启动
   */
  router.post('/service/stop', async (_req: Request, res: Response) => {
    try {
      await ctx.stopService('test-service')
      res.json({ success: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '停止测试服务失败'
      res.status(400).json({ success: false, error: message })
    }
  })

  /**
   * 托管服务请求转发：服务仅监听 127.0.0.1 且端口未对外暴露，
   * 浏览器直连会被 CSP connect-src 拦截（Docker 部署下也无法到达），
   * 由后端代发请求，前端保持同源调用。
   */
  router.get('/service/request', async (_req: Request, res: Response) => {
    const status = getStatus()
    if (!status.running) {
      res.status(400).json({ error: '测试服务未运行' })
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const resp = await fetch(`http://127.0.0.1:${status.port}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      res.status(resp.status).json(await resp.json())
    } catch (err: unknown) {
      clearTimeout(timeout)
      const message = err instanceof Error ? err.message : '请求测试服务失败'
      res.status(502).json({ error: message })
    }
  })

  ctx.app.use('/api/plugin/test', router)

  // 注册托管服务：支持重启文件管理器后自动恢复，以及被其他插件依赖等待
  ctx.manageService('test-service', { start, stop, isRunning })

  ctx.utils.logger.log(
    'INFO',
    'Plugin',
    `Test plugin v${pkg.version}: registered GET /api/plugin/test, managed service "test-service"`
  )
}
