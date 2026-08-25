/**
 * 压缩插件后端服务
 *
 * 多源（文件 + 文件夹）压缩为单个 zip：
 * - `computeTarget`：确定输出 zip 路径（命名 + 冲突自动加 (n) 后缀）
 * - `checkPermissions`：压缩前预检（源读取权限 R_OK、输出目录写入权限 W_OK）
 * - `collectEntries`：收集全部待压缩条目并汇总字节数
 * - `createArchive`：以 archiver 流式压缩（支持 AbortSignal 取消，取消/失败清理半成品）
 *
 * 路径解析依赖注入（来自主应用 ctx.utils.path.safe / getStorageRoot），
 * 单测可通过假 ctx（临时 storageRoot）直接构造服务。
 */
import { promises as fsPromises, createWriteStream, existsSync, unlinkSync } from 'fs'
import path from 'path'
import archiver from 'archiver'

export interface ServiceDeps {
  /** 安全路径解析：相对路径 → 存储根内的绝对路径（越界抛错） */
  safePath(userPath: string): string
  /** 存储根绝对路径 */
  getStorageRoot(): string
  /** 日志 */
  log(level: 'INFO' | 'WARNING' | 'ERROR', tag: string, message: string): void
}

export interface SourceItem {
  /** 相对路径（用户输入） */
  path: string
  /** 存取根内的绝对路径 */
  fullPath: string
  name: string
  kind: 'file' | 'dir'
}

export interface SourceCheck {
  path: string
  name: string
  kind: 'file' | 'dir'
  exists: boolean
  readable: boolean
  error?: string
}

export interface OutputCheck {
  path: string
  exists: boolean
  isDir: boolean
  writable: boolean
  error?: string
}

export interface CheckResult {
  ok: boolean
  items: SourceCheck[]
  output: OutputCheck
  /** 计划生成的 zip 相对路径（冲突已考虑后缀），输出目录非法时为空 */
  targetPath: string
  /** 输出目录是否落在某个选中文件夹内部（禁止） */
  forbidden: boolean
  forbiddenMessage?: string
}

export interface ZipEntry {
  filePath: string
  zipName: string
  size: number
}

export interface TargetInfo {
  fullPath: string
  relativePath: string
}

const VALID_LEVELS = ['INFO', 'WARNING', 'ERROR'] as const
type LogLevel = (typeof VALID_LEVELS)[number]

function isLogLevel(v: unknown): v is LogLevel {
  return typeof v === 'string' && (VALID_LEVELS as readonly string[]).includes(v)
}

export function createCompressService(deps: ServiceDeps) {
  const { safePath, getStorageRoot, log } = deps

  const logSafe = (level: LogLevel, tag: string, message: string): void => {
    try {
      log(level, tag, message)
    } catch {
      // 日志失败不影响主流程
    }
  }

  /** 解析用户相对路径为绝对路径（越界/非法抛 AppError） */
  function resolveSource(userPath: string): SourceItem {
    const fullPath = safePath(userPath)
    const name = path.basename(userPath) || userPath
    return { path: userPath, fullPath, name, kind: 'file' }
  }

  /** 相对路径转 zip 文件名（单项 / 多项目命名规则） */
  function targetBaseName(sources: SourceItem[]): string {
    const firstName = sources[0].name
    if (sources.length === 1) return `${firstName}.zip`
    return `${firstName} 等 ${sources.length} 项.zip`
  }

  /**
   * 计算输出 zip 目标路径：outputDir/<name>.zip；
   * 已存在时依次尝试 `name (1).zip`、`name (2).zip`… 避免覆盖。
   */
  function computeTarget(sources: SourceItem[], outputDirUserPath: string): TargetInfo {
    const outputDirFull = safePath(outputDirUserPath)
    const base = targetBaseName(sources)
    let candidate = path.join(outputDirFull, base)
    let n = 1
    while (existsSync(candidate)) {
      const stem = base.replace(/\.zip$/, '')
      candidate = path.join(outputDirFull, `${stem} (${n}).zip`)
      n += 1
    }
    const relativePath = path.relative(getStorageRoot(), candidate).replace(/\\/g, '/')
    return { fullPath: candidate, relativePath }
  }

  /** 输出目录是否等于或位于某个选中文件夹内部（禁止项） */
  function isForbiddenOutput(sources: SourceItem[], outputDirFull: string): string | null {
    for (const s of sources) {
      if (s.kind !== 'dir') continue
      if (outputDirFull === s.fullPath || outputDirFull.startsWith(s.fullPath + path.sep)) {
        return `输出目录不能位于待压缩文件夹「${s.name}」内部`
      }
    }
    return null
  }

  /**
   * 压缩前权限预检：逐项读取权限 + 输出目录写入权限 + 目录包含防护。
   */
  async function checkPermissions(
    paths: string[],
    outputDir: string
  ): Promise<CheckResult> {
    const items: SourceCheck[] = []
    let sources: SourceItem[] = []
    for (const p of paths) {
      const src = resolveSource(p)
      try {
        const st = await fsPromises.lstat(src.fullPath)
        src.kind = st.isDirectory() ? 'dir' : 'file'
      } catch (e: any) {
        items.push({
          path: p,
          name: src.name,
          kind: 'file',
          exists: false,
          readable: false,
          error: e?.message || '不存在或无访问权限',
        })
        continue
      }
      let readable = false
      let error: string | undefined
      try {
        await fsPromises.access(src.fullPath, fsPromises.constants.R_OK)
        readable = true
      } catch (e: any) {
        error = e?.message || '无读取权限'
      }
      sources.push(src)
      items.push({ path: p, name: src.name, kind: src.kind, exists: true, readable, error })
    }

    let output: OutputCheck = { path: outputDir, exists: false, isDir: false, writable: false }
    let forbidden: string | null = null
    try {
      const st = await fsPromises.stat(safePath(outputDir))
      output = { path: outputDir, exists: true, isDir: st.isDirectory(), writable: false }
      if (!st.isDirectory()) {
        output.error = '输出位置不是文件夹'
      } else {
        try {
          await fsPromises.access(safePath(outputDir), fsPromises.constants.W_OK)
          output.writable = true
        } catch (e: any) {
          output.error = e?.message || '无写入权限'
        }
        forbidden = isForbiddenOutput(sources, safePath(outputDir))
      }
    } catch (e: any) {
      output.error = e?.message || '输出文件夹不存在或无访问权限'
    }

    const targetPath =
      items.every((i) => i.readable) && output.exists && output.isDir && output.writable && !forbidden
        ? computeTarget(sources, outputDir).relativePath
        : ''

    return {
      ok:
        items.every((i) => i.readable) &&
        output.exists &&
        output.isDir &&
        output.writable &&
        !forbidden,
      items,
      output,
      targetPath,
      forbidden: !!forbidden,
      forbiddenMessage: forbidden ?? undefined,
    }
  }

  /**
   * 收集全部待压缩条目（文件直接一项；文件夹递归，zipName = 文件夹名/…）。
   * 不可读文件跳过（readdir 阶段已有 R_OK 预检，这里是兜底）。
   */
  async function collectEntries(sources: SourceItem[]): Promise<{ entries: ZipEntry[]; totalBytes: number }> {
    const entries: ZipEntry[] = []
    let totalBytes = 0

    const walk = async (dirFull: string, zipPrefix: string): Promise<void> => {
      let names: string[]
      try {
        names = await fsPromises.readdir(dirFull)
      } catch {
        return
      }
      for (const name of names) {
        const childFull = path.join(dirFull, name)
        const zipName = `${zipPrefix}/${name}`
        try {
          const st = await fsPromises.lstat(childFull)
          if (st.isDirectory()) {
            await walk(childFull, zipName)
          } else if (st.isFile()) {
            entries.push({ filePath: childFull, zipName, size: st.size })
            totalBytes += st.size
          }
        } catch {
          // 跳过不可读条目
        }
      }
    }

    for (const src of sources) {
      if (src.kind === 'file') {
        try {
          const st = await fsPromises.stat(src.fullPath)
          entries.push({ filePath: src.fullPath, zipName: src.name, size: st.size })
          totalBytes += st.size
        } catch {
          // 源文件已不可读：跳过（压缩结果缺少该项）
        }
      } else {
        await walk(src.fullPath, src.name)
      }
    }

    return { entries, totalBytes }
  }

  /**
   * 流式压缩（Per-entry 进度回调）。
   * 成功 resolve({ relativePath })；取消 reject(new Error('CANCELLED')) 并清理半成品；
   * 出错 reject 并清理半成品。
   */
  function createArchive(opts: {
    entries: ZipEntry[]
    targetFull: string
    totalBytes: number
    signal?: AbortSignal
    onProgress?: (percent: number, processedBytes: number, totalBytes: number) => void
  }): Promise<TargetInfo> {
    const { entries, targetFull, totalBytes, signal, onProgress } = opts
    const relativePath = path.relative(getStorageRoot(), targetFull).replace(/\\/g, '/')

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        try {
          if (existsSync(targetFull)) unlinkSync(targetFull)
        } catch {
          // 忽略清理失败
        }
      }
      const cleanupAbort = () => {
        if (signal?.aborted) {
          cleanup()
          reject(new Error('CANCELLED'))
        }
      }

      const output = createWriteStream(targetFull)
      const archive = archiver.create('zip', { zlib: { level: 9 } })
      let processedBytes = 0
      let settled = false

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      const onAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        archive.abort()
        reject(new Error('CANCELLED'))
      }

      if (signal?.aborted) {
        onAbort()
        return
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      archive.on('entry', (entry) => {
        if (entry.stats && !entry.stats.isDirectory()) {
          processedBytes += entry.stats.size
          const denom = totalBytes > 0 ? totalBytes : 1
          const percent = Math.min(100, Math.round((processedBytes / denom) * 100))
          onProgress?.(percent, processedBytes, totalBytes)
        }
      })

      output.on('close', () => {
        finish(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve({ fullPath: targetFull, relativePath })
        })
      })

      archive.on('error', (err) => {
        finish(() => {
          cleanupAbort()
          signal?.removeEventListener('abort', onAbort)
          reject(err instanceof Error ? err : new Error(String(err)))
        })
      })

      output.on('error', (err) => {
        finish(() => {
          cleanup()
          signal?.removeEventListener('abort', onAbort)
          reject(err instanceof Error ? err : new Error(String(err)))
        })
      })

      archive.pipe(output)
      for (const entry of entries) {
        // 条目可能已消失（压缩开始后源被删除）：archiver 对不存在文件会抛错，由 error 分支兜底
        archive.file(entry.filePath, { name: entry.zipName })
      }
      archive.finalize()
    })
  }

  /**
   * 一次压缩任务（路由层调用，返回结构化结果而非直接写 SSE，便于测试）。
   * - ZCompressError 携带用户可读错误（含校验失败）
   * - CANCELLED 表示被取消
   */
  async function runJob(opts: {
    paths: string[]
    outputDir: string
    signal?: AbortSignal
    onProgress?: (percent: number, processedBytes: number, totalBytes: number) => void
  }): Promise<{ target: TargetInfo; entries: number }> {
    // 去重（多选列表理论上不重复，防呆）
    const paths = [...new Set(opts.paths)]
    const { outputDir } = opts

    if (!paths.length) {
      throw new ZCompressError('未选择任何文件/文件夹')
    }

    // 预检：存在性 + 读取/写入权限 + 目录包含防护
    const check = await checkPermissions(paths, outputDir)
    if (!check.ok) {
      const detail = [...check.items.map((i) => `${i.name}: ${i.error || (i.readable ? '可读' : '不可读')}`)]
        .concat(check.output.error ? [`输出目录: ${check.output.error}`] : [])
        .concat(check.forbiddenMessage ? [check.forbiddenMessage!] : [])
      throw new ZCompressError(detail.join('；'))
    }

    const sources = check.items.map((item) => resolveSource(item.path))
    sources.forEach((s, i) => (s.kind = check.items[i].kind))

    const target = computeTarget(sources, outputDir)
    const { entries, totalBytes } = await collectEntries(sources)
    if (!entries.length) {
      throw new ZCompressError('没有可压缩的文件')
    }

    logSafe(
      'INFO',
      'compress',
      `开始压缩 ${paths.length} 项 → ${target.relativePath}（${entries.length} 个文件，${totalBytes} 字节）`
    )

    try {
      await createArchive({
        entries,
        targetFull: target.fullPath,
        totalBytes,
        signal: opts.signal,
        onProgress: opts.onProgress,
      })
    } catch (e: any) {
      if (e?.message === 'CANCELLED') {
        logSafe('INFO', 'compress', `压缩已取消：${target.relativePath}`)
        throw e
      }
      logSafe('ERROR', 'compress', `压缩失败 ${target.relativePath}: ${e?.message || '未知错误'}`)
      throw e
    }

    logSafe('INFO', 'compress', `压缩完成：${target.relativePath}`)
    return { target, entries: entries.length }
  }

  return {
    resolveSource,
    computeTarget,
    targetBaseName,
    isForbiddenOutput,
    checkPermissions,
    collectEntries,
    createArchive,
    runJob,
  }
}

/** 用户可读的压缩业务错误（路由层转为 SSE error / HTTP 400） */
export class ZCompressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZCompressError'
  }
}

export type CompressService = ReturnType<typeof createCompressService>