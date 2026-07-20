import api from './index'

export interface SmbShare {
  name: string
  path: string
  readOnly: boolean
  guestOk: boolean
}

export interface SmbStatus {
  state: 'stopped' | 'running' | 'not_installed' | 'error'
  port: number
  workgroup: string
  serverString: string
  shares: SmbShare[]
  authMode: 'password' | 'guest'
  error?: string
  startedAt?: number
}

export interface SmbUser {
  username: string
  password: string
}

export function getSmbStatus(): Promise<SmbStatus> {
  return api.get('/smb/status').then((res) => res.data)
}

export function startSmb(): Promise<{ success: boolean; port: number }> {
  return api.post('/smb/start').then((res) => res.data)
}

export function stopSmb(): Promise<{ success: boolean }> {
  return api.post('/smb/stop').then((res) => res.data)
}

export function updateSmbSettings(data: {
  port?: number
  workgroup?: string
  serverString?: string
  enabled?: boolean
}): Promise<{ success: boolean }> {
  return api.put('/smb/settings', data).then((res) => res.data)
}

export function getSmbShares(): Promise<SmbShare[]> {
  return api.get('/smb/shares').then((res) => res.data)
}

export function createSmbShare(data: {
  name: string
  path: string
  readOnly: boolean
  guestOk: boolean
}): Promise<{ success: boolean; share: SmbShare }> {
  return api.post('/smb/shares', data).then((res) => res.data)
}

export function updateSmbShare(
  name: string,
  data: { path?: string; readOnly?: boolean; guestOk?: boolean; newName?: string }
): Promise<{ success: boolean; share: SmbShare }> {
  return api.put(`/smb/shares/${encodeURIComponent(name)}`, data).then((res) => res.data)
}

export function deleteSmbShare(name: string): Promise<{ success: boolean }> {
  return api.delete(`/smb/shares/${encodeURIComponent(name)}`).then((res) => res.data)
}

export interface InstallInfo {
  manager: string
  command: string
  rawCommand: string
  pkexecAvailable: boolean
  osName: string
}

export function getSmbInstallInfo(): Promise<InstallInfo> {
  return api.get('/smb/install-info').then((res) => res.data)
}

// ==================== 用户管理 ====================

export function getSmbUsers(): Promise<SmbUser[]> {
  return api.get('/smb/users').then((res) => res.data)
}

export function createSmbUser(data: { username: string; password: string }): Promise<{ success: boolean; user: { username: string } }> {
  return api.post('/smb/users', data).then((res) => res.data)
}

export function updateSmbUser(username: string, data: { password: string }): Promise<{ success: boolean; user: { username: string } }> {
  return api.put(`/smb/users/${encodeURIComponent(username)}`, data).then((res) => res.data)
}

export function deleteSmbUser(username: string): Promise<{ success: boolean }> {
  return api.delete(`/smb/users/${encodeURIComponent(username)}`).then((res) => res.data)
}
