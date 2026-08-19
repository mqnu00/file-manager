/**
 * file-viewer 后端：仅保留查看器映射配置 API（/api/file-viewer/config）
 *
 * 通用文件 I/O（read/write/bytes/write-range/token/stream）已上收主项目
 * （/api/files/* + ctx.services.fileIO + 前端 ctx.api.fileIO），本插件不再
 * 提供任何文件读写能力。子查看插件应使用 ctx.api.fileIO（前端）或
 * ctx.services.fileIO（后端）访问平台 I/O。
 */

import type {
  BackendPluginContext,
  PluginInstallFunction,
  Request,
  Response,
} from '@mqn00/file-manager/plugin'

/** 读取 config.yml 中本插件的配置（extensionMappings + defaultViewer） */
function getViewerConfig(ctx: BackendPluginContext): {
  extensionMappings: Record<string, string>
  defaultViewer: string
} {
  const cfg = ctx.config.get()
  const pluginCfg = (cfg.plugins || {})['file-viewer'] as Record<string, unknown> | undefined
  const raw = pluginCfg?.extensionMappings
  const extMap =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {}
  const dv =
    typeof pluginCfg?.defaultViewer === 'string' ? (pluginCfg.defaultViewer as string) : ''
  return { extensionMappings: extMap, defaultViewer: dv }
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()
  const auth = ctx.express.Router()
  auth.use(ctx.middleware.auth)

  auth.get('/config', (_req: Request, res: Response) => {
    res.json(getViewerConfig(ctx))
  })

  auth.put('/config', (req: Request, res: Response) => {
    const { extensionMappings, defaultViewer } = req.body as {
      extensionMappings?: unknown
      defaultViewer?: unknown
    }

    // 校验 extensionMappings
    if (!extensionMappings || typeof extensionMappings !== 'object' || Array.isArray(extensionMappings)) {
      return res.status(400).json({ message: 'extensionMappings 必须是对象' })
    }
    const map: Record<string, string> = {}
    for (const [ext, viewerId] of Object.entries(extensionMappings as Record<string, unknown>)) {
      if (typeof viewerId !== 'string') {
        return res.status(400).json({ message: `扩展名 ${ext} 的映射值必须是字符串` })
      }
      const key = ext.trim().toLowerCase().replace(/^\./, '')
      if (key) map[key] = viewerId
    }

    // 校验 defaultViewer（可选，字符串）
    const dv = typeof defaultViewer === 'string' ? defaultViewer.trim() : ''

    ctx.config.updatePlugin('file-viewer', { extensionMappings: map, defaultViewer: dv })
    ctx.utils.logger.log('INFO', 'file-viewer', `已保存配置（${Object.keys(map).length} 项映射，默认查看器：${dv || '未设置'}）`)
    res.json({ success: true, extensionMappings: map, defaultViewer: dv })
  })

  router.use(auth)
  ctx.app.use('/api/file-viewer', router)
  ctx.utils.logger.log('INFO', 'file-viewer', '后端已加载（配置 API /api/file-viewer/config）')
}