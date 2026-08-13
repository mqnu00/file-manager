/**
 * Hatsune Miku Theme — 前端入口
 *
 * 浏览器运行时通过 import() 动态加载，接收 ctx 访问所有前端公共资源。
 * 通过 ctx.composables.useTheme().registerTheme() 注册主题，
 * 安装插件后主项目工具栏主题下拉框自动出现"初音未来"选项。
 *
 * 配色改编自 DB_Hatsune-Miku-Theme（Discord 初音未来主题）：
 *   https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme
 * 深黑蓝背景 + 青绿霓虹高亮（#00f2ff / #0abdc6）+ 蓝/红粉点缀。
 * 图片静态资源（内置背景图 + logo + 用户上传背景图）由插件后端
 * /api/hatsune-miku-theme 提供，不依赖主项目 /plugins-assets。
 *
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

/** 插件后端 API 前缀（图片静态资源由插件自己提供） */
const API_BASE = '/api/hatsune-miku-theme'
const LOGO_URL = `${API_BASE}/logo`

/** localStorage 键：用户选择的背景图（与主题存储机制一致，按浏览器持久化） */
const STORAGE_KEY_BG = 'hatsune-miku-theme-bg'

/** localStorage 键：面板黑色半透明程度（alpha 百分比 0-100） */
const STORAGE_KEY_PANEL_OPACITY = 'hatsune-miku-theme-panel-opacity'

/** 面板透明度默认值（与主题 CSS 默认 --app-panel 的 alpha 一致） */
const DEFAULT_PANEL_OPACITY = 55

/** localStorage 键：面板背景模糊度（px 0-30） */
const STORAGE_KEY_PANEL_BLUR = 'hatsune-miku-theme-panel-blur'

/** 面板模糊度默认值（px，与主题 CSS 默认 --app-blur 一致） */
const DEFAULT_PANEL_BLUR = 4

/** 内置背景图（来自 DB_Hatsune-Miku-Theme/media，logo3.png 不适合做背景故排除） */
const BUILTIN_BG_FILES = ['f3DwR01P.png', 'o_1dmto233h1ap1grj1kn511qn1oim1o.jpg']
const DEFAULT_BG_ID = BUILTIN_BG_FILES[0]

interface BackgroundInfo {
  id: string
  label: string
  url: string
  builtin: boolean
}

/** 后端不可用时的兜底列表（仅内置图） */
function builtinFallback(): BackgroundInfo[] {
  return BUILTIN_BG_FILES.map((f) => ({
    id: f,
    label: f,
    url: `${API_BASE}/bg/${f}`,
    builtin: true,
  }))
}

/** 根据 id 查找背景定义；未知 id 回退列表第一项 */
function findBackground(bgs: BackgroundInfo[], id: string | null): BackgroundInfo {
  return bgs.find((b) => b.id === id) ?? bgs[0]
}

/** 读取当前生效的背景 id（未选择或损坏时返回默认） */
function currentBackgroundId(bgs: BackgroundInfo[]): string {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_BG)
  } catch {
    // localStorage not available
  }
  return findBackground(bgs, stored).id
}

/**
 * 应用背景图：写入 localStorage 并通过 html 内联 --miku-bg 覆盖主题 CSS 默认值。
 * 选择默认图时清除内联属性，由主题 CSS 中的默认 URL 生效。
 */
function applyBackground(id: string, bgs: BackgroundInfo[]): void {
  const bg = findBackground(bgs, id)
  try {
    localStorage.setItem(STORAGE_KEY_BG, bg.id)
  } catch {
    // localStorage not available
  }
  if (bg.id === DEFAULT_BG_ID) {
    document.documentElement.style.removeProperty('--miku-bg')
  } else {
    document.documentElement.style.setProperty('--miku-bg', `url('${bg.url}')`)
  }
}

/** 读取当前面板透明度（0-100 整数，未配置或损坏时返回默认值） */
function currentPanelOpacity(): number {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_OPACITY)
  } catch {
    // localStorage not available
  }
  const n = stored === null ? Number.NaN : Number(stored)
  if (Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.round(n)))
  }
  return DEFAULT_PANEL_OPACITY
}

/** 面板效果独立 <style>：规则限定在 html.hatsune-miku 内，切换其他主题自动失效 */
const PANEL_SETTINGS_STYLE_ID = 'hatsune-miku-panel-settings'

/**
 * 预览面板效果（透明度 + 模糊度）：写入限定 html.hatsune-miku 作用域的独立 <style>，
 * 不写入 localStorage。值等于默认值时省略对应声明，由主题 CSS 默认值生效。
 * 注意：不能写 <html> 内联变量——内联样式优先级高于所有主题样式表，会把
 * --app-blur（各主题共用）泄漏到赛博/白天主题。
 */
function previewPanelSettings(opacity: number, blur: number): void {
  const o = Math.min(100, Math.max(0, Math.round(opacity)))
  const b = Math.min(30, Math.max(0, Math.round(blur)))
  const decls: string[] = []
  if (o !== DEFAULT_PANEL_OPACITY) decls.push(`--app-panel-opacity: ${o}%`)
  if (b !== DEFAULT_PANEL_BLUR) decls.push(`--app-blur: blur(${b}px)`)
  let style = document.getElementById(PANEL_SETTINGS_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PANEL_SETTINGS_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = decls.length > 0 ? `html.hatsune-miku { ${decls.join('; ')} }` : ''
}

/** 持久化面板透明度（写入 localStorage，点击「保存面板效果」时调用） */
function savePanelOpacity(opacity: number): void {
  const value = Math.min(100, Math.max(0, Math.round(opacity)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_OPACITY, String(value))
  } catch {
    // localStorage not available
  }
}

/** 读取当前面板模糊度（0-30 整数 px，未配置或损坏时返回默认值） */
function currentPanelBlur(): number {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_BLUR)
  } catch {
    // localStorage not available
  }
  const n = stored === null ? Number.NaN : Number(stored)
  if (Number.isFinite(n)) {
    return Math.min(30, Math.max(0, Math.round(n)))
  }
  return DEFAULT_PANEL_BLUR
}

/** 持久化面板模糊度（写入 localStorage，点击「保存面板效果」时调用） */
function savePanelBlur(px: number): void {
  const value = Math.min(30, Math.max(0, Math.round(px)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_BLUR, String(value))
  } catch {
    // localStorage not available
  }
}

const THEME_CSS = `
html.hatsune-miku {
  --miku-bg: url('${API_BASE}/bg/${DEFAULT_BG_ID}');
  /* 初音特色色板（参考 DB_Hatsune-Miku-Theme）：主青 #00f2ff / 次青绿 #0abdc6 /
     亮青 #00fff1 / 辅助蓝 #03a9f4 / 点缀粉 #e91e63 / 危险红 #f40303 */
  --miku-cyan: #00f2ff;
  --miku-teal: #0abdc6;
  --miku-blue: #03a9f4;
  --miku-pink: #e91e63;
  --app-bg: #040405;
  /* 面板黑色半透明程度（alpha 百分比），可在插件主页配置，默认 55% */
  --app-panel-opacity: 55%;
  --app-panel: rgb(0 0 0 / var(--app-panel-opacity));
  --app-panel-solid: #040405;
  --app-border: rgb(10 189 198 / 25%);
  --app-shadow: 0 2px 8px rgb(0 0 0 / 60%);
  --app-glow: 0 0 12px rgb(0 242 255 / 25%);
  --app-text: #dcddde;
  --app-text-dim: #6fb3c6;
  --app-text-bright: #ffffff;
  --app-accent: #00f2ff;
  --app-accent-bg: rgb(10 189 198 / 10%);
  --app-accent-bg-hover: rgb(10 189 198 / 16%);
  --app-accent-bg-subtle: rgb(10 189 198 / 7%);
  --app-accent-border: rgb(10 189 198 / 26%);
  --app-accent-border-light: rgb(10 189 198 / 18%);
  /* 输入控件背景 = 面板黑色半透明程度 + 20%（跟随用户配置，默认 55% + 20% = 75%） */
  --app-input-bg: rgb(0 0 0 / calc(var(--app-panel-opacity) + 20%));
  --app-table-header-bg: rgb(10 189 198 / 7%);
  --app-table-header-border: rgb(10 189 198 / 20%);
  --app-table-row-hover: rgb(10 189 198 / 7%);
  --app-table-cell-border: rgb(10 189 198 / 9%);
  --app-blur: blur(4px);
  --app-text-shadow: none;
  --app-text-glow: 0 0 6px rgb(0 242 255 / 45%);
  --app-text-glow-hover: 0 0 12px rgb(0 242 255 / 70%);
  --app-checkbox-border: rgb(0 242 255 / 35%);
  --app-checkbox-shadow: 0 0 6px rgb(0 242 255 / 50%);
  --app-mask-bg: rgb(4 4 5 / 70%);
  --app-select-caret: #00f2ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgb(0 0 0 / 50%);
  --app-scrollbar-thumb: rgb(10 189 198 / 35%);
  --app-scrollbar-thumb-hover: rgb(0 242 255 / 50%);

  /* Element Plus 主题变量覆盖 */
  --el-color-primary-light-9: rgb(0 242 255 / 10%);
  --el-color-danger: #f40303;
}

/* ===== Element Plus 组件暗色覆盖（移植自主项目 html.cyber，色值适配本主题） ===== */

html.hatsune-miku .el-dialog {
  --el-dialog-bg-color: var(--app-panel-solid);
  --el-dialog-box-shadow: var(--app-glow), 0 8px 32px rgb(0 0 0 / 40%);

  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
}

html.hatsune-miku .el-dialog__header {
  border-bottom: 1px solid var(--app-border) !important;
  padding: 16px 20px !important;
}

html.hatsune-miku .el-dialog__title {
  color: var(--app-accent) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 8px rgb(0 242 255 / 30%);
}

html.hatsune-miku .el-dialog__body {
  color: var(--app-text) !important;
  padding: 20px !important;
}

html.hatsune-miku .el-dialog__footer {
  border-top: 1px solid var(--app-border) !important;
  padding: 12px 20px !important;
}

html.hatsune-miku .el-dialog__headerbtn .el-dialog__close {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-dialog__headerbtn .el-dialog__close:hover {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button {
  --el-button-text-color: var(--app-accent);
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--app-border);
  --el-button-hover-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgb(10 189 198 / 14%);
  --el-button-hover-border-color: var(--app-accent);
  --el-button-active-text-color: var(--app-accent);
  --el-button-active-bg-color: rgb(10 189 198 / 20%);
  --el-button-active-border-color: var(--app-accent);

  border-radius: 6px !important;
  font-weight: 500 !important;
}

html.hatsune-miku .el-button--default {
  background: transparent !important;
  border-color: var(--app-border) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--default:hover {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 10px rgb(10 189 198 / 25%);
}

html.hatsune-miku .el-button--primary {
  --el-button-bg-color: rgb(0 242 255 / 15%);
  --el-button-border-color: var(--app-accent);
  --el-button-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgb(0 242 255 / 25%);
  --el-button-hover-border-color: var(--app-accent);

  background: rgb(0 242 255 / 15%) !important;
  border-color: var(--app-accent) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--primary:hover {
  box-shadow: 0 0 16px rgb(0 242 255 / 30%);
}

html.hatsune-miku .el-button--success {
  --el-button-bg-color: rgb(0 255 100 / 12%);
  --el-button-border-color: rgb(0 255 100 / 40%);

  background: rgb(0 255 100 / 12%) !important;
  border-color: rgb(0 255 100 / 40%) !important;
  color: #00ff64 !important;
}

html.hatsune-miku .el-button--danger {
  --el-button-bg-color: rgb(244 3 3 / 12%);
  --el-button-border-color: rgb(244 3 3 / 40%);

  background: rgb(244 3 3 / 12%) !important;
  border-color: rgb(244 3 3 / 40%) !important;
  color: #f40303 !important;
}

html.hatsune-miku .el-button--danger:hover {
  box-shadow: 0 0 12px rgb(244 3 3 / 25%);
}

html.hatsune-miku .el-button--warning {
  --el-button-bg-color: rgb(255 160 0 / 12%);
  --el-button-border-color: rgb(255 160 0 / 40%);

  background: rgb(255 160 0 / 12%) !important;
  border-color: rgb(255 160 0 / 40%) !important;
  color: #ffa000 !important;
}

html.hatsune-miku .el-input__wrapper {
  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

html.hatsune-miku .el-input__wrapper:hover {
  border-color: rgb(10 189 198 / 50%) !important;
}

html.hatsune-miku .el-input__inner {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-input__inner::placeholder {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-message {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px);
}

html.hatsune-miku .el-message--success {
  --el-message-bg-color: rgb(0 255 100 / 10%);
  --el-message-border-color: rgb(0 255 100 / 30%);
  --el-message-text-color: #00ff64;
}

html.hatsune-miku .el-message--warning {
  --el-message-bg-color: rgb(255 160 0 / 10%);
  --el-message-border-color: rgb(255 160 0 / 30%);
  --el-message-text-color: #ffa000;
}

html.hatsune-miku .el-message--error {
  --el-message-bg-color: rgb(244 3 3 / 10%);
  --el-message-border-color: rgb(244 3 3 / 30%);
  --el-message-text-color: #f40303;
}

html.hatsune-miku .el-message--info {
  --el-message-bg-color: rgb(10 189 198 / 10%);
  --el-message-border-color: var(--app-border);
  --el-message-text-color: var(--app-text);
}

html.hatsune-miku .el-message-box {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
}

html.hatsune-miku .el-message-box__title {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-message-box__message {
  color: var(--app-text) !important;
}

html.hatsune-miku .el-message-box__headerbtn .el-message-box__close {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-progress-bar__outer {
  background: rgb(10 189 198 / 8%) !important;
  border-radius: 4px !important;
}

html.hatsune-miku .el-progress-bar__inner {
  background: linear-gradient(90deg, #00f2ff, #03a9f4) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 8px rgb(0 242 255 / 40%);
}

html.hatsune-miku .el-tree {
  background: transparent !important;
  color: var(--app-text) !important;
}

html.hatsune-miku .el-tree-node__content:hover {
  background: var(--app-accent-bg-hover) !important;
}

html.hatsune-miku .el-tree-node:focus > .el-tree-node__content {
  background-color: var(--app-accent-bg-hover) !important;
}

html.hatsune-miku .el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content {
  background: var(--app-accent-bg-hover) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-tree-node__expand-icon {
  color: var(--app-text-dim) !important;
}

html.hatsune-miku .el-tree-node__expand-icon.is-leaf {
  color: transparent !important;
}

/* el-select 触发器 */
html.hatsune-miku .el-select__wrapper {
  background: var(--app-input-bg) !important;
  box-shadow: 0 0 0 1px var(--app-border) inset !important;
}

html.hatsune-miku .el-select__wrapper:hover {
  box-shadow: 0 0 0 1px rgb(10 189 198 / 50%) inset !important;
}

html.hatsune-miku .el-select__wrapper.is-focused {
  box-shadow: 0 0 0 1px var(--app-accent) inset !important;
}

/* el-select 内容文字 */
html.hatsune-miku .el-select__placeholder {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-select__selected-item {
  color: var(--app-text-bright) !important;
}

html.hatsune-miku .el-select__caret {
  color: var(--app-accent) !important;
}

/* el-select 下拉菜单（EP 2.4+ 新结构）：外部 popper（.el-select__popper.el-popper）
   是被 teleport 到 body 的独立元素，内部 .el-select-dropdown 只是透明容器，之前把
   磨砂打在它上面只会透出 popper 自身的白色底（--el-bg-color-overlay），看不到磨砂。
   这里改用 background-attachment: fixed 把 body 同款背景层按视口坐标铺到 popper 上，
   让下拉面板透出「body 背景的对应位置」；最顶层叠一层 --app-panel 半透明黑保证文字
   可读，并继续复用「面板黑色半透明程度」设置。 */
html.hatsune-miku .el-select__popper.el-popper {
  border: 1px solid var(--app-border) !important;
  box-shadow: var(--app-glow), var(--app-shadow);
  background-color: var(--app-bg);
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* 下拉展开动画默认是 scaleY 缩放（transform）。transform 会让 background-attachment:
   fixed 的镜像背景相对 popper 重新定位，并在动画每一帧重绘，表现为「打开时图片先错位
   再对齐、每次下拉都要重新计算」。这里改成纯淡入、去掉 transform，让 fixed 背景始终
   锚定视口、只光栅化一次。 */
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-enter-active,
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-leave-active {
  opacity: 1 !important;
  transition: opacity var(--el-transition-duration) var(--el-transition-function-fast-bezier) !important;
  transform: none !important;
}

html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-enter-from,
html.hatsune-miku .el-select__popper.el-popper.el-zoom-in-top-leave-to {
  opacity: 0 !important;
  transform: none !important;
}

/* popper 箭头底色/边框跟随主题，避免出现白色三角 */
html.hatsune-miku .el-select__popper.el-popper .el-popper__arrow::before {
  background: var(--app-panel) !important;
  border-color: var(--app-border) !important;
}

html.hatsune-miku .el-select-dropdown__item {
  color: var(--app-text) !important;
}

html.hatsune-miku .el-select-dropdown__item.is-hovering {
  background: var(--app-accent-bg-hover) !important;
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-select-dropdown__item.is-selected {
  color: var(--app-accent) !important;
  font-weight: 600;
}

html.hatsune-miku .el-loading-spinner .circular {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-loading-spinner .el-loading-text {
  color: var(--app-text) !important;
}

html.hatsune-miku ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

html.hatsune-miku ::-webkit-scrollbar-track {
  background: rgb(0 0 0 / 50%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb {
  background: rgb(10 189 198 / 35%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb:hover {
  background: rgb(0 242 255 / 50%);
}

/* el-card */
html.hatsune-miku .el-card {
  --el-card-bg-color: var(--app-panel-solid);

  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
}

/* el-divider 分割线 */
html.hatsune-miku .el-divider {
  border-color: var(--app-border) !important;
}

html.hatsune-miku .el-divider__text {
  background: var(--app-panel-solid) !important;
  color: var(--app-text-dim) !important;
}

/* el-input-number 数字输入框 */
html.hatsune-miku .el-input-number .el-input-number__decrease,
html.hatsune-miku .el-input-number .el-input-number__increase {
  background: var(--app-input-bg) !important;
  border-color: var(--app-border) !important;
  color: var(--app-text) !important;
}

html.hatsune-miku .el-input-number .el-input-number__decrease:hover,
html.hatsune-miku .el-input-number .el-input-number__increase:hover {
  color: var(--app-accent) !important;
}

/* el-slider 滑块（插件主页面板透明度配置） */
html.hatsune-miku .el-slider__runway {
  background: rgb(10 189 198 / 20%) !important;
}

html.hatsune-miku .el-slider__bar {
  background: linear-gradient(90deg, #00f2ff, #03a9f4) !important;
}

html.hatsune-miku .el-slider__button {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 6px rgb(0 242 255 / 50%) !important;
}

html.hatsune-miku .el-slider__stop {
  background: rgb(10 189 198 / 30%) !important;
}

/* el-tag 标签 */
html.hatsune-miku .el-tag--danger {
  --el-tag-bg-color: rgb(244 3 3 / 12%);
  --el-tag-border-color: rgb(244 3 3 / 40%);
  --el-tag-text-color: #f40303;
}

html.hatsune-miku .el-tag--info {
  --el-tag-bg-color: rgb(10 189 198 / 12%);
  --el-tag-border-color: rgb(10 189 198 / 35%);
  --el-tag-text-color: var(--app-accent);
}

html.hatsune-miku .el-tag--warning {
  --el-tag-bg-color: rgb(255 165 0 / 12%);
  --el-tag-border-color: rgb(255 165 0 / 40%);
  --el-tag-text-color: #ffa500;
}

/* el-pagination */
html.hatsune-miku .el-pagination {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: var(--app-text);
  --el-pagination-button-bg-color: var(--app-panel-solid);
  --el-pagination-button-color: var(--app-text);
  --el-pagination-hover-color: var(--app-accent);
}

html.hatsune-miku .el-pagination .el-pager li {
  background: var(--app-panel-solid) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--app-border) !important;
}

html.hatsune-miku .el-pagination .el-pager li.is-active {
  background: var(--app-accent-bg) !important;
  color: var(--app-accent) !important;
  border-color: var(--app-accent) !important;
}

html.hatsune-miku .el-pagination .btn-prev,
html.hatsune-miku .el-pagination .btn-next {
  background: var(--app-panel-solid) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--app-border) !important;
}

/* el-table */
html.hatsune-miku .el-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--app-panel);
  --el-table-header-text-color: var(--app-text);
  --el-table-text-color: var(--app-text);
  --el-table-border-color: var(--app-border);
  --el-table-row-hover-bg-color: var(--app-accent-bg);
  --el-table-current-row-bg-color: var(--app-accent-bg);
  --el-table-expanded-cell-bg-color: transparent;
}

html.hatsune-miku .el-table th.el-table__cell {
  background: var(--app-panel) !important;
  color: var(--app-text) !important;
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table td.el-table__cell {
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell {
  background: rgb(0 0 0 / 45%) !important;
}

html.hatsune-miku .el-table__empty-text {
  color: var(--app-text-dim) !important;
}

/* el-table 选中行（初音点缀粉，参考 DB 主题 mention 高亮 #E91E63） */
html.hatsune-miku .el-table__row.current > td {
  background: rgb(233 30 99 / 14%) !important;
}

html.hatsune-miku .el-table__row.current > td .cell {
  color: #ff5c8a !important;
}

/* el-loading mask 全局加载遮罩 */
html.hatsune-miku .el-loading-mask {
  background: var(--app-mask-bg) !important;
}

/* el-form-item 表单标签 */
html.hatsune-miku .el-form-item__label {
  color: var(--app-text) !important;
}

/* el-button text 文字按钮 */
html.hatsune-miku .el-button--text {
  color: var(--app-accent) !important;
}

html.hatsune-miku .el-button--text:hover {
  color: var(--app-accent) !important;
  text-shadow: var(--app-text-glow-hover);
}

html.hatsune-miku .el-button.is-text:not(.is-disabled):hover {
  background-color: var(--app-accent-bg-hover) !important;
}

/* 浏览器自动填充背景覆盖 */
html.hatsune-miku input:-webkit-autofill,
html.hatsune-miku input:-webkit-autofill:hover,
html.hatsune-miku input:-webkit-autofill:focus {
  box-shadow: 0 0 0 1000px var(--app-input-bg) inset !important;
  -webkit-text-fill-color: var(--app-text-bright) !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* 插件搜索结果列表项：背景半透明程度 = 面板设置 + 20%（复用 --app-input-bg），
   模糊度跟随面板设置；覆盖 PluginView 里默认的实色 var(--app-bg) */
html.hatsune-miku .search-result-item {
  background: var(--app-input-bg) !important;
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
}

/* 后台任务面板：用 background-attachment: fixed 透出 body 背景对应位置。
   覆盖外层 .task-panel 容器（含子元素间 gap）及 header/empty/badge/card 子元素，
   替换 TaskPanel 里 scoped 的实色 var(--app-panel-solid) 与 .task-card 的 blur。 */
html.hatsune-miku .task-panel,
html.hatsune-miku .task-panel__header,
html.hatsune-miku .task-panel__empty,
html.hatsune-miku .task-badge,
html.hatsune-miku .task-card {
  background-color: var(--app-bg) !important;
  background-image:
    linear-gradient(var(--app-panel), var(--app-panel)),
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg) !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
  background-repeat: no-repeat !important;
  backdrop-filter: none !important;
}

/* 卡片进出场动画默认 translateX（transform）会让 fixed 背景相对卡片重定位、
   错位后再对齐，去掉 transform，只保留淡入淡出。 */
html.hatsune-miku .task-item-enter-from,
html.hatsune-miku .task-item-leave-to {
  transform: none !important;
}

/* 整体背景图：默认使用 --miku-bg，用户在插件主页切换后以 html 内联变量覆盖；
   深色半透明渐变叠加保证前景文字可读性 */
html.hatsune-miku body {
  background-color: var(--app-bg);
  /* 顶部青色氛围光晕（初音霓虹感，参考 DB 主题 box-shadow glow）+ 深色压暗层 + 背景图 */
  background-image:
    linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)),
    radial-gradient(1000px 520px at 15% -5%, rgb(0 242 255 / 12%), transparent 65%),
    var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* 登录卡片：logo 显示在"文件管理器"标题上方，按原始比例（2000×857，透明背景 PNG）自动缩放 */
html.hatsune-miku .login-header::before {
  content: '';
  display: block;
  width: 240px;
  aspect-ratio: 2000 / 857;
  margin: 0 auto 14px;
  background-color: transparent;
  background-image: url('${LOGO_URL}');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
`

/** 插件主页样式（跟随当前主题变量，任何主题下均可渲染） */
const PAGE_STYLE_ID = 'hatsune-miku-theme-page-styles'
const PAGE_CSS = `
.miku-bg-container { height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; overflow-y: auto; }
.miku-bg-card { width: 760px; background: var(--app-panel); border: 1px solid var(--app-border); border-radius: 12px; box-shadow: var(--app-glow), var(--app-shadow); backdrop-filter: var(--app-blur); }
.miku-bg-card .back-btn { color: var(--app-text-dim); padding: 4px 8px; }
.miku-bg-title { margin: 0; font-size: 20px; color: var(--app-text-bright); }
.miku-bg-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.miku-bg-sub { font-size: 13px; color: var(--app-text-dim); margin: 4px 0 0; }
.miku-bg-divider { font-size: 14px; font-weight: 600; color: var(--app-text-bright); }
.miku-bg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
.miku-bg-item { border: 2px solid var(--app-border); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--app-bg); transition: border-color 0.2s, box-shadow 0.2s; }
.miku-bg-item:hover { border-color: var(--app-accent); }
.miku-bg-item.active { border-color: var(--app-accent); box-shadow: var(--app-glow); }
.miku-bg-thumb { width: 100%; height: 120px; object-fit: cover; display: block; }
.miku-bg-name { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 12px; color: var(--app-text-dim); padding: 4px 8px; }
.miku-bg-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.miku-bg-item.active .miku-bg-name { color: var(--app-accent); }
.miku-bg-upload { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.miku-bg-upload-tip { font-size: 12px; color: var(--app-text-dim); }
.miku-config-row { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.miku-config-label { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--app-text); }
.miku-config-value { color: var(--app-accent); font-weight: 600; font-variant-numeric: tabular-nums; }
.miku-config-slider { display: flex; align-items: center; gap: 12px; }
.miku-config-slider .el-slider { flex: 1; }
.miku-config-save { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
`

function injectPageStyles(): void {
  if (document.getElementById(PAGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = PAGE_CSS
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = async (ctx) => {
  const { h, ref, defineComponent, onUnmounted } = ctx.Vue
  const { ElButton, ElDivider, ElMessage, ElMessageBox, ElSlider } = ctx.ElementPlus

  ctx.composables.useTheme().registerTheme({
    name: 'hatsune-miku',
    label: '初音未来',
    className: 'hatsune-miku',
    css: THEME_CSS,
  })

  injectPageStyles()

  /** 背景列表（内置 + 自定义），失败时保持内置兜底 */
  const backgrounds = ref<BackgroundInfo[]>(builtinFallback())

  async function refreshBackgrounds(): Promise<void> {
    try {
      const res = await ctx.api.instance.get('/hatsune-miku-theme/backgrounds')
      const list = res.data?.backgrounds
      if (Array.isArray(list) && list.length > 0) {
        backgrounds.value = list
      }
    } catch {
      // 后端不可用：保持内置兜底列表
    }
  }

  // 恢复用户上次选择的背景图与面板透明度/模糊度（默认值无需额外声明）
  await refreshBackgrounds()
  applyBackground(currentBackgroundId(backgrounds.value), backgrounds.value)
  previewPanelSettings(currentPanelOpacity(), currentPanelBlur())

  // 插件主页：背景图切换 + 自定义背景上传/删除 + 面板透明度/模糊度配置（先预览后保存）
  const BackgroundView = defineComponent({
    name: 'HatsuneMikuThemeView',
    setup() {
      const selectedId = ref(currentBackgroundId(backgrounds.value))
      const uploading = ref(false)
      const fileInputRef = ref<HTMLInputElement | null>(null)
      const panelOpacity = ref(currentPanelOpacity())
      const panelBlur = ref(currentPanelBlur())
      // 已保存的配置（localStorage 中的值），用于判断是否存在未保存修改
      const savedOpacity = ref(panelOpacity.value)
      const savedBlur = ref(panelBlur.value)

      function select(id: string) {
        applyBackground(id, backgrounds.value)
        selectedId.value = id
        ElMessage.success('背景图已切换')
      }

      async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        uploading.value = true
        try {
          const res = await ctx.api.instance.post('/hatsune-miku-theme/backgrounds', formData)
          const uploaded = res.data as { id?: string; url?: string }
          ElMessage.success('背景图已上传')
          await refreshBackgrounds()
          if (uploaded?.id) {
            applyBackground(uploaded.id, backgrounds.value)
            selectedId.value = uploaded.id
          }
        } catch (err: unknown) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
                '上传失败')
              : '上传失败'
          ElMessage.error(msg)
        } finally {
          uploading.value = false
        }
      }

      async function confirmDelete(bg: BackgroundInfo) {
        try {
          await ElMessageBox.confirm(`确定删除背景图 "${bg.label}" 吗？`, '删除确认', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning',
          })
        } catch {
          return // 用户取消
        }
        try {
          await ctx.api.instance.delete(
            `/hatsune-miku-theme/backgrounds/${encodeURIComponent(bg.id)}`
          )
          ElMessage.success('背景图已删除')
          if (selectedId.value === bg.id) {
            applyBackground(DEFAULT_BG_ID, backgrounds.value)
            selectedId.value = DEFAULT_BG_ID
          }
          await refreshBackgrounds()
        } catch {
          ElMessage.error('删除失败')
        }
      }

      /** 保存面板效果：写入 localStorage 并作为新的已保存基准 */
      function savePanelSettings() {
        savePanelOpacity(panelOpacity.value)
        savePanelBlur(panelBlur.value)
        savedOpacity.value = panelOpacity.value
        savedBlur.value = panelBlur.value
        ElMessage.success('面板效果已保存')
      }

      // 离开插件主页时还原未保存的预览（仅预览不保存的修改会被丢弃）
      onUnmounted(() => {
        previewPanelSettings(savedOpacity.value, savedBlur.value)
      })

      return () => {
        const children: any[] = []
        children.push(
          h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
            h(
              ElButton,
              { text: true, class: 'back-btn', onClick: () => window.history.back() },
              () => '← 返回'
            ),
          ])
        )

        const m: any[] = []
        m.push(
          h('div', { class: 'miku-bg-header' }, [
            h('h3', { class: 'miku-bg-title' }, '初音未来主题'),
          ])
        )
        m.push(
          h(
            'p',
            { class: 'miku-bg-sub' },
            '选择主界面背景图，切换后立即生效并自动保存。可上传自定义背景图。'
          )
        )
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '背景图')
          )
        )

        const items = backgrounds.value.map((bg) => {
          const active = bg.id === selectedId.value
          const name = h('div', { class: 'miku-bg-name' }, [
            h('span', bg.label),
            bg.builtin
              ? null
              : h(
                  ElButton,
                  {
                    size: 'small',
                    text: true,
                    type: 'danger',
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      confirmDelete(bg)
                    },
                  },
                  () => '删除'
                ),
          ])
          return h(
            'div',
            {
              class: ['miku-bg-item', active ? 'active' : ''],
              onClick: () => select(bg.id),
            },
            [
              h('img', { class: 'miku-bg-thumb', src: bg.url, alt: bg.label, loading: 'lazy' }),
              name,
            ]
          )
        })
        m.push(h('div', { class: 'miku-bg-grid' }, items))

        m.push(
          h('div', { class: 'miku-bg-upload' }, [
            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: 'image/*',
              style: { display: 'none' },
              onChange: handleFileChange,
            }),
            h(
              ElButton,
              {
                type: 'primary',
                loading: uploading.value,
                onClick: () => fileInputRef.value?.click(),
              },
              () => '上传背景图'
            ),
            h('span', { class: 'miku-bg-upload-tip' }, '支持 png / jpg / webp / gif，最大 10MB'),
          ])
        )

        const hasChanges =
          panelOpacity.value !== savedOpacity.value || panelBlur.value !== savedBlur.value

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '面板效果')
          )
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板黑色半透明程度'),
              h('span', { class: 'miku-config-value' }, `${panelOpacity.value}%`),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 100,
                modelValue: panelOpacity.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelOpacity.value = value
                  previewPanelSettings(value, panelBlur.value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelOpacity.value === DEFAULT_PANEL_OPACITY,
                  onClick: () => {
                    panelOpacity.value = DEFAULT_PANEL_OPACITY
                    previewPanelSettings(DEFAULT_PANEL_OPACITY, panelBlur.value)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大面板越不透明，默认 55%，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板背景模糊度'),
              h(
                'span',
                { class: 'miku-config-value' },
                panelBlur.value === 0 ? '无模糊' : `${panelBlur.value}px`
              ),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 30,
                modelValue: panelBlur.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelBlur.value = value
                  previewPanelSettings(panelOpacity.value, value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelBlur.value === DEFAULT_PANEL_BLUR,
                  onClick: () => {
                    panelBlur.value = DEFAULT_PANEL_BLUR
                    previewPanelSettings(panelOpacity.value, DEFAULT_PANEL_BLUR)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大背景越模糊，默认 4px，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-save' }, [
            h(
              ElButton,
              {
                type: 'primary',
                disabled: !hasChanges,
                onClick: savePanelSettings,
              },
              () => '保存面板效果'
            ),
            h(
              'span',
              { class: 'miku-bg-upload-tip' },
              hasChanges ? '有未保存的修改，点击保存后真正生效' : '当前已保存，无未保存修改'
            ),
          ])
        )

        children.push(h('div', { style: { padding: '20px 36px' } }, m))
        return h('div', { class: 'miku-bg-container' }, [
          h('div', { class: 'miku-bg-card' }, children),
        ])
      }
    },
  })

  ctx.router.addRoute({ path: '/plugin/hatsune-miku-theme', component: BackgroundView })
  console.log(
    '[Hatsune Miku Theme] Frontend loaded — theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme'
  )
}
