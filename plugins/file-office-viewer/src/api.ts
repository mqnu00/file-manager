/**
 * file-office-viewer 前后端 API 客户端（自包含实现）。
 */

export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface ConvertResult {
  ok: boolean
  token?: string
  fileName?: string
  reason?: string
}

export interface ViewerApi {
  /** 换取 file-viewer 核心流令牌（服务存储根内的原始文件） */
  createCoreToken(path: string): Promise<string>
  /** file-viewer 核心流 URL */
  coreStreamUrl(token: string): string
  /** 调用本插件后端转换 Office 文件为 PDF 并换取流令牌 */
  convert(path: string): Promise<ConvertResult>
  /** 本插件后端流 URL（服务转换产物） */
  officeStreamUrl(token: string): string
}

export function createViewerApi(http: ViewerHttp): ViewerApi {
  return {
    async createCoreToken(path) {
      const r = await http.post<{ token: string }>('/file-viewer/token', { path })
      return r.data.token
    },
    coreStreamUrl(token) {
      return `/api/file-viewer/stream?token=${encodeURIComponent(token)}`
    },
    async convert(path) {
      const r = await http.post<ConvertResult>('/file-office-viewer/convert', { path })
      return r.data
    },
    officeStreamUrl(token) {
      return `/api/file-office-viewer/stream?token=${encodeURIComponent(token)}`
    },
  }
}