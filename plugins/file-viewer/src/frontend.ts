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
import { createViewerPageShell } from './viewer-page-shell'
import { refreshViewers, canOpenExt, canOpenFile, resolveViewer, normExt } from './state'

function injectStyles(): void {
  if (document.getElementById('file-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-viewer-style'
  style.textContent = `
.file-name-text.is-openable { cursor: pointer !important; transition: all 0.2s; color: var(--app-accent); text-shadow: var(--app-text-glow); }
.file-name-text.is-openable:hover { color: var(--app-accent); text-shadow: var(--app-text-glow-hover); text-decoration: underline; }

/* 查看页外壳样式 */
.fv-shell-page { height: 100%; display: flex; flex-direction: column; padding: 16px 20px; box-sizing: border-box; }
.fv-shell-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.fv-shell-name { font-size: 16px; font-weight: 600; color: var(--app-text-bright); }
.fv-shell-path { max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-shell-size { color: var(--app-text-dim); font-size: 12px; }
.fv-shell-actions { margin-left: auto; }
.fv-shell-mode-select { width: 180px; }
.fv-shell-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const http = ctx.api.instance
  const fileOpen = ctx.platform.fileOpen

  // 暴露共享查看页外壳给子插件使用
  // 子插件在 install() 时读取 window.__fm_create_viewer_page_shell(ctx, component)
  // 创建带有查看器切换下拉的查看页，替代各自简陋的 createViewerPage
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__fm_create_viewer_page_shell =
      (shellCtx: FrontendPluginContext, component: unknown, name?: string) =>
        createViewerPageShell(shellCtx, component, name)
  }

  // 惰性拉取：canOpen/isOpenable 首次被调用（FileTable 渲染，此时用户已登录）
  // 时确保查看器状态已加载。首次 install 时的 fetch 可能因后端未就绪/尚未
  // 登录而失败，此处兜底重试；成功后停止，失败则下次渲染再试。
  let refreshStarted = false
  const ensureViewers = (): void => {
    if (refreshStarted) return
    refreshStarted = true
    void refreshViewers(http)
      .catch(() => {
        // 失败：允许下次 canOpen 调用重试
        refreshStarted = false
      })
      .finally(() => fileOpen.refresh())
  }

  // 首次安装即拉取（会话已存在的场景下提前填充，避免首帧闪烁）
  void refreshViewers(http)
    .catch(() => {})
    .finally(() => fileOpen.refresh())

  // 插件集合变化（加载/卸载/重载）后重算可打开集合：后端注册表已由子插件 teardown
  // 注销，重新拉取并通知主应用重算 is-openable 标记（避免卸载后子查看器后缀仍可点击）
  const onPluginsChanged = () => {
    void refreshViewers(http)
      .catch(() => {})
      .finally(() => fileOpen.refresh())
  }
  window.addEventListener(ctx.platform.PLUGINS_CHANGED_EVENT, onPluginsChanged)

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
      ensureViewers()
      if (file.isDirectory || file.broken) return false
      return canOpenFile(normExt(file.name))
    },
    isOpenable: (file: FileItem) => {
      ensureViewers()
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

  // 卸载/重载清理：注销文件打开 handler、移除事件监听、清理全局 shell（路由与主题由平台自动清理）
  return () => {
    window.removeEventListener(ctx.platform.PLUGINS_CHANGED_EVENT, onPluginsChanged)
    unregisterOpen()
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__fm_create_viewer_page_shell
    }
  }
}
