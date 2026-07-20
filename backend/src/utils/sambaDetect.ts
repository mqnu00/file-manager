import { execSync } from 'child_process'

interface SambaInfo {
  installed: boolean
  path?: string
  version?: string
}

let cached: SambaInfo | null = null

export function detectSamba(): SambaInfo {
  if (cached) return cached

  try {
    const path = execSync('which smbd', { encoding: 'utf-8', timeout: 3000 }).trim()
    if (!path) {
      cached = { installed: false }
      return cached
    }

    let version: string | undefined
    try {
      version = execSync('smbd --version', { encoding: 'utf-8', timeout: 3000 }).trim()
    } catch {
      // 版本获取失败不影响
    }

    cached = { installed: true, path, version }
    return cached
  } catch {
    cached = { installed: false }
    return cached
  }
}

export function clearSambaCache(): void {
  cached = null
}
