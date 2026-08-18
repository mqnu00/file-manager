export const STORAGE_KEY_SESSION = 'session_token'
export const STORAGE_KEY_THEME = 'file-manager-theme'
/** 主页当前目录路径的临时记忆（sessionStorage + 用后即焚）：离开主页时写入，返回主页时消费；刷新不残留 → 始终从根目录开始 */
export const STORAGE_KEY_FILE_PATH = 'file-manager-current-path'
export const THEME_CLASS_CYBER = 'cyber'
export const THEME_VALUE_CYBER = 'cyber'
export const THEME_VALUE_LIGHT = 'light'
export const API_BASE_URL = '/api'
