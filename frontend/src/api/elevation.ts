import api from './index'

/** 校验并缓存 sudo 提权凭据（限时，见后端 config.yml 的 auth.elevationTtlMinutes） */
export function elevate(
  username: string,
  password: string,
  chownBack: boolean
): Promise<{ success: boolean }> {
  return api.post('/auth/elevate', { username, password, chownBack }).then((res) => res.data)
}

/** 清除已缓存的提权凭据（登出时调用） */
export function clearElevation(): Promise<void> {
  return api.post('/auth/elevate-clear').then(() => undefined)
}
