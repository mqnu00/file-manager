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
  /** npm 插件安装目录，默认开发环境 {cwd}/node_modules，生产环境 ~/.file-manager/node_modules */
  pluginInstallDir?: string
  plugins?: Record<string, any>
}

const CONFIG_PATH = process.env.CONFIG_PATH
  || path.join(__dirname, '../config.yml')

/** 判断是否为生产环境（__dirname 在 node_modules 内） */
function isProduction(): boolean {
  return __dirname.includes('node_modules')
}

function getDefaultPluginInstallDir(): string {
  if (isProduction()) {
    return path.join(os.homedir(), '.file-manager', 'node_modules')
  }
  return path.join(process.cwd(), 'node_modules')
}

function ensurePluginInstallPrefix(): void {
  const prefix = path.dirname(getPluginInstallDir())
  const pkgPath = path.join(prefix, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.mkdirSync(prefix, { recursive: true })
    fs.writeFileSync(pkgPath, JSON.stringify({ private: true, description: 'File Manager plugin store' }, null, 2), 'utf-8')
  }
}

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

  const cfg = { ...DEFAULT_CONFIG, pluginInstallDir: getDefaultPluginInstallDir() }
  const yamlStr = yaml.dump(cfg, { lineWidth: -1, noRefs: true })
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

export function removePluginConfig(name: string): AppConfig {
  const current = readRaw()
  const plugins: Record<string, unknown> = { ...(current.plugins || {}) }
  delete plugins[name]
  const merged: AppConfig = { ...current, plugins }
  const yamlStr = yaml.dump(merged, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf-8')
  cachedConfig = merged
  return merged
}

export function getPluginDefaultConfig(rootDir: string): Record<string, unknown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.join(rootDir, 'package.json'))
    const schema = pkg?.fileManagerPlugin?.config as Record<string, { default?: unknown }> | undefined
    if (!schema) return {}
    const defaults: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(schema)) {
      if (field && typeof field === 'object' && 'default' in field) {
        defaults[key] = field.default
      }
    }
    return defaults
  } catch {
    return {}
  }
}

export function isDefaultToken(): boolean {
  return getConfig().auth.token === DEFAULT_CONFIG.auth.token
}

/** 获取 npm 插件安装目录（展开 ~ 并回退默认值） */
export function getPluginInstallDir(): string {
  const cfg = getConfig()
  const raw = cfg.pluginInstallDir || getDefaultPluginInstallDir()
  return raw.replace(/^~/, os.homedir())
}

/** 获取 npm 插件安装的 prefix 目录（pluginInstallDir 的父目录） */
export function getPluginInstallPrefix(): string {
  return path.dirname(getPluginInstallDir())
}

/** 确保插件安装 prefix 目录存在且有 package.json */
export { ensurePluginInstallPrefix }