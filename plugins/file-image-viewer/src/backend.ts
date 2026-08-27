import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 向 file-viewer 核心报备能力（经 registerService）
  ctx.getService('file-viewer:viewers').registerViewer({
    id: 'image',
    label: '图片查看器',
    defaultExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'apng', 'jfif', 'tif', 'tiff', 'heic', 'heif'],
    route: '/plugin/image/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('image-viewer', {
    canAutoStart: async () => true,
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('image-viewer')
}