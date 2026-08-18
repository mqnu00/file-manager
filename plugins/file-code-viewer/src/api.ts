/**
 * file-code-viewer 对 file-viewer 核心后端的 API 客户端（自包含实现）。
 */

export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface ReadResult {
  name: string
  path: string
  size: number
  isText: boolean
  reason?: string
  content?: string | null
}

export interface ViewerApi {
  read(path: string): Promise<ReadResult>
  write(path: string, content: string): Promise<void>
}

export function createViewerApi(http: ViewerHttp): ViewerApi {
  return {
    read(path) {
      return http.get<ReadResult>('/file-viewer/read', { params: { path } }).then((r) => r.data)
    },
    async write(path, content) {
      await http.post('/file-viewer/write', { path, content, encoding: 'utf8' })
    },
  }
}