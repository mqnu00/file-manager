/**
 * compress 插件前端入口
 *
 * 向主应用批量操作注册表（window.__fm_bulk_actions，类型契约由
 * @mqn00/file-manager/plugin/frontend 发布）注册「压缩」操作：
 * - 任意选中（文件/文件夹均可、支持多选）时在工具栏批量操作栏显示
 * - 点按后用 ctx.Vue.createApp 挂载压缩对话框（openCompressDialog）
 */
import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  BulkAction,
  BulkActionContext,
  BulkActionsApi,
} from '@mqn00/file-manager/plugin/frontend'
import { injectStyles, removeStyles } from './style'
import { openCompressDialog, closeCompressDialog } from './dialog'

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()

  const api = (window as unknown as Record<string, unknown>)['__fm_bulk_actions'] as
    | BulkActionsApi
    | undefined
  if (!api || typeof api.register !== 'function') {
    console.warn('[compress] 主应用未暴露批量操作注册表（__fm_bulk_actions），压缩按钮不可用')
    return
  }

  api.register({
    id: 'compress',
    label: '压缩',
    // 文件/文件夹均可压缩，多选亦支持；只要选中了任意条目即显示
    visible: (p) => p.count > 0,
    run: (payload: BulkActionContext) => openCompressDialog(ctx, payload),
  } satisfies BulkAction)

  // teardown 契约：卸载/重载时移除批量操作、关闭打开的对话框并移除注入样式
  return () => {
    api.unregister?.('compress')
    closeCompressDialog()
    removeStyles()
  }
}