/**
 * file-viewer 核心前端
 *
 * 1. 向主应用文件打开注册表（ctx.platform.fileOpen）注册 handler：
 *    声明"哪些文件可打开"，主应用渲染时据此打 is-openable 标记、单击时
 *    分发调用 open() —— 不再劫持 document 点击事件、不再扫描 DOM 加样式。
 * 2. 初始化 globalThis 查看器注册表（子插件在此 register 自己的查看模块）。
 * 3. 注册查看页路由 /plugin/file-viewer（requiresAuth）。
 * 4. 返回 teardown（平台卸载/重载时调用）：注销文件打开 handler。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
  FileOpenHandler,
} from '@mqn00/file-manager/plugin/frontend'
import { initRegistry, getRegistry, type FileViewerRegistry } from './registry'
import { loadModeOverride } from './overrides'
import { createViewerPage } from './page'
import { createConfigPage } from './config-page'
import { getMappings } from './config-api'

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

function injectStyles(): void {
  if (document.getElementById('file-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-viewer-style'
  style.textContent = `
.fv-page { height: 100%; display: flex; flex-direction: column; padding: 16px 20px; box-sizing: border-box; }
.fv-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.fv-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fv-name { font-size: 16px; font-weight: 600; color: var(--app-text-bright); }
.fv-path { max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-size { color: var(--app-text-dim); font-size: 12px; }
.fv-actions { margin-left: auto; }
.fv-mode-select { width: 180px; }
.fv-content { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.fv-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.fv-loading { color: var(--app-text-dim); padding: 48px; text-align: center; }
/* is-openable 由主应用按文件打开注册表渲染期打标（平台语义 class，样式归插件） */
.file-name-text.is-openable { cursor: pointer !important; transition: all 0.2s; color: var(--app-accent); text-shadow: var(--app-text-glow); }
.file-name-text.is-openable:hover { color: var(--app-accent); text-shadow: var(--app-text-glow-hover); text-decoration: underline; }

`
  document.head.appendChild(style)
}

/** 打开判定：用户覆盖（localStorage）命中已注册模块，或注册表对该扩展名有默认查看方式 */
function canOpenFile(registry: FileViewerRegistry | null, file: FileItem): boolean {
  if (file.isDirectory || file.broken) return false
  const ext = extOf(file.name)
  if (!ext) return false
  const override = loadModeOverride(ext)
  if (override && registry?.get(override)) return true
  return registry?.getDefault(ext) != null
}

/** 打开文件：计算查看模式（用户覆盖 > config.yml 映射 > 注册表默认）后 SPA 导航到查看页 */
function openFile(ctx: FrontendPluginContext, file: FileItem): void {
  const registry = getRegistry()
  const ext = extOf(file.name)
  const override = loadModeOverride(ext)
  const def = registry?.getDefault(ext)?.id ?? null
  const mode = override && registry?.get(override) ? override : def
  void ctx.router.push({
    path: '/plugin/file-viewer/view',
    query: mode ? { path: file.path, mode } : { path: file.path },
  })
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  const registry = initRegistry()
  // 拉取 config.yml 映射到注册表（失败静默，保持注册表默认）
  getMappings(ctx.api.instance)
    .then(({ extensionMappings, defaultViewer }) => {
      registry.setConfigMappings(extensionMappings)
      registry.setDefaultViewer(defaultViewer)
    })
    .catch(() => {})
  injectStyles()

  // 插件主页：查看器设置（扩展名→查看器映射）
  ctx.router.addRoute({
    path: '/plugin/file-viewer',
    component: createConfigPage(ctx) as never,
    meta: { requiresAuth: true },
  })
  // 查看页：由文件打开注册表分发进入
  ctx.router.addRoute({
    path: '/plugin/file-viewer/view',
    component: createViewerPage(ctx) as never,
    meta: { requiresAuth: true },
  })

  // 文件打开 handler：主应用单击文件名时按 canOpen 分发到 open()
  const handler: FileOpenHandler = {
    id: 'file-viewer',
    canOpen: (file) => canOpenFile(registry, file),
    open: (file) => openFile(ctx, file),
  }
  const unregisterOpen = ctx.platform.fileOpen.register(handler)

  // 卸载/重载清理：注销文件打开 handler（路由与主题由平台自动清理）
  return () => {
    unregisterOpen()
  }
}
