import { execSync } from 'child_process'
import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'
import { initSmbManager, getStatus, start, stop } from './smbManager.js'
import { createRouter } from './routes.js'

/** 自动启动预检：sudo 无密码（NOPASSWD 或凭证缓存）可用才自动启动，避免 PTY 挂起等待密码 */
function canAutoStartSmb(): boolean {
  try {
    execSync('sudo -n true', { timeout: 3000, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 初始化 smbManager，使其能访问 ctx
  initSmbManager(ctx)

  // 注册 SMB API 路由（路径保持 /api/smb，前端 API 客户端无需改动）
  ctx.app.use('/api/smb', createRouter(ctx))

  // 注册插件间共享服务
  ctx.registerService('smb', { getStatus, start, stop })

  // 注册托管服务：支持重启文件管理器后自动恢复 smbd，以及被其他插件依赖等待
  ctx.manageService('smb', {
    start,
    stop,
    isRunning: () => getStatus().state === 'running',
    canAutoStart: canAutoStartSmb,
  })

  ctx.utils.logger.log('INFO', 'Plugin', 'SMB plugin: registered /api/smb routes')
}
