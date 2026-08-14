/**
 * 插件后端 API 前缀（图片静态资源由插件自己提供）。
 * 构建期可用 esbuild `define` 注入 __MIKU_API_BASE__ / __MIKU_LOGO_URL__，
 * 供 gh-pages demo 等无后端场景改用静态文件地址；未注入时回落生产 /api 路径。
 * typeof 守卫避免 ESM 严格模式下未声明标识符抛错。
 */
declare const __MIKU_API_BASE__: string | undefined
declare const __MIKU_LOGO_URL__: string | undefined

export const API_BASE =
  typeof __MIKU_API_BASE__ !== 'undefined' ? __MIKU_API_BASE__ : '/api/hatsune-miku-theme'
export const LOGO_URL =
  typeof __MIKU_LOGO_URL__ !== 'undefined' ? __MIKU_LOGO_URL__ : `${API_BASE}/logo`

/** localStorage 键：用户选择的背景图（与主题存储机制一致，按浏览器持久化） */
const STORAGE_KEY_BG = 'hatsune-miku-theme-bg'

/** 内置背景图（来自 DB_Hatsune-Miku-Theme/media，logo3.png 不适合做背景故排除） */
const BUILTIN_BG_FILES = ['f3DwR01P.png', 'o_1dmto233h1ap1grj1kn511qn1oim1o.jpg']
export const DEFAULT_BG_ID = BUILTIN_BG_FILES[0]

export interface BackgroundInfo {
  id: string
  label: string
  url: string
  builtin: boolean
}

/** 后端不可用时的兜底列表（仅内置图） */
export function builtinFallback(): BackgroundInfo[] {
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
export function currentBackgroundId(bgs: BackgroundInfo[]): string {
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
export function applyBackground(id: string, bgs: BackgroundInfo[]): void {
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
