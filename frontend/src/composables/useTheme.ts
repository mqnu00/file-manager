import { ref, computed } from 'vue'
import {
  STORAGE_KEY_THEME,
  THEME_CLASS_CYBER,
  THEME_VALUE_CYBER,
  THEME_VALUE_LIGHT,
} from '@/constants'

export interface ThemeDefinition {
  /** 主题唯一标识，同时作为 localStorage 持久化值 */
  name: string
  /** 下拉框显示名称 */
  label: string
  /** 应用到 <html> 的类；light 为 ''（:root 即白天，无类） */
  className: string
  /** 可选主题样式文本，提供则由主项目注入 <style data-theme="name"> */
  css?: string
}

const themes = ref<ThemeDefinition[]>([
  { name: THEME_VALUE_LIGHT, label: '白天', className: '' },
  { name: THEME_VALUE_CYBER, label: '赛博', className: THEME_CLASS_CYBER },
])

const activeTheme = ref<ThemeDefinition>(loadPreference())

function loadPreference(): ThemeDefinition {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME)
    if (stored !== null) {
      const found = themes.value.find((t) => t.name === stored)
      if (found) return found
    }
  } catch {
    // localStorage not available, use default
  }
  return themes.value.find((t) => t.name === THEME_VALUE_CYBER) ?? themes.value[0]
}

/** 仅应用主题 class（不持久化） */
function applyClass(theme: ThemeDefinition) {
  activeTheme.value = theme
  // 移除所有已注册主题的 class，避免残留
  for (const t of themes.value) {
    if (t.className) document.documentElement.classList.remove(t.className)
  }
  if (theme.className) document.documentElement.classList.add(theme.className)
}

function persistTheme(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, name)
  } catch {
    // localStorage not available, skip persisting
  }
}

/** 应用主题并持久化（用户切换 / 注册主题匹配存储值时调用） */
function applyTheme(theme: ThemeDefinition) {
  applyClass(theme)
  persistTheme(theme.name)
}

/**
 * 反注册主题（插件卸载时由平台调用）：
 * 移除主题列表项与注入的 <style>；若被移除的是当前活动主题，
 * 先移除其 class 再回退到默认主题（与 loadPreference 同规则：cyber 优先）并持久化，保证刷新一致。
 */
export function unregisterTheme(name: string): void {
  let className = ''
  const index = themes.value.findIndex((t) => t.name === name)
  if (index >= 0) {
    className = themes.value[index].className
    themes.value.splice(index, 1)
  }
  document.getElementById(`theme-css-${name}`)?.remove()
  if (activeTheme.value.name === name) {
    // 被卸载主题已不在列表中，applyClass 的清 class 循环扫不到它，需手动移除
    if (className) document.documentElement.classList.remove(className)
    const fallback = themes.value.find((t) => t.name === THEME_VALUE_CYBER) ?? themes.value[0]
    if (fallback) applyTheme(fallback)
  }
}

/** 注册（或覆盖同名）主题，供插件通过 ctx 调用 */
export function registerTheme(def: ThemeDefinition): void {
  const index = themes.value.findIndex((t) => t.name === def.name)
  if (index >= 0) {
    themes.value[index] = def
  } else {
    themes.value.push(def)
  }

  // 提供 css 则注入/更新样式标签（id 去重，重载插件时覆盖）
  if (def.css) {
    let style = document.getElementById(`theme-css-${def.name}`) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = `theme-css-${def.name}`
      document.head.appendChild(style)
    }
    style.textContent = def.css
  }

  // 插件注册晚于主应用启动：若持久化的主题正是它，立即应用
  try {
    if (localStorage.getItem(STORAGE_KEY_THEME) === def.name) {
      applyTheme(def)
    }
  } catch {
    // localStorage not available, skip
  }
}

export function useTheme() {
  // 初始化仅应用偏好主题 class，不覆写 localStorage：
  // 插件主题注册晚于启动，存储值可能是尚未注册的主题名，需保留待 registerTheme 匹配
  applyClass(activeTheme.value)

  function setTheme(name: string) {
    const found = themes.value.find((t) => t.name === name)
    if (found) applyTheme(found)
  }

  return {
    themes,
    activeTheme,
    /** 是否为赛博主题（控制 SciFiBackground 等赛博特效显示） */
    isCyber: computed(() => activeTheme.value.name === THEME_VALUE_CYBER),
    setTheme,
    registerTheme,
    unregisterTheme,
  }
}
