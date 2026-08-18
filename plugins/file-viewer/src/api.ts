/**
 * file-viewer 核心后端的前端 API 客户端
 *
 * 由查看页与子插件查看组件共用：read/write 供代码编辑器，
 * bytes/write-range 供 hex 编辑器，token/stream 供音视频/PDF。
 * HTTP 层使用 ctx.api.instance（已配置认证拦截器）。
 */

/** 最小 HTTP 客户端结构（兼容 axios 实例的 get/post 形态） */
export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  post<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

export interface ReadResult {
  name: string
  path: string
  size: number
  isText: boolean
  reason?: string // 'too-large' | 'binary'
  content?: string | null
  encoding?: string | null
}

export interface BytesResult {
  offset: number
  length: number
  size: number
  /** base64 编码的字节数据 */
  data: string
}

export interface ViewerApi {
  /** 读取文本内容（≤8MB；二进制/超限时 isText=false 并带 reason） */
  read(path: string): Promise<ReadResult>
  /** 写回文本内容 */
  write(path: string, content: string, encoding?: string): Promise<void>
  /** 分页读取二进制字节（offset/length） */
  readBytes(path: string, offset: number, length: number): Promise<BytesResult>
  /** 在指定偏移写入字节 */
  writeRange(path: string, offset: number, bytes: Uint8Array): Promise<void>
  /** 签发流令牌（有效期内可多次使用） */
  createToken(path: string): Promise<string>
  /** 构造流式 URL（需携带令牌） */
  streamUrl(token: string): string
}

/** 将 base64 解码为 Uint8Array（兼容大块数据分批处理） */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** 将 Uint8Array 编码为 base64 */
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
    read(path) {
      return http.get<ReadResult>('/file-viewer/read', { params: { path } }).then((r) => r.data)
    },
    async write(path, content, encoding = 'utf8') {
      await http.post('/file-viewer/write', { path, content, encoding })
    },
    readBytes(path, offset, length) {
      return http
        .get<BytesResult>('/file-viewer/bytes', { params: { path, offset, length } })
        .then((r) => r.data)
    },
    async writeRange(path, offset, bytes) {
      await http.post('/file-viewer/write-range', { path, offset, data: bytesToBase64(bytes) })
    },
    async createToken(path) {
      const r = await http.post<{ token: string }>('/file-viewer/token', { path })
      return r.data.token
    },
    streamUrl(token) {
      return `/api/file-viewer/stream?token=${encodeURIComponent(token)}`
    },
  }
}