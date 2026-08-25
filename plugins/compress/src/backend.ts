/**
 * 压缩插件后端入口
 *
 * 注册路由（均需登录）：
 * - POST /api/plugin/compress/check ：压缩前预检（源读取权限 + 输出目录写入权限 + 目录包含防护）
 * - POST /api/plugin/compress/zip   ：创建压缩后台任务（推入主项目任务系统，返回 taskId；
 *                                      进度/取消/完成由主项目 /api/tasks 系列端点承载）
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
  paths?: unknown
  outputDir?: unknown
}

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  const service = createCompressService({
    safePath: ctx.utils.path.safe,
    getStorageRoot: ctx.utils.path.getStorageRoot,
    log: (level, tag, message) => ctx.utils.logger.log(level, tag, message),
  })

  const toStrArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []
  const toStr = (v: unknown): string => (typeof v === 'string' ? v : '')

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

  // ---- 创建压缩后台任务 ----
  router.post(
    '/zip',
    ctx.middleware.auth,
    async (req: Request, res: Response): Promise<void> => {
      const { paths, outputDir } = (req.body ?? {}) as ZipBody
      const pathsArr = toStrArray(paths)
      const output = toStr(outputDir)

      if (!output) {
        res.status(400).json({ message: '缺少输出文件夹' })
        return
      }
      if (!pathsArr.length) {
        res.status(400).json({ message: '未选择任何文件/文件夹' })
        return
      }

      try {
        // 预计算输出 zip 目标（与 runJob 内部幂等一致：命名只依赖首项名称与数量）
        const sources = pathsArr.map((p) => service.resolveSource(p))
        const target = service.computeTarget(sources, output)

        // 任务条目注册进主项目任务系统（冲突检测失败抛 TASK_CONFLICT）
        const task = ctx.services.task.createExternal(
          'compress',
          {
            paths: pathsArr,
            names: sources.map((s) => s.name),
            outputDir: output,
            targetPath: target.relativePath,
          },
          { phase: 'compress', totalCount: pathsArr.length }
        )

        // 异步执行压缩，进度/终态经任务系统广播（不阻塞创建响应）
        const signal = ctx.services.task.signal(task.id)
        void (async () => {
          try {
            const result = await service.runJob({
              paths: pathsArr,
              outputDir: output,
              signal,
              onProgress: (percent, _processedBytes, totalBytes) => {
                ctx.services.task.updateProgress(task.id, {
                  progress: percent,
                  totalSize: totalBytes,
                })
              },
            })
            // 完成：回写最终目标路径后收尾
            ctx.services.task.updateProgress(task.id, {
              progress: 100,
              metadata: { ...task.metadata, targetPath: result.target.relativePath },
            })
            ctx.services.task.finalize(task.id, 'completed')
          } catch (e: any) {
            if (e?.message === 'CANCELLED') {
              ctx.services.task.finalize(task.id, 'cancelled', { message: '压缩已取消' })
            } else {
              const msg =
                e instanceof ZCompressError ? e.message : `压缩失败: ${e?.message || '未知错误'}`
              ctx.utils.logger.log('ERROR', 'compress', `压缩任务失败: ${msg}`)
              ctx.services.task.finalize(task.id, 'failed', { error: msg })
            }
          }
        })()

        res.json({ taskId: task.id })
      } catch (e: any) {
        if (e?.code === 'TASK_CONFLICT') {
          res.status(409).json({ message: e.message })
          return
        }
        ctx.utils.logger.log('ERROR', 'compress', `创建压缩任务失败: ${e?.message || '未知错误'}`)
        res.status(400).json({ message: e?.message || '创建压缩任务失败' })
      }
    }
  )

  ctx.app.use('/api/plugin/compress', router)
}