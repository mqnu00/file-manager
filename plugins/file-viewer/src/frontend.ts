/**
 * file-viewer 核心前端
 *
 * 1. 向主应用文件打开注册表（ctx.platform.fileOpen）注册唯一 handler：
 *    声明"哪些文件可打开"，主应用渲染期据此打 is-openable 标记、单击时分发调用 open()。
 *    —— file-viewer 是平台 fileOpen 的唯一注册者；子插件只经服务向核心报备能力，
 *       不再直接注册 fileOpen（见各子插件后端 registerViewer + 前端查看页路由）。
 * 2. open()：根据可编辑的扩展名映射表解析出最佳查看器，SPA 跳转到该查看器的
 *    查看页路由（子插件自己渲染）；不再有中央全局注册表。
 * 3. 注册配置页路由 /plugin/file-viewer（requiresAuth）。
 * 4. teardown：注销 fileOpen handler（路由与主题由平台自动清理）。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
  FileOpenHandler,
} from '@mqn00/file-manager/plugin/frontend'
import { createConfigPage } from './config-page'
import { refreshViewers, canOpenExt, canOpenFile, resolveViewer, normExt, PLUGINS_CHANGED_EVENT } from './state'

function injectStyles(): void {
  if (document.getElementById('file-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-viewer-style'
  style.textContent = `
.file-name-text.is-openable { cursor: pointer !important; transition: all 0.2s; color: var(--app-accent); text-shadow: var(--app-text-glow); }
.file-name-text.is-openable:hover { color: var(--app-accent); text-shadow: var(--app-text-glow-hover); text-decoration: underline; }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const http = ctx.api.instance
  const fileOpen = ctx.platform.fileOpen

  // 拉取已注册查看器 + 映射配置（失败静默，保持空状态）
  void refreshViewers(http).catch(() => {})

  // 插件集合变化（加载/卸载/重载）后重算可打开集合：后端注册表已由子插件 teardown
  // 注销，重新拉取并通知主应用重算 is-openable 标记（避免卸载后子查看器后缀仍可点击）
  const onPluginsChanged = () => {
    void refreshViewers(http)
      .catch(() => {})
      .finally(() => fileOpen.refresh())
  }
  window.addEventListener(PLUGINS_CHANGED_EVENT, onPluginsChanged)

  // 配置页：查看器设置（扩展名→查看器映射）
  ctx.router.addRoute({
    path: '/plugin/file-viewer',
    component: createConfigPage(ctx) as never,
    meta: { requiresAuth: true },
  })

  // 文件打开 handler（平台 fileOpen 唯一注册者）
  // canOpen：决定单击是否触发 open()（含 defaultViewer 兜底 + 无后缀文件）
  // isOpenable：控制 is-openable 蓝色标记（仅映射表命中，不含 defaultViewer 兜底）
  const handler: FileOpenHandler = {
    id: 'file-viewer',
    canOpen: (file: FileItem) => {
      if (file.isDirectory || file.broken) return false
      return canOpenFile(normExt(file.name))
    },
    isOpenable: (file: FileItem) => {
      if (file.isDirectory || file.broken) return false
      return canOpenExt(normExt(file.name))
    },
    open: (file: FileItem) => {
      const v = resolveViewer(normExt(file.name))
      if (v) {
        void ctx.router.push({ path: v.route, query: { path: file.path } })
      }
    },
  }
  const unregisterOpen = fileOpen.register(handler)

  // 卸载/重载清理：注销文件打开 handler、移除事件监听（路由与主题由平台自动清理）
  return () => {
    window.removeEventListener(PLUGINS_CHANGED_EVENT, onPluginsChanged)
    unregisterOpen()
  }
}
