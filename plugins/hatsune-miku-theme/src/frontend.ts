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
  return BUILTIN_BG_FILES.map((f) => ({ id: f, label: f, url: `${API_BASE}/bg/${f}`, builtin: true }))
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

const THEME_CSS = `
html.hatsune-miku {
  --miku-bg: url('${API_BASE}/bg/${DEFAULT_BG_ID}');
  --app-bg: #040405;
  --app-panel: rgb(10 10 14 / 55%);
  --app-panel-solid: #0a0a0f;
  --app-border: rgb(0 242 255 / 22%);
  --app-shadow: 0 2px 8px rgb(0 0 0 / 60%);
  --app-glow: 0 0 12px rgb(0 242 255 / 30%);
  --app-text: #dcddde;
  --app-text-dim: #7d8a99;
  --app-text-bright: #ffffff;
  --app-accent: #00f2ff;
  --app-accent-bg: rgb(0 242 255 / 8%);
  --app-accent-bg-hover: rgb(0 242 255 / 12%);
  --app-accent-bg-subtle: rgb(0 242 255 / 6%);
  --app-accent-border: rgb(0 242 255 / 22%);
  --app-accent-border-light: rgb(0 242 255 / 15%);
  --app-input-bg: rgb(10 10 14 / 60%);
  --app-table-header-bg: rgb(0 242 255 / 6%);
  --app-table-header-border: rgb(0 242 255 / 18%);
  --app-table-row-hover: rgb(0 242 255 / 6%);
  --app-table-cell-border: rgb(0 242 255 / 8%);
  --app-blur: blur(4px);
  --app-text-shadow: none;
  --app-text-glow: 0 0 6px rgb(0 242 255 / 45%);
  --app-text-glow-hover: 0 0 12px rgb(0 242 255 / 70%);
  --app-checkbox-border: rgb(0 242 255 / 35%);
  --app-checkbox-shadow: 0 0 6px rgb(0 242 255 / 50%);
  --app-mask-bg: rgb(4 4 5 / 70%);
  --app-select-caret: #00f2ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgb(4 4 5 / 50%);
  --app-scrollbar-thumb: rgb(0 242 255 / 25%);
  --app-scrollbar-thumb-hover: rgb(0 242 255 / 45%);

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
  --el-button-hover-bg-color: rgb(0 242 255 / 8%);
  --el-button-hover-border-color: var(--app-accent);
  --el-button-active-text-color: var(--app-accent);
  --el-button-active-bg-color: rgb(0 242 255 / 12%);
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
  box-shadow: 0 0 10px rgb(0 242 255 / 20%);
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
  border-color: rgb(0 242 255 / 40%) !important;
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
  --el-message-bg-color: rgb(0 242 255 / 8%);
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
  background: rgb(0 242 255 / 6%) !important;
  border-radius: 4px !important;
}

html.hatsune-miku .el-progress-bar__inner {
  background: linear-gradient(90deg, var(--app-accent), #0080ff) !important;
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
  box-shadow: 0 0 0 1px rgb(0 242 255 / 40%) inset !important;
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

/* el-select 下拉菜单 */
html.hatsune-miku .el-select-dropdown {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  backdrop-filter: blur(8px);
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
  background: rgb(10 10 14 / 50%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb {
  background: rgb(0 242 255 / 25%);
  border-radius: 3px;
}

html.hatsune-miku ::-webkit-scrollbar-thumb:hover {
  background: rgb(0 242 255 / 40%);
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

/* el-tag 标签 */
html.hatsune-miku .el-tag--danger {
  --el-tag-bg-color: rgb(244 3 3 / 12%);
  --el-tag-border-color: rgb(244 3 3 / 40%);
  --el-tag-text-color: #f40303;
}

html.hatsune-miku .el-tag--info {
  --el-tag-bg-color: rgb(0 242 255 / 10%);
  --el-tag-border-color: rgb(0 242 255 / 30%);
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
  --el-table-header-bg-color: var(--app-panel-solid);
  --el-table-header-text-color: var(--app-text);
  --el-table-text-color: var(--app-text);
  --el-table-border-color: var(--app-border);
  --el-table-row-hover-bg-color: var(--app-accent-bg);
  --el-table-current-row-bg-color: var(--app-accent-bg);
  --el-table-expanded-cell-bg-color: transparent;
}

html.hatsune-miku .el-table th.el-table__cell {
  background: var(--app-panel-solid) !important;
  color: var(--app-text) !important;
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table td.el-table__cell {
  border-bottom-color: var(--app-border) !important;
}

html.hatsune-miku .el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell {
  background: rgb(10 10 14 / 50%) !important;
}

html.hatsune-miku .el-table__empty-text {
  color: var(--app-text-dim) !important;
}

/* el-table 选中行 */
html.hatsune-miku .el-table__row.current > td {
  background: var(--app-accent-bg) !important;
}

html.hatsune-miku .el-table__row.current > td .cell {
  color: var(--app-accent) !important;
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

/* 整体背景图：默认使用 --miku-bg，用户在插件主页切换后以 html 内联变量覆盖；
   深色半透明渐变叠加保证前景文字可读性 */
html.hatsune-miku body {
  background-color: var(--app-bg);
  background-image: linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)), var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* 登录卡片：logo 显示在"文件管理器"标题上方，按原始比例（7529×836）自动缩放 */
html.hatsune-miku .login-header::before {
  content: '';
  display: block;
  width: 240px;
  aspect-ratio: 7529 / 836;
  margin: 0 auto 14px;
  background: url('${LOGO_URL}') no-repeat center / contain;
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
`

function injectPageStyles(): void {
  if (document.getElementById(PAGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = PAGE_CSS
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = async (ctx) => {
  const { h, ref, defineComponent } = ctx.Vue
  const { ElButton, ElDivider, ElMessage, ElMessageBox } = ctx.ElementPlus

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

  // 恢复用户上次选择的背景图（默认图无需内联覆盖）
  await refreshBackgrounds()
  applyBackground(currentBackgroundId(backgrounds.value), backgrounds.value)

  // 插件主页：背景图切换 + 自定义背景上传/删除
  const BackgroundView = defineComponent({
    name: 'HatsuneMikuThemeView',
    setup() {
      const selectedId = ref(currentBackgroundId(backgrounds.value))
      const uploading = ref(false)
      const fileInputRef = ref<HTMLInputElement | null>(null)

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
              ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? '上传失败')
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
          await ctx.api.instance.delete(`/hatsune-miku-theme/backgrounds/${encodeURIComponent(bg.id)}`)
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

      return () => {
        const children: any[] = []
        children.push(
          h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
            h(ElButton, { text: true, class: 'back-btn', onClick: () => window.history.back() }, () => '← 返回'),
          ])
        )

        const m: any[] = []
        m.push(h('div', { class: 'miku-bg-header' }, [h('h3', { class: 'miku-bg-title' }, '初音未来主题')]))
        m.push(h('p', { class: 'miku-bg-sub' }, '选择主界面背景图，切换后立即生效并自动保存。可上传自定义背景图。'))
        m.push(h(ElDivider, { contentPosition: 'left' }, () => h('span', { class: 'miku-bg-divider' }, '背景图')))

        const items = backgrounds.value.map((bg) => {
          const active = bg.id === selectedId.value
          const name = h('div', { class: 'miku-bg-name' }, [
            h('span', bg.label),
            bg.builtin
              ? null
              : h(ElButton, {
                  size: 'small',
                  text: true,
                  type: 'danger',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    confirmDelete(bg)
                  },
                }, () => '删除'),
          ])
          return h('div', {
            class: ['miku-bg-item', active ? 'active' : ''],
            onClick: () => select(bg.id),
          }, [
            h('img', { class: 'miku-bg-thumb', src: bg.url, alt: bg.label, loading: 'lazy' }),
            name,
          ])
        })
        m.push(h('div', { class: 'miku-bg-grid' }, items))

        m.push(h('div', { class: 'miku-bg-upload' }, [
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*',
            style: { display: 'none' },
            onChange: handleFileChange,
          }),
          h(ElButton, { type: 'primary', loading: uploading.value, onClick: () => fileInputRef.value?.click() }, () => '上传背景图'),
          h('span', { class: 'miku-bg-upload-tip' }, '支持 png / jpg / webp / gif，最大 10MB'),
        ]))

        children.push(h('div', { style: { padding: '20px 36px' } }, m))
        return h('div', { class: 'miku-bg-container' }, [h('div', { class: 'miku-bg-card' }, children)])
      }
    },
  })

  ctx.router.addRoute({ path: '/plugin/hatsune-miku-theme', component: BackgroundView })
  console.log('[Hatsune Miku Theme] Frontend loaded — theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme')
}
