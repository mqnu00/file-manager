import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'
import { initSmbManager, getStatus, start, stop } from './smbManager'
import { initRoutes } from './routes'
import smbRoutes from './routes'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 初始化 smbManager，使其能访问 ctx
  initSmbManager(ctx)
  initRoutes(ctx)

  // 注册 SMB API 路由（路径保持 /api/smb，前端 API 客户端无需改动）
  ctx.app.use('/api/smb', smbRoutes)

  // 注册插件间共享服务
  ctx.registerService('smb', { getStatus, start, stop })

  ctx.utils.logger.log('INFO', 'Plugin', 'SMB plugin: registered /api/smb routes')
}
