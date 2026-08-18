/**
 * 扩展名 → 查看模式 的用户覆盖（localStorage 持久化）
 *
 * 用户在某查看页内切换"打开方式"后记住选择；此后文件列表单击打开
 * 该扩展名文件时优先使用覆盖值，而非注册表默认。
 */

const OVERRIDE_KEY = 'file-viewer:mode-override'

function safeGet(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function safeSet(map: Record<string, string>): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
  } catch {
    // 隐私模式等场景下写入失败可忽略
  }
}

/** 读取指定扩展名的覆盖模式（无则 null） */
export function loadModeOverride(ext: string): string | null {
  const key = (ext || '').toLowerCase().replace(/^\./, '')
  if (!key) return null
  return safeGet()[key] ?? null
}

/** 保存指定扩展名的覆盖模式 */
export function saveModeOverride(ext: string, modeId: string): void {
  const key = (ext || '').toLowerCase().replace(/^\./, '')
  if (!key) return
  const map = safeGet()
  map[key] = modeId
  safeSet(map)
}

/** 清除指定扩展名的覆盖模式 */
export function clearModeOverride(ext: string): void {
  const key = (ext || '').toLowerCase().replace(/^\./, '')
  if (!key) return
  const map = safeGet()
  delete map[key]
  safeSet(map)
}