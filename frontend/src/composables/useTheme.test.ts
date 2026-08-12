import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadTheme() {
  const mod = await import('./useTheme')
  return mod.useTheme()
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.className = ''
  document.head.querySelectorAll('style[id^="theme-css-"]').forEach((s) => s.remove())
})

describe('useTheme', () => {
  it('无偏好时默认 cyber 主题并应用 class', async () => {
    const theme = await loadTheme()
    expect(theme.activeTheme.value.name).toBe('cyber')
    expect(theme.isCyber.value).toBe(true)
    expect(document.documentElement.classList.contains('cyber')).toBe(true)
  })

  it('localStorage 存 light → 应用白天（无 class）', async () => {
    localStorage.setItem('file-manager-theme', 'light')
    const theme = await loadTheme()
    expect(theme.activeTheme.value.name).toBe('light')
    expect(theme.isCyber.value).toBe(false)
    expect(document.documentElement.classList.contains('cyber')).toBe(false)
  })

  it('setTheme 切换：class 增删正确 + 持久化', async () => {
    const theme = await loadTheme()
    theme.setTheme('light')
    expect(theme.activeTheme.value.name).toBe('light')
    expect(document.documentElement.classList.contains('cyber')).toBe(false)
    expect(localStorage.getItem('file-manager-theme')).toBe('light')

    theme.setTheme('cyber')
    expect(theme.activeTheme.value.name).toBe('cyber')
    expect(document.documentElement.classList.contains('cyber')).toBe(true)
    expect(localStorage.getItem('file-manager-theme')).toBe('cyber')
  })

  it('registerTheme 新增主题：themes 增加 + 注入 style，未持久化时不会自动应用', async () => {
    const theme = await loadTheme()
    theme.registerTheme({
      name: 'midnight',
      label: '午夜',
      className: 'midnight',
      css: 'html.midnight { --app-bg: #0d1117; }',
    })
    expect(theme.themes.value.map((t) => t.name)).toContain('midnight')
    expect(document.getElementById('theme-css-midnight')?.textContent).toBe(
      'html.midnight { --app-bg: #0d1117; }'
    )
    // 当前持久化主题为 cyber（默认），不自动切换到 midnight
    expect(document.documentElement.classList.contains('midnight')).toBe(false)
    expect(document.documentElement.classList.contains('cyber')).toBe(true)
  })

  it('registerTheme 后持久化主题匹配 → 立即应用（插件晚于启动注册）', async () => {
    localStorage.setItem('file-manager-theme', 'midnight')
    const theme = await loadTheme()
    // 启动时 midnight 未注册 → 回退 cyber
    expect(theme.activeTheme.value.name).toBe('cyber')

    theme.registerTheme({
      name: 'midnight',
      label: '午夜',
      className: 'midnight',
      css: 'html.midnight {}',
    })
    expect(theme.activeTheme.value.name).toBe('midnight')
    expect(document.documentElement.classList.contains('midnight')).toBe(true)
    expect(document.documentElement.classList.contains('cyber')).toBe(false)
  })

  it('同名注册覆盖：不重复添加、style 更新、可切换生效', async () => {
    const theme = await loadTheme()
    theme.registerTheme({
      name: 'midnight',
      label: '午夜',
      className: 'midnight',
      css: 'html.midnight { --app-bg: #111; }',
    })
    theme.registerTheme({
      name: 'midnight',
      label: '午夜',
      className: 'midnight',
      css: 'html.midnight { --app-bg: #222; }',
    })
    expect(theme.themes.value.filter((t) => t.name === 'midnight')).toHaveLength(1)
    expect(document.getElementById('theme-css-midnight')?.textContent).toBe(
      'html.midnight { --app-bg: #222; }'
    )

    theme.setTheme('midnight')
    expect(theme.activeTheme.value.name).toBe('midnight')
    expect(document.documentElement.classList.contains('midnight')).toBe(true)
    expect(document.documentElement.classList.contains('cyber')).toBe(false)
    expect(localStorage.getItem('file-manager-theme')).toBe('midnight')
  })
})
