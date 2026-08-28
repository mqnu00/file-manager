/**
 * 插件管理 API — 查询、搜索、安装、卸载、删除
 */

import { Router, Request, Response } from 'express'
import { spawn } from 'child_process'
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
  const loaded = getLoadedPlugins()
    .map((p) => infoMap.get(p.name))
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
        await runNpm(['uninstall', pkgName, '--prefix', prefix], prefix, 60000)
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
  try {
    const { packageName, version, force } = req.body as {
      packageName: unknown
      version?: unknown
      force?: unknown
    }

    if (!packageName || typeof packageName !== 'string' || !PKG_NAME_RE.test(packageName)) {
      res.status(400).json({ error: 'Invalid package name' })
      return
    }

    if (version !== undefined && (typeof version !== 'string' || !VERSION_RE.test(version))) {
      res.status(400).json({ error: 'Invalid version format' })
      return
    }

    const shortName = deriveShortName(packageName)
    const existing = getAllPluginInfos().find((p) => p.name === shortName)
    const installArg = version ? `${packageName}@${version}` : packageName

    // 确保插件安装目录就绪
    ensurePluginInstallPrefix()
    const prefix = getPluginInstallPrefix()

    // 构建 npm 参数
    const npmArgs = ['install', installArg, '--prefix', prefix, '--save-exact']
    if (force) npmArgs.push('--legacy-peer-deps')

    // 已安装且为 npm 来源：版本切换
    if (existing && existing.source === 'npm') {
      await unloadPluginByName(shortName)
      await runNpm(npmArgs, prefix, 120000)

      const newRootDir = resolvePluginRoot(shortName)
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
      if (!compat.ok) return
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
      })
      return
    }

    // 已安装且为本地来源：先卸载
    if (existing && existing.source === 'local') {
      await unloadPluginByName(shortName)
    }

    // 1. npm install 到统一目录
    await runNpm(npmArgs, prefix, 120000)

    // 2. 解析插件根目录
    const rootDir = resolvePluginRoot(shortName)
    if (!rootDir) {
      res.status(500).json({
        error: `Plugin "${shortName}" installed but not found in ${getPluginInstallPrefix()}/node_modules`,
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
    if (!compat.ok) return
    if (!instance) {
      res.json({
        name: shortName,
        enabled: false,
        local: false,
        source: 'npm' as const,
        frontendPath: null,
        frontendPage: null,
        compatibilityWarning: compat.warning ?? null,
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
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Plugin] install error:', msg)
    res.status(500).json({ error: msg })
  }
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
      await runNpm(['uninstall', pkgName, '--prefix', prefix], prefix, 60000)
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
