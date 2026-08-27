/**
 * file-markdown-viewer 后端
 *
 * 向 file-viewer 核心报备查看器能力（默认扩展名 + 查看页路由），
 * 并声明托管服务（生命周期信号 + 级联依赖）。
 */

import type {
  BackendPluginContext,
  PluginInstallFunction,
} from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // 向 file-viewer 核心报备能力（经 registerService）
  ctx.getService('file-viewer:viewers').registerViewer({
    id: 'markdown',
    label: 'Markdown 查看器',
    defaultExtensions: ['md', 'markdown', 'mdown', 'mkd'],
    route: '/plugin/markdown/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('markdown-viewer', {
    canAutoStart: async () => true,
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('markdown-viewer')
}