/**
 * 插件管理 API — 查询、搜索、安装、卸载、删除
 */

import { Router, Request, Response } from 'express'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import {
  getAllPluginInfos,
  getLoadedPlugins,
  loadEnabledPlugins,
  loadPlugin,
  unloadPluginByName,
  resolvePluginRoot,
  preflightCheck,
  evaluateCompatibility,
} from '../plugin/loader'
import {
  getConfig,
  removePluginConfig,
  getPluginDefaultConfig,
  updatePluginConfig,
  getPluginInstallPrefix,
  ensurePluginInstallPrefix,
} from '../config'
import { authMiddleware } from '../middleware/auth'
import { clearPluginData, getPluginStore } from '../plugin/storage'
import { log } from '../utils/logger'
import type { NpmSearchResult } from '../plugin/types'

const router = Router()

// ==================== 查询已配置插件 ====================

// 查询所有已配置插件及启用状态（无需认证）
// 自动加载 config.yml 中 enabled=true 但尚未加载的插件（拓扑顺序，与键序无关）
router.get('/', async (_req: Request, res: Response) => {
  await loadEnabledPlugins()

  const infoMap = new Map(getAllPluginInfos().map((p) => [p.name, p]))
  const loadedNames = new Set(getLoadedPlugins().map((p) => p.name))

  // 已加载插件按拓扑加载序在前（前端 install 顺序即与后端拓扑一致，
  // dependsOn 可保证核心先于子插件加载）；未加载的（含已禁用）按配置序排后，
  // 保持插件管理页可展示/重新启用
  const loaded = getLoadedPlugins().map((p) => infoMap.get(p.name))
  const rest = getAllPluginInfos().filter((p) => !loadedNames.has(p.name))

  const plugins = [...loaded, ...rest]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      name: p.name,
      enabled: p.enabled,
      local: p.local,
      source: p.source,
      frontendPath: p.frontendPath
        ? `/plugins-assets/${p.name}/${p.frontendPath.replace(/^\.\//, '')}`
        : null,
      frontendPage: p.frontendPage ?? null,
      version: p.version,
      minHostVersion: p.minHostVersion ?? null,
      dependencyIssues: p.dependencyIssues ?? [],
      compatible: p.compatible,
      compatibilityWarning: p.compatibilityWarning ?? null,
    }))
  res.json(plugins)
})

// ==================== 运行时加载/卸载 ====================

// 运行时加载插件
router.post('/load', authMiddleware, async (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Missing or invalid plugin name' })
    return
  }

  // 兼容性预检（宿主版本 + 依赖插件版本）：硬阻塞直接拒绝；软提示仍加载
  const pf = preflightCheck(name)
  if (!pf.ok) {
    if (pf.notFound) {
      res.status(404).json({ error: `Plugin "${name}" not found or already loaded` })
    } else {
      res.status(409).json({ error: pf.reason })
    }
    return
  }

  const plugin = await loadPlugin(name)
  if (!plugin) {
    res.status(404).json({ error: `Plugin "${name}" not found or already loaded` })
    return
  }

  res.json({
    name: plugin.name,
    enabled: true,
    local: plugin.local,
    source: plugin.source,
    frontendPath: plugin.frontendPath
      ? `/plugins-assets/${plugin.name}/${plugin.frontendPath.replace(/^\.\//, '')}`
      : null,
    frontendPage: plugin.frontendPage ?? null,
    compatibilityWarning: pf.warning ?? null,
  })
})

// 运行时卸载插件
router.post('/:name/unload', authMiddleware, async (req: Request, res: Response) => {
  const name = req.params.name as string
  const ok = await unloadPluginByName(name)
  if (!ok) {
    res.status(404).json({ error: `Plugin "${name}" is not loaded` })
    return
  }
  res.json({ success: true })
})

// ==================== npm 搜索 ====================

// npm 包名校验正则
const PKG_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

/** 从 npm 包名派生短名称（config.yml 中的插件键） */
function deriveShortName(packageName: string): string {
  const unscoped = packageName.includes('/') ? packageName.split('/')[1] : packageName
  const prefix = 'file-manager-plugin-'
  if (unscoped.startsWith(prefix)) {
    return unscoped.slice(prefix.length)
  }
  return unscoped
}

// 搜索 npm registry 中的 file-manager-plugin 包
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20))
  const keyword = 'file-manager-plugin'
  const query = q ? `keywords:${keyword}+${encodeURIComponent(q)}` : `keywords:${keyword}`
  const from = (page - 1) * pageSize

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const resp = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${query}&size=${pageSize}&from=${from}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!resp.ok) {
      res.status(502).json({ error: `npm registry returned ${resp.status}` })
      return
    }

    const data = (await resp.json()) as {
      total?: number
      objects?: Array<{
        package: {
          name: string
          version: string
          description?: string
          publisher?: { username?: string }
          date?: string
          links?: { npm?: string; repository?: string; homepage?: string }
        }
      }>
    }

    const results: NpmSearchResult[] = (data.objects ?? []).map((obj) => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description ?? '',
      publisher: obj.package.publisher?.username ?? '',
      date: obj.package.date ?? '',
      links: {
        npm: obj.package.links?.npm ?? `https://www.npmjs.com/package/${obj.package.name}`,
        repository: obj.package.links?.repository,
        homepage: obj.package.links?.homepage,
      },
    }))

    res.json({ total: data.total ?? 0, results })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: 'npm registry request timed out' })
      return
    }
    res.status(502).json({ error: `Failed to search npm registry: ${err}` })
  }
})

// ==================== npm 版本列表 ====================

/** 简单 semver 比较：返回 -1/0/1，pre-release 版本小于正式版 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string): (string | number)[] => {
    const [core, pre] = v.split('-')
    const nums = core.split('.').map((n) => parseInt(n, 10) || 0)
    return pre === undefined ? [...nums, Infinity] : [...nums, pre]
  }
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1
    } else if (typeof x === 'number') {
      // x 无 pre-release（正式版），y 为 pre-release → 正式版更大
      return 1
    } else if (typeof y === 'number') {
      return -1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

// 获取 npm 包已发布版本列表（semver 降序 + latest）
router.get('/versions', authMiddleware, async (req: Request, res: Response) => {
  const name = (req.query.name as string) || ''
  if (!PKG_NAME_RE.test(name)) {
    res.status(400).json({ error: 'Invalid package name' })
    return
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const resp = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (resp.status === 404) {
      res.status(404).json({ error: `Package "${name}" not found` })
      return
    }
    if (!resp.ok) {
      res.status(502).json({ error: `npm registry returned ${resp.status}` })
      return
    }

    const data = (await resp.json()) as {
      versions?: Record<string, unknown>
      'dist-tags'?: Record<string, string>
    }
    const all = Object.keys(data.versions ?? {})
    const distTags = data['dist-tags'] ?? {}
    const latest = distTags.latest ?? all[0] ?? ''
    const versions = all.sort((a, b) => compareVersions(b, a))
    res.json({ versions, latest })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: 'npm registry request timed out' })
      return
    }
    res.status(502).json({ error: `Failed to fetch versions: ${err}` })
  }
})

// ==================== npm 安装插件 ====================

// ==================== npm 安装任务（可观察 / 可手动终止） ====================

/**
 * 安装不设自动超时：超时杀死 npm 会留下半写的 .package-lock.json 与撕裂的
 * node_modules，导致后续每次安装都退化为"全树退役重建"（ENOTEMPTY 高发）。
 * 安装过程通过任务注册表暴露：前端 1s 轮询增量日志，用户觉得太久可手动终止。
 */

export type InstallTaskStatus = 'running' | 'success' | 'failed' | 'terminated'

interface InstallTask {
  id: string
  packageName: string
  status: InstallTaskStatus
  exitCode: number | null
  lines: string[]
  startedAt: number
  child: ChildProcess | null
  terminateRequested: boolean
  expiresAt: number | null
  cleanupTimer?: NodeJS.Timeout
}

const installTasks = new Map<string, InstallTask>()
/** 任务结束后日志保留时长 */
const INSTALL_TASK_KEEP_MS = 10 * 60 * 1000
/** 注册表容量上限（溢出时优先淘汰最老的已结束任务） */
const INSTALL_TASK_MAX = 20
/** 单任务日志行数上限（超出裁剪旧行） */
const INSTALL_TASK_MAX_LINES = 500
/** 前端预生成 taskId 的格式约束 */
const TASK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

let taskSeq = 0
function nextTaskId(): string {
  taskSeq += 1
  return `task-${Date.now().toString(36)}-${taskSeq.toString(36)}`
}

/** 创建安装任务。id 由前端预生成时用于"请求发出即可轮询日志"；冲突时抛错 */
function createInstallTask(packageName: string, id?: string): InstallTask {
  const taskId = id ?? nextTaskId()
  if (id) {
    const existing = installTasks.get(taskId)
    if (existing) {
      if (existing.status === 'running') {
        throw new Error(`Install task "${taskId}" is already running`)
      }
      installTasks.delete(taskId)
    }
  }
  const task: InstallTask = {
    id: taskId,
    packageName,
    status: 'running',
    exitCode: null,
    lines: [],
    startedAt: Date.now(),
    child: null,
    terminateRequested: false,
    expiresAt: null,
  }
  installTasks.set(taskId, task)
  pruneInstallTasks()
  return task
}

/** 追加日志（按行切分、环形裁剪旧行） */
function appendTaskLog(task: InstallTask, chunk: string): void {
  for (const line of chunk.split(/\r?\n/)) {
    if (line === '' && task.lines.length === 0) continue
    task.lines.push(line)
    if (task.lines.length > INSTALL_TASK_MAX_LINES) {
      task.lines.splice(0, task.lines.length - INSTALL_TASK_MAX_LINES)
    }
  }
}

function finishInstallTask(
  task: InstallTask,
  status: Exclude<InstallTaskStatus, 'running'>,
  exitCode: number | null
): void {
  task.status = status
  task.exitCode = exitCode
  task.child = null
  task.expiresAt = Date.now() + INSTALL_TASK_KEEP_MS
  task.cleanupTimer = setTimeout(() => {
    installTasks.delete(task.id)
  }, INSTALL_TASK_KEEP_MS)
  task.cleanupTimer.unref?.()
}

/** 清理过期任务；容量超出时淘汰最老的已结束任务（运行中的不淘汰） */
function pruneInstallTasks(): void {
  const now = Date.now()
  for (const [id, t] of installTasks) {
    if (t.expiresAt && t.expiresAt < now) installTasks.delete(id)
  }
  if (installTasks.size > INSTALL_TASK_MAX) {
    const victims = [...installTasks.values()].sort(
      (a, b) =>
        (a.status === 'running' ? 1 : 0) - (b.status === 'running' ? 1 : 0) ||
        a.startedAt - b.startedAt
    )
    for (const v of victims) {
      if (installTasks.size <= INSTALL_TASK_MAX) break
      if (v.status === 'running') break
      installTasks.delete(v.id)
    }
  }
}

/**
 * 可观察的 npm 执行：不设超时；stdout/stderr 实时进入任务日志；
 * 手动终止（SIGTERM）后标记为 terminated 并抛"用户终止"错误。
 * 注意：npm 官方不支持在同一 prefix 并发执行（并发 reify 会互相撕扯
 * node_modules 导致 ENOTEMPTY/EBUSY/假 up-to-date），调用方必须在
 * withNpmLock 队列内运行。
 */
function runNpmTracked(
  args: string[],
  cwd: string,
  task: InstallTask
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd })
    task.child = child
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      appendTaskLog(task, text)
    })
    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      appendTaskLog(task, text)
    })

    child.on('close', (code) => {
      if (task.terminateRequested) {
        finishInstallTask(task, 'terminated', code)
        reject(new Error('npm install terminated by user'))
      } else if (code === 0) {
        finishInstallTask(task, 'success', 0)
        resolve({ stdout, stderr })
      } else {
        finishInstallTask(task, 'failed', code)
        reject(new Error(`npm exited with code ${code}: ${stderr || stdout}`))
      }
    })

    child.on('error', (err) => {
      finishInstallTask(task, 'failed', null)
      reject(err)
    })
  })
}

function runNpm(
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd, timeout: timeoutMs })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`npm exited with code ${code}: ${stderr || stdout}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

// semver 或 npm tag 格式校验
const VERSION_RE = /^[\d.]+(?:-[a-zA-Z0-9.]+)?$|^[a-z]+$/

// ==================== npm 互斥锁 ====================

/**
 * npm 官方不支持在同一 prefix（目录）并发执行：并发 reify 会互相撕扯 node_modules，
 * 典型症状为 ENOTEMPTY: directory not empty, rmdir、EBUSY，以及假 up-to-date——
 * 一个进程把另一个进程刚装好的包目录撕成残缺状态后，重跑 npm install 会因
 * package.json 版本与 lockfile 匹配而跳过修复（exit 0）。
 * 插件安装/卸载/回滚共用同一 prefix，必须全局串行：上一个 npm 进程结束后才启动下一个。
 */
let npmTail: Promise<unknown> = Promise.resolve()

/** 将 npm 操作排入全局串行队列（前序失败不阻断后续操作） */
function withNpmLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = npmTail.then(fn, fn)
  npmTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/** 在 prefix/node_modules 中定位 npm 包的实际目录（含 @scope），找不到返回 null */
function findPackageDir(packageName: string, nmDir: string): string | null {
  const candidates: string[] = []
  if (packageName.startsWith('@')) {
    const [scope, pkg] = packageName.split('/')
    candidates.push(path.join(nmDir, scope, pkg))
  } else {
    candidates.push(path.join(nmDir, packageName))
    candidates.push(path.join(nmDir, 'file-manager-plugin-' + packageName))
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // 兜底：扫描 @scope 子目录（仅非 scoped 包名需要）
  if (packageName.startsWith('@') || !fs.existsSync(nmDir)) return null
  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('@')) continue
    const pkg = path.join(nmDir, entry.name, packageName)
    if (fs.existsSync(pkg)) return pkg
  }
  return null
}

/**
 * npm 退出 0 但插件不可解析时的自愈。根因：中断的 reify 可能把包目录撕成
 * "只剩 package.json"的残缺状态，此时重跑 npm install 会因版本匹配而报 up to date
 * （exit 0）却不修复目录。删除残缺目录后重装一次。
 * 注意：必须在 withNpmLock 回调内调用（复用已持有的锁），避免重装与外部并发。
 */
async function healAndReinstall(
  shortName: string,
  packageName: string,
  npmArgs: string[],
  prefix: string,
  task?: InstallTask
): Promise<string | null> {
  try {
    const nmDir = path.join(prefix, 'node_modules')
    const pkgDir = findPackageDir(packageName, nmDir)
    if (pkgDir) {
      fs.rmSync(pkgDir, { recursive: true, force: true })
    }
    if (task) {
      await runNpmTracked(npmArgs, prefix, task)
    } else {
      await runNpm(npmArgs, prefix, 60000)
    }
    return resolvePluginRoot(shortName)
  } catch {
    return null
  }
}

/**
 * 安装后兼容性不通过时回滚：npm uninstall + 清除 config.yml 配置。
 * 避免不兼容的插件残留在 node_modules / 配置中。
 */
async function rollbackInstalledPlugin(shortName: string, prefix: string): Promise<void> {
  try {
    const rootDir = resolvePluginRoot(shortName)
    if (rootDir) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkgName = require(path.join(rootDir, 'package.json')).name as string | undefined
      if (pkgName && PKG_NAME_RE.test(pkgName)) {
        await withNpmLock(() => runNpm(['uninstall', pkgName, '--prefix', prefix], prefix, 60000))
      }
    }
  } catch {
    /* 回滚失败仅记录，不阻断响应 */
  }
  try {
    removePluginConfig(shortName)
  } catch {
    /* 同上 */
  }
}

/** 安装后校验兼容性，不通过则回滚并返回错误响应 */
/** 安装后校验兼容性，硬阻塞则回滚并返回 409；软提示时返回 warning 但不回滚 */
async function ensureCompatibleOrRollback(
  shortName: string,
  prefix: string,
  res: Response
): Promise<{ ok: boolean; warning?: string }> {
  const rootDir = resolvePluginRoot(shortName)
  if (!rootDir) {
    res.status(409).json({ error: `Plugin "${shortName}" not found after install` })
    return { ok: false }
  }
  const r = evaluateCompatibility(rootDir)
  if (r.hardBlock) {
    await rollbackInstalledPlugin(shortName, prefix)
    res.status(409).json({ error: r.reason })
    return { ok: false }
  }
  return { ok: true, warning: r.warning }
}

router.post('/install', authMiddleware, async (req: Request, res: Response) => {
  // 任务记录贯穿整个安装流程（含自愈重装），失败响应也携带 taskId 供前端拉取日志
  let task: InstallTask | null = null
  try {
    const { packageName, version, force, taskId } = req.body as {
      packageName: unknown
      version?: unknown
      force?: unknown
      taskId?: unknown
    }

    if (!packageName || typeof packageName !== 'string' || !PKG_NAME_RE.test(packageName)) {
      res.status(400).json({ error: 'Invalid package name' })
      return
    }

    if (version !== undefined && (typeof version !== 'string' || !VERSION_RE.test(version))) {
      res.status(400).json({ error: 'Invalid version format' })
      return
    }

    if (taskId !== undefined && (typeof taskId !== 'string' || !TASK_ID_RE.test(taskId))) {
      res.status(400).json({ error: 'Invalid taskId format' })
      return
    }

    // 校验后收窄为 string（闭包内不丢失类型）
    const pkgName: string = packageName
    const shortName = deriveShortName(pkgName)
    const existing = getAllPluginInfos().find((p) => p.name === shortName)
    const installArg = version ? `${pkgName}@${version}` : pkgName

    // 确保插件安装目录就绪
    ensurePluginInstallPrefix()
    const prefix = getPluginInstallPrefix()

    // 创建可观察安装任务（前端用预生成 taskId 在请求发出后立即轮询日志）
    task = createInstallTask(packageName, taskId as string | undefined)

    // 构建 npm 参数。
    // 默认 --legacy-peer-deps：插件声明的 peer 是宿主 @mqn00/file-manager（运行时
    // 通过 ctx 注入 API），不应自动安装进插件 store（否则会把整个宿主 ~180 个包
    // 塞进 store，放大安装体积/时长与 reify 出错窗口）。第三方真实依赖应声明为
    // 普通 dependencies。force 时追加 --force（绕过缓存/校验强制覆盖）。
    const npmArgs = [
      'install',
      installArg,
      '--prefix',
      prefix,
      '--save-exact',
      '--legacy-peer-deps',
    ]
    if (force) npmArgs.push('--force')

    // 在互斥队列内执行 npm install（可观察、不设超时），完成后解析并自愈残缺目录
    const runInstallInLock = async (): Promise<string | null> => {
      let rootDir: string | null = null
      await withNpmLock(async () => {
        await runNpmTracked(npmArgs, prefix, task as InstallTask)
        rootDir = resolvePluginRoot(shortName)
        if (!rootDir) {
          rootDir = await healAndReinstall(shortName, pkgName, npmArgs, prefix, task as InstallTask)
        }
      })
      return rootDir
    }

    // 已安装且为 npm 来源：版本切换
    if (existing && existing.source === 'npm') {
      await unloadPluginByName(shortName)
      const newRootDir = await runInstallInLock()
      task.status = newRootDir ? task.status : 'failed'

      if (newRootDir) {
        const defaults = getPluginDefaultConfig(newRootDir)
        const currentCfg = (getConfig().plugins || {})[shortName] as
          | Record<string, unknown>
          | undefined
        updatePluginConfig(shortName, { ...defaults, ...(currentCfg || {}) })
      }

      const instance = await loadPlugin(shortName)
      // 安装后兼容性校验（宿主版本 + 依赖版本），硬阻塞则回滚；软提示带 warning 但不回滚
      const compat = await ensureCompatibleOrRollback(shortName, prefix, res)
      if (!compat.ok) {
        task.status = 'failed'
        return
      }
      res.json({
        name: shortName,
        enabled: instance !== null,
        local: false,
        source: 'npm' as const,
        frontendPath: instance?.frontendPath
          ? `/plugins-assets/${instance.name}/${instance.frontendPath.replace(/^\.\//, '')}`
          : null,
        frontendPage: instance?.frontendPage ?? null,
        compatibilityWarning: compat.warning ?? null,
        taskId: task.id,
      })
      return
    }

    // 已安装且为本地来源：先卸载
    if (existing && existing.source === 'local') {
      await unloadPluginByName(shortName)
    }

    // 1. npm install 到统一目录（互斥串行；日志可观察；无自动超时）
    const rootDir = await runInstallInLock()

    // 2. npm 成功但插件不可解析（含自愈也失败）→ 500
    if (!rootDir) {
      task.status = 'failed'
      res.status(500).json({
        error: `Plugin "${shortName}" installed but not found in ${getPluginInstallPrefix()}/node_modules`,
        taskId: task.id,
      })
      return
    }

    // 3. 写入 config.yml（保留现有配置值，npm 默认仅补充缺失字段）
    const defaults = getPluginDefaultConfig(rootDir)
    const currentCfg = (getConfig().plugins || {})[shortName] as Record<string, unknown> | undefined
    const merged = { ...defaults, ...(currentCfg || {}), enabled: true, source: 'npm' as const }
    updatePluginConfig(shortName, merged)

    // 4. 自动加载插件
    const instance = await loadPlugin(shortName)
    // 安装后兼容性校验（宿主版本 + 依赖版本），硬阻塞则回滚；软提示带 warning 但不回滚
    const compat = await ensureCompatibleOrRollback(shortName, prefix, res)
    if (!compat.ok) {
      task.status = 'failed'
      return
    }
    if (!instance) {
      res.json({
        name: shortName,
        enabled: false,
        local: false,
        source: 'npm' as const,
        frontendPath: null,
        frontendPage: null,
        compatibilityWarning: compat.warning ?? null,
        taskId: task.id,
      })
      return
    }

    res.json({
      name: instance.name,
      enabled: true,
      local: instance.local,
      source: instance.source,
      frontendPath: instance.frontendPath
        ? `/plugins-assets/${instance.name}/${instance.frontendPath.replace(/^\.\//, '')}`
        : null,
      frontendPage: instance.frontendPage ?? null,
      compatibilityWarning: compat.warning ?? null,
      taskId: task.id,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Plugin] install error:', msg)
    res.status(500).json({ error: msg, ...(task ? { taskId: task.id } : {}) })
  }
})

// ==================== 安装任务查询 / 日志 / 终止 ====================

// 活跃/近期安装任务列表（前端刷新页面后据此恢复进行中的安装面板）
router.get('/install-tasks', authMiddleware, (_req: Request, res: Response) => {
  pruneInstallTasks()
  res.json(
    [...installTasks.values()].map((t) => ({
      id: t.id,
      packageName: t.packageName,
      status: t.status,
      startedAt: t.startedAt,
    }))
  )
})

// 增量拉取安装日志（offset 为上次已读行数；任务结束后 10 分钟内仍可查）
router.get('/install-log/:id', authMiddleware, (req: Request, res: Response) => {
  const task = installTasks.get(req.params.id as string)
  if (!task) {
    res.status(404).json({ error: 'Install task not found or expired' })
    return
  }
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0)
  res.json({
    id: task.id,
    packageName: task.packageName,
    status: task.status,
    exitCode: task.exitCode,
    offset: task.lines.length,
    lines: task.lines.slice(offset),
  })
})

// 手动终止进行中的安装（SIGTERM 结束 npm；可能残留半装目录，重试安装会自动自愈）
router.post('/install-log/:id/terminate', authMiddleware, (req: Request, res: Response) => {
  const task = installTasks.get(req.params.id as string)
  if (!task) {
    res.status(404).json({ error: 'Install task not found or expired' })
    return
  }
  if (task.status !== 'running' || !task.child) {
    res.status(409).json({ error: 'Install task is not running' })
    return
  }
  task.terminateRequested = true
  task.child.kill('SIGTERM')
  res.json({ success: true })
})

// ==================== 插件数据目录（KV 存储） ====================

/**
 * 守卫：仅允许对"已在 config.yml 配置"或"可解析到安装目录"的插件访问数据目录，
 * 防止为任意名称创建数据目录。
 */
function isKnownPlugin(name: string): boolean {
  const cfg = (getConfig().plugins || {})[name]
  return Boolean(cfg) || Boolean(resolvePluginRoot(name))
}

// 读取全部键值
router.get('/:name/data', authMiddleware, async (req: Request, res: Response) => {
  const name = req.params.name as string
  if (!isKnownPlugin(name)) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }
  try {
    res.json(getPluginStore(name).all())
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// 读取单个键值
router.get('/:name/data/:key', authMiddleware, async (req: Request, res: Response) => {
  const { name, key } = req.params as { name: string; key: string }
  if (!isKnownPlugin(name)) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }
  const value = getPluginStore(name).get(key)
  if (value === undefined) {
    res.status(404).json({ error: `Key "${key}" not found in plugin "${name}" data` })
    return
  }
  res.json({ key, value })
})

// 写入单个键值（body 即任意 JSON 值）
router.put('/:name/data/:key', authMiddleware, async (req: Request, res: Response) => {
  const { name, key } = req.params as { name: string; key: string }
  if (!isKnownPlugin(name)) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }
  try {
    getPluginStore(name).set(key, req.body)
    res.json({ success: true })
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode ?? 400
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// 删除单个键值
router.delete('/:name/data/:key', authMiddleware, async (req: Request, res: Response) => {
  const { name, key } = req.params as { name: string; key: string }
  if (!isKnownPlugin(name)) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }
  getPluginStore(name).delete(key)
  res.json({ success: true })
})

// 清空插件全部数据
router.delete('/:name/data', authMiddleware, async (req: Request, res: Response) => {
  const name = req.params.name as string
  if (!isKnownPlugin(name)) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }
  clearPluginData(name)
  res.json({ success: true })
})

// ==================== 删除插件（npm uninstall + 清除配置） ====================

router.delete('/:name', authMiddleware, async (req: Request, res: Response) => {
  const name = req.params.name as string

  // 查找插件包；包可能已不在磁盘上（如手动清理 node_modules），
  // 只要 config.yml 中仍有该插件配置，就允许删除（仅清理配置）
  const rootDir = resolvePluginRoot(name)
  const hasConfig = Boolean((getConfig().plugins || {})[name])

  if (!rootDir && !hasConfig) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }

  // 禁止删除本地开发插件（仅当能解析到 plugins/ 目录时判定）
  if (rootDir) {
    const projectRoot = path.resolve(__dirname, '..', '..', '..')
    const pluginsDir = path.join(projectRoot, 'plugins')
    if (rootDir.startsWith(pluginsDir)) {
      res.status(403).json({
        error: `Cannot delete local development plugin "${name}". Remove it from plugins/ directory manually.`,
      })
      return
    }
  }

  // 1. 如已加载，先卸载（包不存在时插件必然未加载，忽略返回值）
  await unloadPluginByName(name)

  // 2. 包存在时执行 npm uninstall（与安装路径一致）
  if (rootDir) {
    // 获取 npm 包名
    let pkgName: string | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      pkgName = require(path.join(rootDir, 'package.json')).name
    } catch {
      res.status(500).json({ error: `Cannot read package.json for plugin "${name}"` })
      return
    }

    if (!pkgName || !PKG_NAME_RE.test(pkgName)) {
      res.status(400).json({ error: `Invalid package name in plugin "${name}"` })
      return
    }

    const prefix = getPluginInstallPrefix()
    try {
      // 与安装共用互斥队列，避免与并发的 npm install/reify 互相撕扯
      await withNpmLock(() => runNpm(['uninstall', pkgName, '--prefix', prefix], prefix, 60000))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: `npm uninstall failed: ${msg}` })
      return
    }
  }

  // 3. 清除 config.yml 中的配置
  try {
    removePluginConfig(name)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Config cleanup failed: ${msg}` })
    return
  }

  // 4. 可选：一并删除插件本地数据目录（默认保留，仅当用户显式勾选）
  if (req.query.clearData === 'true' || req.query.clearData === '1') {
    try {
      clearPluginData(name)
    } catch (err: unknown) {
      // 数据清理失败不阻断删除主流程（配置与包已移除）
      log('WARNING', 'Plugin', `Failed to clear data dir for plugin "${name}": ${err}`)
    }
  }

  res.json({ success: true })
})

export default router
