/**
 * 文件读取流 → HTTP 响应输出（插件内自包含实现）
 *
 * 与主项目 backend/src/utils/streamResponse.ts 同源：Node 的 pipe() 在客户端
 * 断开（res 触发 close）时只会 unpipe，不会 destroy 源 ReadStream，fd 会
 * 一直持有到进程退出；文件被删除时 inode 被钉住，块直到进程退出才归还。
 */
import type { Readable } from 'stream'
import type { Response } from '@mqn00/file-manager/plugin'

/** 把读流转发到响应；onError 只负责记录日志，响应兜底在本函数内完成 */
export function pipeStreamToResponse(
  stream: Readable,
  res: Response,
  onError: (message: string) => void
): void {
  stream.once('error', (err) => {
    const message = err instanceof Error ? err.message : String(err)
    onError(message)
    stream.destroy()
    if (!res.headersSent) {
      // 已设置的 Content-Length/Content-Range 与 500 响应冲突，先摘掉
      res.removeHeader('Content-Length')
      res.removeHeader('Content-Range')
      res.status(500).json({ message: '流式读取失败' })
    } else if (!res.writableEnded) {
      res.destroy()
    }
  })
  // close 在正常结束与客户端中止时都会触发；对已结束的流 destroy 是幂等的
  res.once('close', () => {
    if (!stream.destroyed) stream.destroy()
  })
  stream.pipe(res)
}
