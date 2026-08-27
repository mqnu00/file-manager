import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 向 file-viewer 核心报备能力（经 registerService）
  ctx.getService('file-viewer:viewers').registerViewer({
    id: 'video',
    label: '视频播放器',
    defaultExtensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm4v', 'wmv'],
    route: '/plugin/video/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('video-viewer', {
    canAutoStart: async () => true,
    dependsOn: ['viewers'],
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('video-viewer')
}