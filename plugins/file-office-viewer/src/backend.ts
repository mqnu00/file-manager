/**
 * file-office-viewer 后端
 *
 * 为无法前端渲染的旧版 Office 格式（.doc/.ppt/.pptx）提供 LibreOffice 转 PDF 预览：
 *   POST /api/file-office-viewer/convert  检测 soffice → 转换 PDF（缓存）→ 返回流令牌
 *   GET  /api/file-office-viewer/stream   公开路由（令牌鉴权，Range 流式）服务转换产物
 *
 * 转换产物缓存于临时目录（键 = sha1(绝对路径+修改时间)），重复打开直接复用。
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { spawn, spawnSync } from 'child_process'
import mime from 'mime-types'
import type {
  BackendPluginContext,
  PluginInstallFunction,
  Request,
  Response,
} from '@mqn00/file-manager/plugin'

/** 需要 soffice 转换的后缀（其余格式前端直接渲染） */
export const CONVERTIBLE_EXTENSIONS = ['.ppt', '.pptx', '.doc']
/** 转换超时 */
export const CONVERT_TIMEOUT_MS = 60_000
/** 缓存根目录 */
export const TMP_ROOT = path.join(os.tmpdir(), 'file-manager-office-viewer')

// ==================== 令牌存储（仅服务转换产物） ====================

class ConvertTokenStore {
  private tokens = new Map<string, { path: string; expiresAt: number }>()
  private readonly ttlMs = 30 * 60 * 1000

  issue(fullPath: string): string {
    const token = crypto.randomBytes(32).toString('base64url')
    this.tokens.set(token, { path: fullPath, expiresAt: Date.now() + this.ttlMs })
    return token
  }

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

const tokenStore = new ConvertTokenStore()

// ==================== soffice 检测与转换 ====================

/** 探测可用的 LibreOffice 命令（soffice / libreoffice） */
export function findSoffice(): string | null {
  for (const cmd of ['soffice', 'libreoffice']) {
    try {
      const r = spawnSync(cmd, ['--version'], { timeout: 5000, stdio: 'pipe' })
      if (r.status === 0) return cmd
    } catch {
      // 命令不存在继续尝试下一个
    }
  }
  return null
}

/** 转换缓存键：内容随 绝对路径+修改时间 失效 */
export function cacheKey(absPath: string): string {
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(absPath).mtimeMs
  } catch {
    // 文件可能已被移动，使用固定键避免抛错
  }
  return crypto.createHash('sha1').update(`${absPath}:${mtimeMs}`).digest('hex').slice(0, 24)
}

/** 执行转换；命中缓存直接返回。返回 pdf 路径或错误信息 */
export async function convertToPdf(
  absPath: string,
  soffice: string
): Promise<{ pdfPath: string } | { error: string }> {
  const key = cacheKey(absPath)
  const cacheDir = path.join(TMP_ROOT, key)
  const outDir = path.join(cacheDir, 'out')
  const pdfPath = path.join(outDir, path.parse(absPath).name + '.pdf')

  if (fs.existsSync(pdfPath)) {
    return { pdfPath }
  }

  fs.mkdirSync(outDir, { recursive: true })
  // 独立 profile 避免并行转换/多次调用时的 LibreOffice 用户目录锁
  const profileDir = path.join(cacheDir, 'lo-profile')
  const userInstall = `file://${profileDir.replace(/\\/g, '/')}`
  const args = [
    '--headless',
    '--norestore',
    '--convert-to',
    'pdf',
    '--outdir',
    outDir,
    `-env:UserInstallation=${userInstall}`,
    absPath,
  ]

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(soffice, args, {
        stdio: 'ignore',
        env: { ...process.env, HOME: os.tmpdir(), USERPROFILE: os.tmpdir() },
      })
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error('转换超时'))
      }, CONVERT_TIMEOUT_MS)
      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`soffice 退出码 ${code}`))
      })
    })
  } catch (e) {
    fs.rmSync(profileDir, { recursive: true, force: true })
    return { error: e instanceof Error ? e.message : '转换失败' }
  }

  fs.rmSync(profileDir, { recursive: true, force: true })

  if (!fs.existsSync(pdfPath)) {
    return { error: '转换完成但未生成 PDF 文件' }
  }
  return { pdfPath }
}

// ==================== 路由 ====================

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ message })
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const router = ctx.express.Router()
  const auth = ctx.express.Router()
  auth.use(ctx.middleware.auth)

  // 转换 Office 文件为 PDF，返回流令牌
  auth.post('/convert', async (req: Request, res: Response) => {
    const { path: userPath } = req.body as { path?: string }
    if (!userPath) return sendError(res, 400, '缺少 path 参数')
    let fullPath: string
    try {
      fullPath = ctx.utils.path.safe(userPath)
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : '非法路径')
    }
    try {
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return sendError(res, 404, '文件不存在')
      }
      const ext = path.extname(fullPath).toLowerCase()
      if (!CONVERTIBLE_EXTENSIONS.includes(ext)) {
        return res.json({ ok: false, reason: `不支持的预览格式 ${ext}` })
      }
      const soffice = findSoffice()
      if (!soffice) {
        return res.json({
          ok: false,
          reason: '服务器未安装 LibreOffice(soffice)，无法预览该格式，请下载后本地打开',
        })
      }
      const result = await convertToPdf(fullPath, soffice)
      if ('error' in result) {
        return res.json({ ok: false, reason: `转换失败: ${result.error}` })
      }
      const token = tokenStore.issue(result.pdfPath)
      ctx.utils.logger.log('INFO', 'file-office-viewer', `convert 成功 ${userPath} → ${result.pdfPath}`)
      res.json({ ok: true, token, fileName: path.basename(result.pdfPath) })
    } catch (e) {
      ctx.utils.logger.log(
        'ERROR',
        'file-office-viewer',
        `convert 失败 ${userPath}: ${e instanceof Error ? e.message : e}`
      )
      sendError(res, 500, '转换失败')
    }
  })

  // 流式输出转换产物（公开路由，令牌鉴权；支持 Range）
  router.get('/stream', (req: Request, res: Response) => {
    const token = req.query.token as string | undefined
    if (!token) return sendError(res, 400, '缺少 token 参数')
    const fullPath = tokenStore.consume(token)
    if (!fullPath) return sendError(res, 403, '令牌无效或已过期')
    try {
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return sendError(res, 404, '文件不存在')
      }
      const stat = fs.statSync(fullPath)
      res.setHeader('Content-Type', mime.lookup(fullPath) || 'application/octet-stream')
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`
      )

      const rangeHeader = req.headers.range
      if (rangeHeader) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
        if (!m) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
          return
        }
        let start = m[1] ? parseInt(m[1], 10) : 0
        let end = m[2] ? parseInt(m[2], 10) : stat.size - 1
        if (Number.isNaN(start)) start = 0
        if (Number.isNaN(end)) end = stat.size - 1
        if (start < 0 || start >= stat.size || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
          return
        }
        end = Math.min(end, stat.size - 1)
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
      ctx.utils.logger.log(
        'ERROR',
        'file-office-viewer',
        `stream 失败: ${e instanceof Error ? e.message : e}`
      )
      if (!res.headersSent) sendError(res, 500, '流式读取失败')
      res.end()
    }
  })

  router.use(auth)
  ctx.app.use('/api/file-office-viewer', router)
  ctx.utils.logger.log('INFO', 'file-office-viewer', '后端已挂载 /api/file-office-viewer')

  // 向 file-viewer 核心报备能力（经 registerService）
  ctx.getService('file-viewer:viewers').registerViewer({
    id: 'office',
    label: '办公文档查看器',
    defaultExtensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'],
    route: '/plugin/office/view',
  })

  // 托管服务：生命周期信号（file-viewer 卸载时平台级联停/卸本插件）
  ctx.manageService('office-viewer', {
    canAutoStart: async () => true,
    dependsOn: ['viewers'],
    start: async () => {},
    stop: async () => {},
    isRunning: async () => true,
  })
  ctx.startService('office-viewer')
}