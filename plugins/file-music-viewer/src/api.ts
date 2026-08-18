/**
 * 对 file-viewer 核心后端的 API 客户端（自包含实现）。
 */

export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface ViewerApi {
  createToken(path: string): Promise<string>
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