/**
 * 通用文件 I/O API（平台能力，由 file-viewer 插件后端上收）
 *
 * 供查看器类插件使用：read/write 给代码编辑器，bytes/write-range 给 hex
 * 编辑器，token/stream 给音频/视频/PDF 预览。HTTP 层复用默认 axios 实例
 * （已配置认证拦截器）。
 */

import api from './index'

export interface ReadResult {
  name: string
  path: string
  size: number
  isText: boolean
  reason?: 'too-large' | 'binary'
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

/** 读取文本内容（≤8MB；二进制/超限时 isText=false 并带 reason） */
export const read = (path: string): Promise<ReadResult> =>
  api.get('/files/read', { params: { path } }).then((r) => r.data)

/** 写回文本内容 */
export const write = async (path: string, content: string, encoding = 'utf8'): Promise<void> => {
  await api.post('/files/write', { path, content, encoding })
}

/** 分页读取二进制字节（offset/length） */
export const readBytes = (path: string, offset: number, length: number): Promise<BytesResult> =>
  api.get('/files/bytes', { params: { path, offset, length } }).then((r) => r.data)

/** 在指定偏移写入字节 */
export const writeRange = async (path: string, offset: number, bytes: Uint8Array): Promise<void> => {
  await api.post('/files/write-range', { path, offset, data: bytesToBase64(bytes) })
}

/** 签发流令牌（有效期内可多次使用） */
export const createToken = async (path: string): Promise<string> => {
  const r = await api.post<{ token: string }>('/files/token', { path })
  return r.data.token
}

/** 构造流式 URL（需携带令牌） */
export const streamUrl = (token: string): string =>
  `/api/files/stream?token=${encodeURIComponent(token)}`

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

export default api