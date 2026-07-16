import { Response } from 'express'
import type { SSEProgressMessage } from '../types'

/**
 * 设置 SSE 响应头
 */
export const setSSEHeaders = (res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
}

/**
 * 发送 SSE 消息（接受任意可被 JSON.stringify 的对象）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendSSEMessage = (res: Response, message: any): void => {
  res.write(`data: ${JSON.stringify(message)}\n\n`)
}

/**
 * 发送 SSE 进度更新
 */
export const sendSSEProgress = (res: Response, progress: number, speed?: number, totalSize?: number): void => {
  sendSSEMessage(res, { type: 'progress', progress, speed, totalSize })
}

/**
 * 发送 SSE 完成消息
 */
export const sendSSEComplete = (res: Response, zipPath?: string): void => {
  sendSSEMessage(res, { type: 'complete', zipPath })
}

/**
 * 发送 SSE 错误消息
 */
export const sendSSEError = (res: Response, message: string): void => {
  sendSSEMessage(res, { type: 'error', message })
}

/**
 * 结束 SSE 响应
 */
export const endSSE = (res: Response): void => {
  res.end()
}
