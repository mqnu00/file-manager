import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

async function loadTheme() {
  const mod = await import('./useTheme')
  return mod.useTheme()
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.className = ''
})

describe('useTheme', () => {
  it('无偏好时默认 cyber 主题并应用 class', async () => {
    const theme = await loadTheme()
    expect(theme.isCyber.value).toBe(true)
    expect(document.documentElement.classList.contains('cyber')).toBe(true)
  })

  it('localStorage 存 light → isCyber false', async () => {
    localStorage.setItem('file-manager-theme', 'light')
    const theme = await loadTheme()
    expect(theme.isCyber.value).toBe(false)
    expect(document.documentElement.classList.contains('cyber')).toBe(false)
  })

  it('localStorage 存 cyber → isCyber true', async () => {
    localStorage.setItem('file-manager-theme', 'cyber')
    const theme = await loadTheme()
    expect(theme.isCyber.value).toBe(true)
  })

  it('toggle 切换并持久化偏好 + 同步 document class', async () => {
    const theme = await loadTheme()
    theme.toggle()
    await nextTick() // watch 回调异步触发
    expect(theme.isCyber.value).toBe(false)
    expect(localStorage.getItem('file-manager-theme')).toBe('light')
    expect(document.documentElement.classList.contains('cyber')).toBe(false)

    theme.toggle()
    await nextTick()
    expect(theme.isCyber.value).toBe(true)
    expect(localStorage.getItem('file-manager-theme')).toBe('cyber')
    expect(document.documentElement.classList.contains('cyber')).toBe(true)
  })
})
