import api from './index'

export interface AuthConfig {
  token: string
  tokenExpiryHours: number
}

export interface LogConfig {
  cleanupOnStartup: boolean
  retentionDays: number
}

export interface NpmRegistryConfig {
  url?: string
  enabled?: boolean
}

export interface AppConfig {
  auth: AuthConfig
  storageRoot: string
  log: LogConfig
  pluginInstallDir?: string
  npmRegistry?: NpmRegistryConfig
}

export function getConfig(): Promise<AppConfig> {
  return api.get('/config').then((res) => res.data)
}

export function updateConfig(data: {
  auth?: { token?: string; tokenExpiryHours?: number }
  storageRoot?: string
  log?: { cleanupOnStartup?: boolean; retentionDays?: number }
  pluginInstallDir?: string
  npmRegistry?: { url?: string; enabled?: boolean }
}): Promise<{ success: boolean; config: AppConfig; sessionsCleared: boolean }> {
  return api.put('/config', data).then((res) => res.data)
}

export function cleanLogs(): Promise<{ success: boolean; deleted: number }> {
  return api.post('/config/clean-logs').then((res) => res.data)
}

export function testRegistry(url: string): Promise<{ ok: boolean; latency: number; error?: string }> {
  return api.post('/config/test-registry', { url }).then((res) => res.data)
}
