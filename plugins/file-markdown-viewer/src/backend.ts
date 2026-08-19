/**
 * file-markdown-viewer 后端
 *
 * 纯前端查看模块：文件 I/O 由 file-viewer 核心后端提供，无需自有后端。
 */

import type {
  BackendPluginContext,
  PluginInstallFunction,
} from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = () => {
  // 纯前端 Markdown 渲染，无后端逻辑
}
