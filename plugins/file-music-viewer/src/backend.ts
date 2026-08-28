/**
 * file-music-viewer 后端
 *
 * 向 file-viewer 核心报备查看器能力（默认扩展名 + 查看页路由），
 * 并声明托管服务（生命周期信号 + 级联依赖）。
 */

import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const registry = ctx.getService('file-viewer:viewers')
  // 向 file-viewer 核心报备能力（经 registerService）
  registry.registerViewer({
    id: 'music',
    label: '音乐播放器',
    defaultExtensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'],
    route: '/plugin/music/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('music-viewer', {
    canAutoStart: async () => true,
    dependsOn: ['viewers'],
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('music-viewer')

  // teardown 契约：卸载/重载时注销查看器，使配置页不再展示、对应后缀不再可点击
  return () => {
    try {
      registry.unregisterViewer('music')
    } catch {
      // file-viewer 已先卸载（级联）则忽略
    }
  }
}
