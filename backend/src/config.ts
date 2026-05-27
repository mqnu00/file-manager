import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export interface AuthConfig {
  token: string
  tokenExpiryHours: number
}

export interface AppConfig {
  auth: AuthConfig
  storageRoot: string
}

const CONFIG_PATH = path.join(__dirname, '../config.yml')

let cachedConfig: AppConfig | null = null
let watching = false

function startWatch(): void {
  if (watching) return
  watching = true
  fs.watchFile(CONFIG_PATH, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      try {
        cachedConfig = readRaw()
        console.log('📁 配置文件已热加载')
      } catch (e) {
        console.error('配置文件解析失败:', e)
      }
    }
  })
  process.on('exit', () => { fs.unwatchFile(CONFIG_PATH) })
}

function readRaw(): AppConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  return yaml.load(raw) as AppConfig
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    startWatch()
    cachedConfig = readRaw()
  }
  return cachedConfig
}

export function reloadConfig(): AppConfig {
  cachedConfig = readRaw()
  return cachedConfig
}

export function updateConfig(updates: Partial<AppConfig>): AppConfig {
  const current = readRaw()
  const merged: AppConfig = {
    ...current,
    ...updates,
    auth: {
      ...current.auth,
      ...(updates.auth || {})
    }
  }
  const yamlStr = yaml.dump(merged, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf-8')
  cachedConfig = merged
  return merged
}

export function getSanitizedConfig(): Omit<AppConfig, 'auth'> & { auth: Omit<AuthConfig, 'token'> & { token: string } } {
  const cfg = getConfig()
  const masked = cfg.auth.token
    ? cfg.auth.token.slice(0, 2) + '***' + cfg.auth.token.slice(-2)
    : ''
  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      token: masked
    }
  }
}