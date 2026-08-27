import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 向 file-viewer 核心报备能力（经 registerService）
  ctx.getService('file-viewer:viewers').registerViewer({
    id: 'hex',
    label: '十六进制查看器',
    defaultExtensions: ['bin', 'dat', 'hex'],
    route: '/plugin/hex/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('hex-viewer', {
    canAutoStart: async () => true,
    dependsOn: ['viewers'],
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('hex-viewer')
}