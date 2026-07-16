import axios from 'axios'
import { STORAGE_KEY_SESSION, API_BASE_URL } from '@/constants'
import { setupMockApi } from '@/demo/mockHandlers'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Demo 模式：安装 mock API 拦截器（非 demo 模式 Vite 自动 tree-shake）
if (import.meta.env.VITE_DEMO_MODE === 'true') {
  setupMockApi(api)
}

api.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem(STORAGE_KEY_SESSION)
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
    return Promise.reject(error)
  }
)

export default api
