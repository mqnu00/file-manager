import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const registry = ctx.getService('file-viewer:viewers')
  // 向 file-viewer 核心报备能力（经 registerService）
  registry.registerViewer({
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

  // teardown 契约：卸载/重载时注销查看器，使配置页不再展示、对应后缀不再可点击
  return () => {
    try {
      registry.unregisterViewer('hex')
    } catch {
      // file-viewer 已先卸载（级联）则忽略
    }
  }
}