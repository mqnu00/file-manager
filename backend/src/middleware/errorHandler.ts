import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError'
import { log } from '../utils/logger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  log('ERROR', 'other', `${req.method} ${req.path}: ${err.message}`)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message })
  } else {
    res.status(500).json({ message: '服务器内部错误' })
  }
}
