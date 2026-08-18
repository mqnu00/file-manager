/**
 * file-viewer 核心后端
 *
 * 提供通用文件 I/O 路由，供各子查看插件（code/music/video/office/binary）消费：
 *   - /read + /write        文本/代码 读取与写回（≤8MB）
 *   - /bytes + /write-range 二进制分页读取与定位写入（hex 编辑器）
 *   - /token + /stream      短期流令牌 + Range 流式输出（音频/视频/PDF 预览）
 *
 * 敏感路由挂 ctx.middleware.auth（Bearer header）；/stream 因 <video>/<audio>/<iframe>
 * 无法携带 header，改用一次性令牌鉴权（绑定 safePath 后的绝对路径）。
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import mime from 'mime-types'
import type {
  BackendPluginContext,
  PluginInstallFunction,
  Request,
  Response,
} from '@mqn00/file-manager/plugin'

/** 文本读取/写回大小上限 */
export const TEXT_LIMIT = 8 * 1024 * 1024
/** 单次字节读取上限（hex 分页） */
export const BYTES_LIMIT = 512 * 1024
/** 流令牌有效期 */
export const STREAM_TTL_MS = 30 * 60 * 1000

// ==================== 令牌存储（纯逻辑，可测） ====================

export interface TokenEntry {
  path: string
  expiresAt: number
}

/** 短期流令牌存储：令牌 → 绑定绝对路径 */
export class StreamTokenStore {
  private tokens = new Map<string, TokenEntry>()
  private readonly ttlMs: number

  constructor(ttlMs: number = STREAM_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /** 为指定绝对路径签发令牌 */
  issue(fullPath: string): string {
    const token = crypto.randomBytes(32).toString('base64url')
    this.tokens.set(token, { path: fullPath, expiresAt: Date.now() + this.ttlMs })
    return token
  }

  /** 校验并消费令牌；有效返回绑定路径，否则 null（惰性清理过期项） */
  consume(token: string): string | null {
    const entry = this.tokens.get(token)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(token)
      return null
    }
    return entry.path
  }
}

/** 全局实例（install 时按需创建） */
let streamTokens: StreamTokenStore | null = null
function getTokenStore(): StreamTokenStore {
  if (!streamTokens) streamTokens = new StreamTokenStore()
  return streamTokens
}

// ==================== 纯函数（可测） ====================

/** 解析 Range 头（bytes=start-end），返回 [start, end]（闭区间）；无法解析返回 null */
export function parseRange(rangeHeader: string, size: number): [number, number] | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!m) return null
  const startRaw = m[1]
  const endRaw = m[2]
  if (!startRaw && !endRaw) return null
  // 仅后缀形式 bytes=-N：最后 N 字节
  if (!startRaw) {
    const suffixLen = parseInt(endRaw, 10)
    if (Number.isNaN(suffixLen) || suffixLen <= 0) return null
    const start = Math.max(0, size - suffixLen)
    return [start, size - 1]
  }
  const start = parseInt(startRaw, 10)
  if (Number.isNaN(start)) return null
  const end = endRaw ? parseInt(endRaw, 10) : size - 1
  if (Number.isNaN(end)) return null
  if (start < 0 || start >= size || start > end) return null
  return [start, Math.min(end, size - 1)]
}

/** 文本探测：前 8KB 含 NUL 字节判定为二进制 */
export function isTextBuffer(buf: Buffer): boolean {
  return !buf.subarray(0, 8192).includes(0)
}

/** 从指定偏移读取至多 length 字节（不越界） */
export function readBytes(fullPath: string, offset: number, length: number): { data: Buffer; size: number } {
  const size = fs.statSync(fullPath).size
  if (offset >= size) return { data: Buffer.alloc(0), size }
  const toRead = Math.min(length, size - offset)
  const fd = fs.openSync(fullPath, 'r')
  try {
    const buf = Buffer.alloc(toRead)
    let total = 0
    while (total < toRead) {
      const n = fs.readSync(fd, buf, total, toRead - total, offset + total)
      if (n <= 0) break
      total += n
    }
    return { data: buf.subarray(0, total), size }
  } finally {
    fs.closeSync(fd)
  }
}

/** 在指定偏移写入字节（覆盖式，可扩展文件） */
export function writeRange(fullPath: string, offset: number, data: Buffer): void {
  const fd = fs.openSync(fullPath, 'r+')
  try {
    fs.writeSync(fd, data, 0, data.length, offset)
  } finally {
    fs.closeSync(fd)
  }
}

// ==================== 路由 ====================

function safeResolve(ctx: BackendPluginContext, userPath: string): string {
  return ctx.utils.path.safe(userPath)
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ message })
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()
  const auth = ctx.express.Router()
  auth.use(ctx.middleware.auth)

  // 读取文件文本（≤8MB；二进制/超限返回 isText:false 与原因）
  auth.get('/read', (req: Request, res: Response) => {
    const userPath = req.query.path as string | undefined
    if (!userPath) return sendError(res, 400, '缺少 path 参数')
    let fullPath: string
    try {
      fullPath = safeResolve(ctx, userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      if (!fs.existsSync(fullPath)) return sendError(res, 404, '文件不存在')
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) return sendError(res, 400, '不能打开文件夹')
      const base = { name: path.basename(fullPath), path: userPath, size: stat.size }
      if (stat.size > TEXT_LIMIT) {
        return res.json({ ...base, isText: false, reason: 'too-large', content: null, encoding: null })
      }
      const buf = fs.readFileSync(fullPath)
      if (!isTextBuffer(buf)) {
        return res.json({ ...base, isText: false, reason: 'binary', content: null, encoding: null })
      }
      res.json({ ...base, isText: true, content: buf.toString('utf8'), encoding: 'utf8' })
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `read 失败 ${userPath}: ${e instanceof Error ? e.message : e}`)
      sendError(res, 500, '读取文件失败')
    }
  })

  // 写回文本（≤8MB）
  auth.post('/write', (req: Request, res: Response) => {
    const { path: userPath, content, encoding } = req.body as {
      path?: string
      content?: unknown
      encoding?: string
    }
    if (!userPath || typeof content !== 'string') {
      return sendError(res, 400, '缺少 path 或 content 参数')
    }
    let fullPath: string
    try {
      fullPath = safeResolve(ctx, userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      const buf = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8')
      if (buf.length > TEXT_LIMIT) return sendError(res, 400, '文件内容过大，不允许写回')
      fs.writeFileSync(fullPath, buf)
      ctx.utils.logger.log('INFO', 'file-viewer', `write 成功 ${userPath}`)
      res.json({ success: true })
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `write 失败 ${userPath}: ${e instanceof Error ? e.message : e}`)
      sendError(res, 500, '写入文件失败')
    }
  })

  // 分页读取二进制字节（hex 查看器）
  auth.get('/bytes', (req: Request, res: Response) => {
    const userPath = req.query.path as string | undefined
    const offset = Number(req.query.offset ?? 0)
    const length = Number(req.query.length ?? BYTES_LIMIT)
    if (!userPath) return sendError(res, 400, '缺少 path 参数')
    if (!Number.isInteger(offset) || offset < 0) return sendError(res, 400, 'offset 非法')
    if (!Number.isInteger(length) || length <= 0 || length > BYTES_LIMIT) {
      return sendError(res, 400, `length 非法（1-${BYTES_LIMIT}）`)
    }
    let fullPath: string
    try {
      fullPath = safeResolve(ctx, userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      if (!fs.existsSync(fullPath)) return sendError(res, 404, '文件不存在')
      const { data, size } = readBytes(fullPath, offset, length)
      res.json({ offset, length: data.length, size, data: data.toString('base64') })
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `bytes 失败 ${userPath}: ${e instanceof Error ? e.message : e}`)
      sendError(res, 500, '读取字节失败')
    }
  })

  // 定位写入二进制字节（hex 编辑器保存）
  auth.post('/write-range', (req: Request, res: Response) => {
    const { path: userPath, offset, data } = req.body as {
      path?: string
      offset?: unknown
      data?: unknown
    }
    if (!userPath || typeof data !== 'string') {
      return sendError(res, 400, '缺少 path 或 data 参数')
    }
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      return sendError(res, 400, 'offset 非法')
    }
    let fullPath: string
    try {
      fullPath = safeResolve(ctx, userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      const buf = Buffer.from(data, 'base64')
      if (buf.length === 0) return sendError(res, 400, 'data 为空')
      if (buf.length > BYTES_LIMIT) return sendError(res, 400, '单次写入过大')
      if (!fs.existsSync(fullPath)) return sendError(res, 404, '文件不存在')
      writeRange(fullPath, offset, buf)
      ctx.utils.logger.log('INFO', 'file-viewer', `write-range 成功 ${userPath} @${offset}+${buf.length}`)
      res.json({ success: true })
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `write-range 失败 ${userPath}: ${e instanceof Error ? e.message : e}`)
      sendError(res, 500, '写入失败')
    }
  })

  // 签发流令牌（绑定绝对路径）
  auth.post('/token', (req: Request, res: Response) => {
    const { path: userPath } = req.body as { path?: string }
    if (!userPath) return sendError(res, 400, '缺少 path 参数')
    let fullPath: string
    try {
      fullPath = safeResolve(ctx, userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return sendError(res, 404, '文件不存在')
      }
      const token = getTokenStore().issue(fullPath)
      res.json({ token, expiresIn: STREAM_TTL_MS })
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `token 失败 ${userPath}: ${e instanceof Error ? e.message : e}`)
      sendError(res, 500, '签发令牌失败')
    }
  })

  // 流式输出（公开路由，令牌鉴权；支持 Range）
  router.get('/stream', (req: Request, res: Response) => {
    const token = req.query.token as string | undefined
    if (!token) return sendError(res, 400, '缺少 token 参数')
    const fullPath = getTokenStore().consume(token)
    if (!fullPath) return sendError(res, 403, '令牌无效或已过期')
    try {
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return sendError(res, 404, '文件不存在')
      }
      const stat = fs.statSync(fullPath)
      const mimeType = mime.lookup(fullPath) || 'application/octet-stream'
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`
      )

      const rangeHeader = req.headers.range
      if (rangeHeader) {
        const range = parseRange(rangeHeader, stat.size)
        if (!range) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
          return
        }
        const [start, end] = range
        res.status(206)
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
        res.setHeader('Content-Length', end - start + 1)
        const stream = fs.createReadStream(fullPath, { start, end })
        stream.pipe(res)
        return
      }

      res.setHeader('Content-Length', stat.size)
      fs.createReadStream(fullPath).pipe(res)
    } catch (e) {
      ctx.utils.logger.log('ERROR', 'file-viewer', `stream 失败: ${e instanceof Error ? e.message : e}`)
      if (!res.headersSent) sendError(res, 500, '流式读取失败')
      res.end()
    }
  })

  router.use(auth)
  ctx.app.use('/api/file-viewer', router)
  ctx.utils.logger.log('INFO', 'file-viewer', '核心后端已挂载 /api/file-viewer')
}