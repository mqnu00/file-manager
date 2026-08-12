/**
 * Hatsune Miku Theme — 后端路由
 *
 * 挂载前缀 /api/hatsune-miku-theme，插件自己提供图片静态资源（不再依赖主项目
 * /plugins-assets）：
 *   - GET  /logo            内置 logo（登录卡片）
 *   - GET  /bg/:file        内置背景图（<rootDir>/assets/bg）
 *   - GET  /custom/:file    用户上传的背景图（~/.file-manager/hatsune-miku-theme）
 *   - GET  /backgrounds     背景列表（内置 + 自定义）
 *   - POST /backgrounds     上传自定义背景（auth，multer）
 *   - DELETE /backgrounds/:file  删除自定义背景（auth）
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'
import type { BackendPluginContext, Request, Response, Router } from '@mqn00/file-manager/plugin'

const API_PREFIX = '/api/hatsune-miku-theme'
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 插件根目录（编译后本文件位于 <rootDir>/dist） */
function getRootDir(): string {
  return path.join(__dirname, '..')
}

/** 内置背景图目录 */
function getBgDir(): string {
  return path.join(getRootDir(), 'assets', 'bg')
}

/** 用户上传背景图数据目录（与主项目生产数据目录 ~/.file-manager 一致，插件重装不丢） */
export function getDataDir(): string {
  return path.join(os.homedir(), '.file-manager', 'hatsune-miku-theme')
}

interface BackgroundInfo {
  id: string
  label: string
  url: string
  builtin: boolean
}

/** 列出目录内的图片文件，按文件名排序 */
function listImages(dir: string): string[] {
  let files: string[] = []
  try {
    files = fs.readdirSync(dir)
  } catch {
    return []
  }
  return files
    .filter((f) => !f.startsWith('.') && IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
}

function listBuiltinBg(): BackgroundInfo[] {
  return listImages(getBgDir()).map((f) => ({
    id: f,
    label: f,
    url: `${API_PREFIX}/bg/${encodeURIComponent(f)}`,
    builtin: true,
  }))
}

function listCustomBg(): BackgroundInfo[] {
  return listImages(getDataDir()).map((f) => ({
    id: f,
    label: f,
    url: `${API_PREFIX}/custom/${encodeURIComponent(f)}`,
    builtin: false,
  }))
}

/** 安全 serve 目录内文件：防路径穿越，文件缺失返回 404 */
function serveFile(root: string, file: string, res: Response): void {
  if (!file || path.basename(file) !== file) {
    res.status(400).json({ error: '非法文件名' })
    return
  }
  const abs = path.resolve(root, file)
  if (!abs.startsWith(root + path.sep)) {
    res.status(400).json({ error: '非法路径' })
    return
  }
  res.sendFile(abs, (err) => {
    if (err) res.status(404).json({ error: '文件不存在' })
  })
}

/** 根据 mimetype 映射安全扩展名（不信任原始文件名）；非图片返回 null */
function extFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return map[mime] ?? null
}

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function createRouter(ctx: BackendPluginContext): Router {
  const router: Router = ctx.express.Router()
  const auth = ctx.middleware.auth

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, getDataDir()),
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${randomHex(6)}${extFromMime(file.mimetype) ?? ''}`)
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (extFromMime(file.mimetype)) cb(null, true)
      else cb(new Error('仅支持图片文件（png/jpg/jpeg/webp/gif）'))
    },
  })

  /** 内置 logo（登录卡片） */
  router.get('/logo', (_req: Request, res: Response) => {
    res.sendFile(path.join(getRootDir(), 'assets', 'logo.png'))
  })

  /** 内置背景图 */
  router.get('/bg/:file', (req: Request, res: Response) => {
    serveFile(getBgDir(), req.params.file as string, res)
  })

  /** 用户上传的背景图 */
  router.get('/custom/:file', (req: Request, res: Response) => {
    serveFile(getDataDir(), req.params.file as string, res)
  })

  /** 背景列表（内置 + 自定义） */
  router.get('/backgrounds', (_req: Request, res: Response) => {
    res.json({ backgrounds: [...listBuiltinBg(), ...listCustomBg()] })
  })

  /** 上传自定义背景（需登录） */
  router.post('/backgrounds', auth, (req: Request, res: Response) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : '上传失败' })
        return
      }
      const file = req.file
      if (!file) {
        res.status(400).json({ error: '缺少文件字段 file' })
        return
      }
      res.json({
        success: true,
        id: file.filename,
        url: `${API_PREFIX}/custom/${encodeURIComponent(file.filename)}`,
      })
    })
  })

  /** 删除自定义背景（需登录；内置背景不可删） */
  router.delete('/backgrounds/:file', auth, (req: Request, res: Response) => {
    const file = req.params.file as string
    if (!file || path.basename(file) !== file) {
      res.status(400).json({ error: '非法文件名' })
      return
    }
    const abs = path.resolve(getDataDir(), file)
    if (!abs.startsWith(getDataDir() + path.sep)) {
      res.status(400).json({ error: '非法路径' })
      return
    }
    try {
      fs.unlinkSync(abs)
      res.json({ success: true })
    } catch {
      res.status(404).json({ error: '文件不存在' })
    }
  })

  return router
}
