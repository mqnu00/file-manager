/**
 * 通用文件 I/O API（平台能力，由 file-viewer 插件后端上收）
 *
 * 平台只做二进制透传：read 返回原始字节（base64 传输）、write 接收原始字节，
 * 不做文本/二进制/大小判断——区分文本还是二进制、是否超限、如何解码，
 * 均由消费方查看器插件自行解决。token/stream 供无法携带 Bearer header
 * 的 <video>/<audio>/<iframe> 场景使用。
 */

import api from './index'

export interface FileIOReadResult {
  /** 本次返回的起始偏移 */
  offset: number
  /** 实际返回字节数（≤ 8MB） */
  length: number
  /** 文件总大小（应用据此自行判断"太大"） */
  size: number
  /** base64 编码的原始字节 */
  data: string
}

/** 读取文件二进制。省略 offset/length = 整文件读取（截断到 8MB，size 返回真实大小）；传 offset/length = 分页读取 */
export const read = (path: string, offset?: number, length?: number): Promise<FileIOReadResult> =>
  api
    .get('/files/read', {
      params: {
        path,
        ...(offset !== undefined && { offset }),
        ...(length !== undefined && { length }),
      },
    })
    .then((r) => r.data)

/** 写回文件二进制。省略 offset = 整文件覆盖（允许空内容清空文件）；传 offset = 定位写入 */
export const write = async (path: string, data: Uint8Array, offset?: number): Promise<void> => {
  await api.post('/files/write', {
    path,
    data: bytesToBase64(data),
    ...(offset !== undefined && { offset }),
  })
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