import api from './index'

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

export function getConfig(): Promise<AppConfig> {
  return api.get('/config').then((res) => res.data)
}

export function updateConfig(data: {
  auth?: { token?: string; tokenExpiryHours?: number }
  storageRoot?: string
  log?: { cleanupOnStartup?: boolean; retentionDays?: number }
}): Promise<{ success: boolean; config: AppConfig; sessionsCleared: boolean }> {
  return api.put('/config', data).then((res) => res.data)
}

export function cleanLogs(): Promise<{ success: boolean; deleted: number }> {
  return api.post('/config/clean-logs').then((res) => res.data)
}
