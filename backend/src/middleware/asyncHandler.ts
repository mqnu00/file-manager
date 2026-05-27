import { Request, Response, NextFunction } from 'express'

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res, next)
    } catch (e) {
      next(e)
    }
  }
}