/**
 * 文件读取流 → HTTP 响应输出
 *
 * 关键点：Node 的 pipe() 在客户端断开（res 触发 close）时只会 unpipe，
 * 不会 destroy 源 ReadStream。若不显式 destroy，fs.ReadStream 的文件描述符
 * 会一直持有到进程退出；文件此前被删除时，inode 被该 fd 钉住，磁盘块直到
 * 进程退出才归还。
 */
import type { Readable } from 'stream'
import type { Response } from 'express'
import { log } from './logger'

/** 把读流转发到响应，并保证任何中断路径都会释放源流（fd） */
export function pipeStreamToResponse(stream: Readable, res: Response, tag: string): void {
  stream.once('error', (err) => {
    const message = err instanceof Error ? err.message : String(err)
    log('ERROR', tag, `流式读取失败: ${message}`)
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
