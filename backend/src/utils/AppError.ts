export class AppError extends Error {
  public code?: string
  constructor(message: string, public statusCode: number = 400, code?: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

/** 权限不足、需要用户以 sudo 提权后重试（前端据此弹出提权对话框） */
export class ElevationRequiredError extends AppError {
  constructor(message = '需要提权以继续操作') {
    super(message, 403, 'ELEVATION_REQUIRED')
  }
}
