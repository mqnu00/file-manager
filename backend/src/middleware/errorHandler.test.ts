import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from './errorHandler'
import { AppError } from '../utils/AppError'

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = { statusCode: 0, body: null } as Response & { statusCode: number; body: unknown }
  res.status = ((code: number) => {
    res.statusCode = code
    return res
  }) as unknown as Response['status']
  res.json = ((body: unknown) => {
    res.body = body
    return res
  }) as unknown as Response['json']
  return res
}

const mockReq = { method: 'GET', path: '/api/files' } as Request

describe('errorHandler', () => {
  it('AppError → 按其 statusCode 与 message 返回', () => {
    const res = mockRes()
    errorHandler(new AppError('非法路径'), mockReq, res, vi.fn())
    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ message: '非法路径' })
  })

  it('AppError 自定义 statusCode', () => {
    const res = mockRes()
    errorHandler(new AppError('未授权', 401), mockReq, res, vi.fn())
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ message: '未授权' })
  })

  it('普通 Error → 500 服务器内部错误（不透传内部 message）', () => {
    const res = mockRes()
    errorHandler(new Error('boom: db connection lost'), mockReq, res, vi.fn())
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ message: '服务器内部错误' })
  })
})
