import api from './index'

export interface SystemInfo {
  /** 当前应用版本，如 "3.0.2" */
  version: string
  /** 项目仓库地址，如 "https://github.com/mqnu00/file-manager" */
  repoUrl: string
}

export interface UpdateCheckResult {
  current: string
  latest: string
  hasUpdate: boolean
  /** 有更新时的 GitHub Release 链接 */
  releaseUrl?: string
}

export function getSystemInfo(): Promise<SystemInfo> {
  return api.get('/system/info').then((res) => res.data)
}

export function checkUpdate(): Promise<UpdateCheckResult> {
  return api.get('/system/check-update').then((res) => res.data)
}
