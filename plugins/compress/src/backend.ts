/**
 * 压缩插件后端入口
 *
 * 注册路由（均需登录）：
 * - POST /api/plugin/compress/check  ：压缩前预检（源读取权限 + 输出目录写入权限 + 目录包含防护）
 * - POST /api/plugin/compress/zip    ：SSE 压缩（多源，固定输出目录，进度/完成/错误/取消事件）
 * - POST /api/plugin/compress/cancel ：按 jobId 取消进行中的压缩
 */
import type {
  BackendPluginContext,
  PluginInstallFunction,
  Request,
  Response,
} from '@mqn00/file-manager/plugin'
import { createCompressService, ZCompressError } from './compress.js'

interface CheckBody {
  paths?: unknown
  outputDir?: unknown
}

interface ZipBody {
  jobId?: unknown
  paths?: unknown
  outputDir?: unknown
}

interface CancelBody {
  jobId?: unknown
}

/** 进行中的压缩任务 */
interface ActiveJob {
  abort: () => void
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const service = createCompressService({
    safePath: ctx.utils.path.safe,
    getStorageRoot: ctx.utils.path.getStorageRoot,
    log: (level, tag, message) => ctx.utils.logger.log(level, tag, message),
  })

  const activeJobs = new Map<string, ActiveJob>()

  const toStrArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []
  const toStr = (v: unknown): string => (typeof v === 'string' ? v : '')

  const assertJobId = (jobId: string): void => {
    if (!jobId) throw new ZCompressError('缺少任务标识 jobId')
  }

  const router = ctx.express.Router()

  // ---- 权限预检 ----
  router.post(
    '/check',
    ctx.middleware.auth,
    async (req: Request, res: Response): Promise<void> => {
      const { paths, outputDir } = (req.body ?? {}) as CheckBody
      try {
        if (!outputDir) {
          res.status(400).json({ message: '缺少输出文件夹' })
          return
        }
        const result = await service.checkPermissions(toStrArray(paths), toStr(outputDir))
        res.json(result)
      } catch (e: any) {
        ctx.utils.logger.log('ERROR', 'compress', `权限预检失败: ${e?.message || '未知错误'}`)
        res.status(400).json({ message: e?.message || '权限预检失败' })
      }
    }
  )

  // ---- 压缩（SSE） ----
  router.post(
    '/zip',
    ctx.middleware.auth,
    async (req: Request, res: Response): Promise<void> => {
      const { jobId, paths, outputDir } = (req.body ?? {}) as ZipBody
      const id = toStr(jobId)
      ctx.utils.sse.setHeaders(res)

      const cleanupJob = (): void => {
        activeJobs.delete(id)
      }

      try {
        assertJobId(id)
        const pathsArr = toStrArray(paths)
        const output = toStr(outputDir)
        if (!output) {
          ctx.utils.sse.sendError(res, '缺少输出文件夹')
          ctx.utils.sse.end(res)
          return
        }

        let abort: (() => void) | null = null
        const abortController = new AbortController()
        abort = () => {
          if (!abortController.signal.aborted) abortController.abort()
        }

        if (activeJobs.has(id)) {
          throw new ZCompressError('压缩任务已存在，请更换 jobId 后重试')
        }

        // 取消：abort 流 + 清 active 表；压缩侧清理半成品
        const jobEntry: ActiveJob = { abort }
        activeJobs.set(id, jobEntry)
        // 客户端断开（刷新/关闭页面）：中止压缩并清理
        res.on('close', () => {
          abort()
          cleanupJob()
        })

        const target = await service.runJob({
          paths: pathsArr,
          outputDir: output,
          signal: abortController.signal,
          onProgress: (percent, _processed, _total) => {
            ctx.utils.sse.sendProgress(res, percent, 0, _total)
          },
        })

        ctx.utils.sse.sendComplete(res, target.target.relativePath)
        ctx.utils.sse.end(res)
        cleanupJob()
      } catch (e: any) {
        if (e?.message === 'CANCELLED') {
          ctx.utils.sse.sendMessage(res, { type: 'cancelled', message: '压缩已取消' })
        } else {
          const msg = e instanceof ZCompressError ? e.message : `压缩失败: ${e?.message || '未知错误'}`
          ctx.utils.logger.log('ERROR', 'compress', `压缩任务失败: ${msg}`)
          ctx.utils.sse.sendError(res, msg)
        }
        ctx.utils.sse.end(res)
        cleanupJob()
      }
    }
  )

  // ---- 取消 ----
  router.post(
    '/cancel',
    ctx.middleware.auth,
    (req: Request, res: Response): void => {
      const { jobId } = (req.body ?? {}) as CancelBody
      const id = toStr(jobId)
      try {
        assertJobId(id)
      } catch (e: any) {
        res.status(400).json({ message: e.message })
        return
      }
      const job = activeJobs.get(id)
      if (!job) {
        res.status(404).json({ message: '未找到正在进行的压缩任务' })
        return
      }
      job.abort()
      activeJobs.delete(id)
      res.json({ success: true })
    }
  )

  ctx.app.use('/api/plugin/compress', router)
}