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

/** 读取 config.yml 中本插件的 extensionMappings（完整映射表 ext→viewerId） */
function getMappings(ctx: BackendPluginContext): Record<string, string> {
  const cfg = ctx.config.get()
  const pluginCfg = (cfg.plugins || {})['file-viewer'] as Record<string, unknown> | undefined
  const raw = pluginCfg?.extensionMappings
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string>
  }
  return {}
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()
  const auth = ctx.express.Router()
  auth.use(ctx.middleware.auth)

  auth.get('/config', (_req: Request, res: Response) => {
    res.json({ extensionMappings: getMappings(ctx) })
  })

  auth.put('/config', (req: Request, res: Response) => {
    const raw = (req.body as { extensionMappings?: unknown })?.extensionMappings
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(400).json({ message: 'extensionMappings 必须是对象' })
    }
    const map: Record<string, string> = {}
    for (const [ext, viewerId] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof viewerId !== 'string') {
        return res.status(400).json({ message: `扩展名 ${ext} 的映射值必须是字符串` })
      }
      const key = ext.trim().toLowerCase().replace(/^\./, '')
      if (key) map[key] = viewerId
    }
    ctx.config.updatePlugin('file-viewer', { extensionMappings: map })
    ctx.utils.logger.log('INFO', 'file-viewer', `已保存 extensionMappings（${Object.keys(map).length} 项）`)
    res.json({ success: true, extensionMappings: map })
  })

  router.use(auth)
  ctx.app.use('/api/file-viewer', router)
  ctx.utils.logger.log('INFO', 'file-viewer', '后端已加载（配置 API /api/file-viewer/config）')
}