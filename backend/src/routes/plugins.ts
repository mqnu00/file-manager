/**
 * 插件管理 API — 查询、搜索、安装、卸载、删除
 */

import { Router, Request, Response } from 'express'
import { spawn } from 'child_process'
import path from 'path'
import {
  getAllPluginInfos,
  getLoadedPlugins,
  loadPlugin,
  unloadPluginByName,
  resolvePluginRoot,
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
import type { NpmSearchResult } from '../plugin/types'

const router = Router()

// ==================== 查询已配置插件 ====================

// 查询所有已配置插件及启用状态（无需认证）
// 自动加载 config.yml 中 enabled=true 但尚未加载的插件
router.get('/', async (_req: Request, res: Response) => {
  const config = getConfig()
  const loadedNames = new Set(getLoadedPlugins().map((p) => p.name))

  for (const [name, cfg] of Object.entries(config.plugins || {})) {
    if (typeof cfg !== 'object' || cfg === null) continue
    if ((cfg as Record<string, unknown>).enabled === false) continue
    if (loadedNames.has(name)) continue
    try {
      await loadPlugin(name)
    } catch {
      // 单个插件加载失败不影响其他插件和列表返回
    }
  }

  const plugins = getAllPluginInfos().map((p) => ({
    name: p.name,
    enabled: p.enabled,
    local: p.local,
    source: p.source,
    frontendPath: p.frontendPath
      ? `/plugins-assets/${p.name}/${p.frontendPath.replace(/^\.\//, '')}`
      : null,
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
  })
})

// 运行时卸载插件
router.post('/:name/unload', authMiddleware, (req: Request, res: Response) => {
  const name = req.params.name as string
  const ok = unloadPluginByName(name)
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
  const keyword = 'file-manager-plugin'
  const query = q ? `keywords:${keyword}+${encodeURIComponent(q)}` : `keywords:${keyword}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const resp = await fetch(`https://registry.npmjs.org/-/v1/search?text=${query}&size=20`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      res.status(502).json({ error: `npm registry returned ${resp.status}` })
      return
    }

    const data = (await resp.json()) as {
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

    res.json(results)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ error: 'npm registry request timed out' })
      return
    }
    res.status(502).json({ error: `Failed to search npm registry: ${err}` })
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
    const npmArgs = ['install', installArg, '--prefix', prefix, '--no-save']
    if (force) npmArgs.push('--legacy-peer-deps')

    // 已安装且为 npm 来源：版本切换
    if (existing && existing.source === 'npm') {
      unloadPluginByName(shortName)
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
      res.json({
        name: shortName,
        enabled: instance !== null,
        local: false,
        source: 'npm' as const,
        frontendPath: instance?.frontendPath
          ? `/plugins-assets/${instance.name}/${instance.frontendPath.replace(/^\.\//, '')}`
          : null,
      })
      return
    }

    // 已安装且为本地来源：先卸载
    if (existing && existing.source === 'local') {
      unloadPluginByName(shortName)
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
    if (!instance) {
      res.json({
        name: shortName,
        enabled: false,
        local: false,
        source: 'npm' as const,
        frontendPath: null,
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
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Plugin] install error:', msg)
    res.status(500).json({ error: msg })
  }
})

// ==================== 删除插件（npm uninstall + 清除配置） ====================

router.delete('/:name', authMiddleware, async (req: Request, res: Response) => {
  const name = req.params.name as string

  // 查找插件
  const rootDir = resolvePluginRoot(name)
  if (!rootDir) {
    res.status(404).json({ error: `Plugin "${name}" not found` })
    return
  }

  // 禁止删除本地开发插件
  const projectRoot = path.resolve(__dirname, '..', '..', '..')
  const pluginsDir = path.join(projectRoot, 'plugins')
  if (rootDir.startsWith(pluginsDir)) {
    res.status(403).json({
      error: `Cannot delete local development plugin "${name}". Remove it from plugins/ directory manually.`,
    })
    return
  }

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

  // 1. 如已加载，先卸载
  unloadPluginByName(name)

  // 2. npm uninstall（从 plugin install prefix 卸载，与安装路径一致）
  const prefix = getPluginInstallPrefix()
  try {
    await runNpm(['uninstall', pkgName, '--prefix', prefix], prefix, 60000)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `npm uninstall failed: ${msg}` })
    return
  }

  // 3. 清除 config.yml 中的配置
  try {
    removePluginConfig(name)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Config cleanup failed: ${msg}` })
    return
  }

  res.json({ success: true })
})

export default router
