/**
 * file-office-viewer 本插件后端 API 客户端（自包含实现）。
 *
 * 注意：原始文件字节拉取（pdf/docx/xlsx/xls 前端渲染）已改用平台 I/O
 * `ctx.api.fileIO`（/api/files/token + /api/files/stream），本文件只保留
 * 本插件后端的能力：soffice 转换 + 转换产物令牌流。
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
  /** 调用本插件后端转换 Office 文件为 PDF 并换取流令牌 */
  convert(path: string): Promise<ConvertResult>
  /** 本插件后端流 URL（服务转换产物） */
  officeStreamUrl(token: string): string
}

export function createViewerApi(http: ViewerHttp): ViewerApi {
  return {
    async convert(path) {
      const r = await http.post<ConvertResult>('/file-office-viewer/convert', { path })
      return r.data
    },
    officeStreamUrl(token) {
      return `/api/file-office-viewer/stream?token=${encodeURIComponent(token)}`
    },
  }
}