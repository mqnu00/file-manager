/** localStorage 键：面板黑色半透明程度（alpha 百分比 0-100） */
const STORAGE_KEY_PANEL_OPACITY = 'hatsune-miku-theme-panel-opacity'

/** 面板透明度默认值（与主题 CSS 默认 --app-panel 的 alpha 一致） */
export const DEFAULT_PANEL_OPACITY = 55

/** localStorage 键：面板背景模糊度（px 0-30） */
const STORAGE_KEY_PANEL_BLUR = 'hatsune-miku-theme-panel-blur'

/** 面板模糊度默认值（px，与主题 CSS 默认 --app-blur 一致） */
export const DEFAULT_PANEL_BLUR = 4

/** 读取当前面板透明度（0-100 整数，未配置或损坏时返回默认值） */
export function currentPanelOpacity(): number {
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
export function previewPanelSettings(opacity: number, blur: number): void {
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
export function savePanelOpacity(opacity: number): void {
  const value = Math.min(100, Math.max(0, Math.round(opacity)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_OPACITY, String(value))
  } catch {
    // localStorage not available
  }
}

/** 读取当前面板模糊度（0-30 整数 px，未配置或损坏时返回默认值） */
export function currentPanelBlur(): number {
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
export function savePanelBlur(px: number): void {
  const value = Math.min(30, Math.max(0, Math.round(px)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_BLUR, String(value))
  } catch {
    // localStorage not available
  }
}
