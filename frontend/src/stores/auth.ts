import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, logout as apiLogout, checkAuth } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const initialized = ref(false)
  const sessionToken = ref<string | null>(localStorage.getItem('session_token'))
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
        localStorage.removeItem('session_token')
      }
    } catch {
      sessionToken.value = null
      localStorage.removeItem('session_token')
    }
    initialized.value = true
  }

  async function login(token: string): Promise<boolean> {
    loginError.value = null
    try {
      const res = await apiLogin(token)
      sessionToken.value = res.sessionToken
      localStorage.setItem('session_token', res.sessionToken)
      return true
    } catch (e: any) {
      loginError.value = e.response?.data?.error || '登录失败'
      return false
    }
  }

  async function logoutAction() {
    try {
      await apiLogout()
    } catch {
      // ignore logout errors
    }
    sessionToken.value = null
    localStorage.removeItem('session_token')
    window.location.href = '/login'
  }

  function clearSession() {
    sessionToken.value = null
    localStorage.removeItem('session_token')
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