/**
 * file-viewer 核心前端
 *
 * 1. 劫持主应用文件列表的单击（捕获阶段监听 document click，
 *    匹配文件名元素 .file-name-text 且非文件夹），从 ctx.stores.file
 *    取当前文件，按扩展名解析默认查看模式后 SPA 导航到查看页。
 * 2. 初始化 globalThis 查看器注册表（子插件在此 register 自己的查看模块）。
 * 3. 注册查看页路由 /plugin/file-viewer（requiresAuth）。
 *
 * 注意：与主应用 DOM 结构耦合（.file-name-text / .is-folder 类名），
 * 主应用重构文件列表时需同步更新（见 README）。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { initRegistry, getRegistry } from './registry'
import { loadModeOverride } from './overrides'
import { createViewerPage } from './page'
import { createConfigPage } from './config-page'
import { getMappings } from './config-api'

/** 全局安装标记：热重载时先移除旧劫持监听，避免重复触发 */
const INSTALL_KEY = '__fm_file_viewer_installed__'

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * SPA 导航：主应用 ctx 未暴露 router.push，利用 vue-router 的 popstate 监听
 * （pushState 后派发合成 PopStateEvent → vue-router 解析新 URL 并导航，
 * 路由守卫照常生效，不整页刷新）。
 */
function spaNavigate(url: string): void {
  history.pushState(history.state ?? null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
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
`
  document.head.appendChild(style)
}

function openFile(ctx: FrontendPluginContext, file: FileItem): void {
  const reg = getRegistry()
  const ext = extOf(file.name)
  // 优先级：用户覆盖（localStorage） > config.yml 映射 > 注册表默认
  const override = loadModeOverride(ext)
  const def = reg?.getDefault(ext)?.id ?? null
  const mode = override && reg?.get(override) ? override : def
  const url = `/plugin/file-viewer/view?path=${encodeURIComponent(file.path)}${
    mode ? `&mode=${encodeURIComponent(mode)}` : ''
  }`
  spaNavigate(url)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  const registry = initRegistry()
  // 拉取 config.yml 映射到注册表（失败静默，保持注册表默认）
  getMappings(ctx.api.instance)
    .then((map) => registry.setConfigMappings(map))
    .catch(() => {})
  injectStyles()

  // 插件主页：查看器设置（扩展名→查看器映射）
  ctx.router.addRoute({
    path: '/plugin/file-viewer',
    component: createConfigPage(ctx) as never,
    meta: { requiresAuth: true },
  })
  // 查看页：单击文件打开
  ctx.router.addRoute({
    path: '/plugin/file-viewer/view',
    component: createViewerPage(ctx) as never,
    meta: { requiresAuth: true },
  })

  // 热重载/重复安装：先移除旧监听
  const prevTeardown = (globalThis as Record<string, unknown>)[INSTALL_KEY] as
    | (() => void)
    | undefined
  prevTeardown?.()

  const handler = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const nameEl = target.closest('.file-name-text')
    // 文件夹/符号链接/其他区域不劫持，保留主应用行为
    if (!nameEl || nameEl.classList.contains('is-folder')) return
    const fileName = nameEl.textContent?.trim() ?? ''
    if (!fileName) return
    const file = ctx.stores.file.files.find(
      (f) => !f.isDirectory && !f.broken && f.name === fileName
    )
    if (!file) return
    e.preventDefault()
    e.stopPropagation()
    openFile(ctx, file)
  }

  document.addEventListener('click', handler, true)
  const teardown = () => document.removeEventListener('click', handler, true)
  ;(globalThis as Record<string, unknown>)[INSTALL_KEY] = teardown

  console.log(
    '[file-viewer] 核心前端已加载：单击劫持已启用，查看页 /plugin/file-viewer/view 与配置页 /plugin/file-viewer 已注册'
  )
}