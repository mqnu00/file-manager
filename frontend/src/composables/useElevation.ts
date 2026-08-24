import { ref } from 'vue'

export interface ElevationCredentials {
  username: string
  password: string
  chownBack: boolean
}

interface Pending {
  resolve: (creds: ElevationCredentials) => void
  reject: () => void
}

/**
 * 提权对话框的全局单例状态。
 * 对话框组件与 axios 响应拦截器共享同一份状态：拦截器在收到 ELEVATION_REQUIRED
 * 时调用 requestCredentials() 打开对话框；对话框在校验凭据成功后调用 resolveSuccess()
 * 交付凭据（拦截器随后以已缓存凭据重放原请求），取消时调用 cancel()。
 */
const visible = ref(false)
const error = ref<string | null>(null)
const username = ref('')
const chownBack = ref(true)
let pending: Pending | null = null

/** 打开对话框并返回 Promise；校验成功后 resolve，取消时 reject */
export function requestCredentials(presetUsername = ''): Promise<ElevationCredentials> {
  username.value = presetUsername
  chownBack.value = true
  error.value = null
  visible.value = true
  return new Promise<ElevationCredentials>((resolve, reject) => {
    pending = { resolve, reject }
  })
}

/** 提权成功（对话框已完成校验）时调用：关闭对话框并交付凭据 */
export function resolveSuccess(u: string, p: string, back: boolean): void {
  visible.value = false
  pending?.resolve({ username: u, password: p, chownBack: back })
  pending = null
}

/** 用户取消时调用 */
export function cancel(): void {
  visible.value = false
  error.value = null
  pending?.reject()
  pending = null
}

export function useElevation() {
  return { visible, error, username, chownBack, requestCredentials, resolveSuccess, cancel }
}
