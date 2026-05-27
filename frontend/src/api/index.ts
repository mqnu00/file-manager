import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('session_token')
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('session_token')
    }
    return Promise.reject(error)
  }
)

export default api