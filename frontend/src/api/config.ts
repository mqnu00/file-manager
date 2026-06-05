import api from './index'

export interface AuthConfig {
  token: string
  tokenExpiryHours: number
}

export interface AppConfig {
  auth: AuthConfig
  storageRoot: string
}

export function getConfig(): Promise<AppConfig> {
  return api.get('/config').then((res) => res.data)
}

export function updateConfig(data: {
  auth?: { token?: string; tokenExpiryHours?: number }
  storageRoot?: string
}): Promise<{ success: boolean; config: AppConfig; sessionsCleared: boolean }> {
  return api.put('/config', data).then((res) => res.data)
}
