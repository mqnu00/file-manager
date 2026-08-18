/**
 * file-binary-viewer 对 file-viewer 核心后端的 API 客户端（自包含实现）。
 */

/** 最小 HTTP 客户端结构（ctx.api.instance 的 get/post 形态） */
export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface BytesResult {
  offset: number
  length: number
  size: number
  /** base64 编码的字节数据 */
  data: string
}

export interface ViewerApi {
  readBytes(path: string, offset: number, length: number): Promise<BytesResult>
  writeRange(path: string, offset: number, bytes: Uint8Array): Promise<void>
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function createViewerApi(http: ViewerHttp): ViewerApi {
  return {
    readBytes(path, offset, length) {
      return http
        .get<BytesResult>('/file-viewer/bytes', { params: { path, offset, length } })
        .then((r) => r.data)
    },
    async writeRange(path, offset, bytes) {
      await http.post('/file-viewer/write-range', { path, offset, data: bytesToBase64(bytes) })
    },
  }
}