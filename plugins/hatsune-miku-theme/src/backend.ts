import fs from 'fs'
import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'
import { createRouter, getDataDir } from './routes.js'

/**
 * 初音未来主题插件 — 后端入口
 *
 * 插件自己提供图片静态资源（不再依赖主项目 /plugins-assets）：
 *   - /api/hatsune-miku-theme/bg/*       内置背景图
 *   - /api/hatsune-miku-theme/custom/*   用户上传的背景图
 *   - /api/hatsune-miku-theme/logo       登录卡片 logo
 *   - /api/hatsune-miku-theme/backgrounds  背景列表 / 上传 / 删除
 * 用户上传的图片存放在 ~/.file-manager/hatsune-miku-theme/（与主项目生产数据目录一致）。
 */
export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 确保用户上传背景图的数据目录存在
  fs.mkdirSync(getDataDir(), { recursive: true })

  ctx.app.use('/api/hatsune-miku-theme', createRouter(ctx))
  ctx.utils.logger.log('INFO', 'Plugin', 'Hatsune Miku Theme: registered /api/hatsune-miku-theme routes')
}
