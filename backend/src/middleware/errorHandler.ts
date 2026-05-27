import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(`${req.method} ${req.path}:`, err.message)
  res.status(500).json({ message: err.message || '服务器内部错误' })
}