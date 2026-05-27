import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, logout as apiLogout, checkAuth } from '@/api/auth'
import { STORAGE_KEY_SESSION } from '@/constants'

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false)
  const sessionToken = ref<string | null>(localStorage.getItem(STORAGE_KEY_SESSION))
  const loginError = ref<string | null>(null)

  const isAuthenticated = computed(() => !!sessionToken.value)

  async function init() {
    if (!sessionToken.value) {
      initialized.value = true
      return
    }
    try {
      const res = await checkAuth()
      if (!res.valid) {
        sessionToken.value = null
        localStorage.removeItem(STORAGE_KEY_SESSION)
      }
    } catch {
      sessionToken.value = null
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
    initialized.value = true
  }

  async function login(token: string): Promise<boolean> {
    loginError.value = null
    try {
      const res = await apiLogin(token)
      sessionToken.value = res.sessionToken
      localStorage.setItem(STORAGE_KEY_SESSION, res.sessionToken)
      return true
    } catch (e: any) {
      const error = e.response?.data?.error || '登录失败'
      const remaining = e.response?.data?.remaining
      loginError.value = remaining !== undefined ? `${error}（剩余 ${remaining} 次尝试）` : error
      return false
    }
  }

  async function logoutAction() {
    try {
      await apiLogout()
    } catch (e) {
      console.debug('登出请求失败（已忽略）:', e)
    }
    sessionToken.value = null
    localStorage.removeItem(STORAGE_KEY_SESSION)
    window.location.href = '/login'
  }

  function clearSession() {
    sessionToken.value = null
    localStorage.removeItem(STORAGE_KEY_SESSION)
  }

  return {
    initialized,
    sessionToken,
    loginError,
    isAuthenticated,
    init,
    login,
    logout: logoutAction,
    clearSession
  }
})