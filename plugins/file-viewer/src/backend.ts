/**
 * file-viewer 后端：查看器框架核心
 *
 * 职责：
 * 1. 提供查看器映射配置 API（extensionMappings + defaultViewer，经 ctx.storage 持久化）；
 * 2. 声明托管服务 `viewers`（查看器框架就绪信号，供子插件 dependsOn 并触发级联）；
 * 3. 经 registerService 暴露 `file-viewer:viewers` 注册服务，子插件据此向核心报备能力
 *    （默认扩展名 + 查看页路由）；核心持有解析权，配置表可改写扩展名归属。
 *
 * 通用文件 I/O 已上收主项目（ctx.services.fileIO / 前端 ctx.api.fileIO），本插件不提供。
 */

import type {
  BackendPluginContext,
  PluginInstallFunction,
  Request,
  Response,
} from '@mqn00/file-manager/plugin'
import type { ViewerMeta } from './types'

/** 读取插件存储中的配置（extensionMappings + defaultViewer） */
function getViewerConfig(ctx: BackendPluginContext): {
  extensionMappings: Record<string, string>
  defaultViewer: string
} {
  const extMap = ctx.storage.get('extensionMappings')
  const dv = ctx.storage.get('defaultViewer')
  return {
    extensionMappings:
      extMap && typeof extMap === 'object' && !Array.isArray(extMap)
        ? (extMap as Record<string, string>)
        : {},
    defaultViewer: typeof dv === 'string' ? dv : '',
  }
}

/** 归一化扩展名（小写、去点、去空） */
function normalizeExt(ext: string): string {
  return ext.trim().toLowerCase().replace(/^\./, '')
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
      res.status(400).json({ message: 'extensionMappings 必须是对象' })
      return
    }
    const map: Record<string, string> = {}
    for (const [ext, viewerId] of Object.entries(extensionMappings as Record<string, unknown>)) {
      if (typeof viewerId !== 'string') {
        res.status(400).json({ message: `扩展名 ${ext} 的映射值必须是字符串` })
        return
      }
      const key = normalizeExt(ext)
      if (key) map[key] = viewerId
    }

    // 校验 defaultViewer（可选，字符串）
    const dv = typeof defaultViewer === 'string' ? defaultViewer.trim() : ''

    ctx.storage.set('extensionMappings', map)
    ctx.storage.set('defaultViewer', dv)
    ctx.utils.logger.log(
      'INFO',
      'file-viewer',
      `已保存配置（${Object.keys(map).length} 项映射，默认查看器：${dv || '未设置'}）`
    )
    res.json({ success: true, extensionMappings: map, defaultViewer: dv })
  })

  // 已注册查看器列表 + 当前映射/默认查看器（供前端解析与配置页）
  auth.get('/viewers', (_req: Request, res: Response) => {
    const { extensionMappings, defaultViewer } = getViewerConfig(ctx)
    res.json({
      viewers: viewerRegistryImpl.getViewers(),
      extensionMappings,
      defaultViewer,
    })
  })

  router.use(auth)
  ctx.app.use('/api/file-viewer', router)

  // ---------- 查看器注册服务（供子插件经此向核心报备能力） ----------
  const viewers = new Map<string, ViewerMeta>()
  const viewerRegistryImpl = {
    registerViewer(meta: ViewerMeta): void {
      viewers.set(meta.id, {
        ...meta,
        defaultExtensions: meta.defaultExtensions.map(normalizeExt).filter(Boolean),
      })
    },
    unregisterViewer(id: string): void {
      viewers.delete(id)
    },
    getViewers(): ViewerMeta[] {
      return [...viewers.values()]
    },
  }
  ctx.registerService('file-viewer:viewers', viewerRegistryImpl)

  // ---------- 托管服务：查看器框架就绪信号 ----------
  // 子插件托管服务 dependsOn 'viewers'；file-viewer 卸载时本服务停止，
  // 平台自动级联停/卸依赖它的子插件（见主项目 loader 级联逻辑）。
  const state = { running: false }
  ctx.manageService('viewers', {
    canAutoStart: async () => true,
    start: async () => {
      state.running = true
    },
    stop: async () => {
      state.running = false
    },
    isRunning: async () => state.running,
  })
  // 插件启动即自动注册（幂等，持久化到宿主 startedServices）
  ctx.startService('viewers')

  ctx.utils.logger.log('INFO', 'file-viewer', '后端已加载（配置 API + viewers 服务）')
}
