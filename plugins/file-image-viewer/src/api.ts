/**
 * 对 file-viewer 核心后端的 API 客户端（自包含实现）。
 */

export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface ViewerApi {
  /** 换取 file-viewer 核心流令牌（30 分钟有效） */
  createToken(path: string): Promise<string>
  /** 构造流式图片 URL */
  streamUrl(token: string): string
}

export function createViewerApi(http: ViewerHttp): ViewerApi {
  return {
    async createToken(path) {
      const r = await http.post<{ token: string }>('/file-viewer/token', { path })
      return r.data.token
    },
    streamUrl(token) {
      return `/api/file-viewer/stream?token=${encodeURIComponent(token)}`
    },
  }
}