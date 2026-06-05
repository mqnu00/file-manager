import api from './index'

export function login(
  token: string
): Promise<{ success: boolean; sessionToken: string; expiresIn: number }> {
  return api.post('/auth/login', { token }).then((res) => res.data)
}

export function logout(): Promise<{ success: boolean }> {
  return api.post('/auth/logout').then((res) => res.data)
}

export function checkAuth(): Promise<{ valid: boolean }> {
  return api.get('/auth/check').then((res) => res.data)
}
