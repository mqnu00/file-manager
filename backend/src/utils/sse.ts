import { Response } from 'express'
import type { SSEProgressMessage } from '../types'

/**
 * 设置 SSE 响应头
 */
export const setSSEHeaders = (res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
}

/**
 * 发送 SSE 进度消息
 */
export const sendSSEMessage = (res: Response, message: SSEProgressMessage): void => {
  res.write(`data: ${JSON.stringify(message)}\n\n`)
}

/**
 * 发送 SSE 进度更新
 */
export const sendSSEProgress = (res: Response, progress: number, speed?: number): void => {
  sendSSEMessage(res, { type: 'progress', progress, speed })
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
