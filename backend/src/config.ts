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

export interface SmbShare {
  name: string
  path: string
  readOnly: boolean
  guestOk: boolean
}

export interface SmbUser {
  username: string
  password: string
}

export interface SmbConfig {
  enabled: boolean
  port: number
  workgroup: string
  serverString: string
  shares: SmbShare[]
  users: SmbUser[]
}

export interface AppConfig {
  auth: AuthConfig
  storageRoot: string
  log: LogConfig
  smb?: SmbConfig
  plugins?: Record<string, any>
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
  const config = yaml.load(raw) as AppConfig
  // 兼容旧配置文件：确保 smb.users 和 smb.shares 存在
  if (config.smb) {
    if (!config.smb.shares) config.smb.shares = []
    if (!config.smb.users) config.smb.users = []
  }
  return config
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
    },
    smb: updates.smb !== undefined
      ? {
          ...(current.smb || {}),
          ...updates.smb,
          shares: updates.smb.shares || (current.smb || {}).shares || [],
          users: updates.smb.users || (current.smb || {}).users || []
        }
      : current.smb
  }
  const yamlStr = yaml.dump(merged, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf-8')
  cachedConfig = merged
  return merged
}

export function updatePluginConfig(name: string, cfg: Record<string, unknown>): AppConfig {
  const current = readRaw()
  const plugins: Record<string, unknown> = { ...(current.plugins || {}) }
  plugins[name] = { ...((plugins[name] as Record<string, unknown>) || {}), ...cfg }
  const merged: AppConfig = { ...current, plugins }
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