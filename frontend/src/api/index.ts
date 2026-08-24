import axios from 'axios'
import { STORAGE_KEY_SESSION, API_BASE_URL } from '@/constants'
import { setupMockApi } from '@/demo/mockHandlers'
import { requestCredentials } from '@/composables/useElevation'

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
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
    // 权限不足、需要 sudo 提权：弹出对话框收集凭据，成功后以已缓存凭据重放原请求
    if (error.response?.data?.code === 'ELEVATION_REQUIRED' && !error.config?._elevated) {
      try {
        await requestCredentials()
        error.config._elevated = true
        return api(error.config)
      } catch {
        // 用户取消或提权失败 → 以原始错误向外抛出
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
