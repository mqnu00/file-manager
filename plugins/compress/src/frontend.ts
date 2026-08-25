/**
 * compress 插件前端入口
 *
 * 向主应用批量操作注册表（window.__fm_bulk_actions）注册「压缩」操作：
 * - 任意选中（文件/文件夹均可、支持多选）时在工具栏批量操作栏显示
 * - 点按后用 ctx.Vue.createApp 挂载压缩对话框（openCompressDialog）
 */
import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { injectStyles, removeStyles } from './style'
import { openCompressDialog, closeCompressDialog } from './dialog'

/** 与主应用 BulkActionContext 结构一致 */
interface BulkActionContextLike {
  selected: string[]
  infos: FileItem[]
  currentPath: string
}

interface BulkActionLike {
  id: string
  label: string
  visible(p: { count: number; hasFolder: boolean }): boolean
  run(p: BulkActionContextLike): void
}

interface BulkActionsApiLike {
  register(action: BulkActionLike): void
  /** 主应用 v3.0.0-beta10+ 提供；旧版本缺失时降级（无操作） */
  unregister?(id: string): void
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()

  const api = (window as unknown as Record<string, unknown>)['__fm_bulk_actions'] as
    | BulkActionsApiLike
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
    run: (payload: BulkActionContextLike) => openCompressDialog(ctx, payload),
  })

  // teardown 契约：卸载/重载时移除批量操作、关闭打开的对话框并移除注入样式
  return () => {
    api.unregister?.('compress')
    closeCompressDialog()
    removeStyles()
  }
}