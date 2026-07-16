import fs from 'fs'
import os from 'os'
import path from 'path'
import yaml from 'js-yaml'

export interface AuthConfig {
  token: string
  tokenExpiryHours: number
}

export interface LogConfig {
  cleanupOnStartup: boolean
  retentionDays: number
}

export interface AppConfig {
  auth: AuthConfig
  storageRoot: string
  log: LogConfig
}

const CONFIG_PATH = process.env.CONFIG_PATH
  || path.join(__dirname, '../config.yml')

const DEFAULT_CONFIG: AppConfig = {
  auth: {
    token: 'admin123',
    tokenExpiryHours: 24
  },
  storageRoot: process.env.FILE_MANAGER_BASE_DIR || process.cwd(),
  log: {
    cleanupOnStartup: true,
    retentionDays: 30
  }
}

function ensureConfig(): void {
  if (fs.existsSync(CONFIG_PATH)) return

  const yamlStr = yaml.dump(DEFAULT_CONFIG, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf-8')
  console.log('📝 已生成默认配置文件 config.yml')
}

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
    ensureConfig()
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
    },
    log: {
      ...current.log,
      ...(updates.log || {})
    }
  }
  const yamlStr = yaml.dump(merged, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf-8')
  cachedConfig = merged
  return merged
}

export function getSanitizedConfig() {
  const cfg = getConfig()
  const masked = cfg.auth.token
    ? cfg.auth.token.slice(0, 3) + '***'
    : ''
  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      token: masked
    }
  }
}

export function isDefaultToken(): boolean {
  return getConfig().auth.token === DEFAULT_CONFIG.auth.token
}