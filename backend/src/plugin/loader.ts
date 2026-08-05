/**
 * 插件加载器 — 运行时发现并加载插件
 *
 * 从 config.yml 的 plugins 段读取启用列表，按优先级查找插件包：
 *   1. node_modules/{name}（精确匹配，含 scoped 如 @scope/pkg）
 *   2. node_modules/file-manager-plugin-{name}
 *   3. node_modules/@scope/{name}、node_modules/@scope/file-manager-plugin-{name}（扫描所有 scope）
 *   4. plugins/{name}（本地开发目录）
 *
 * 通过 package.json 的 main/exports 解析入口文件，动态 import 并调用 install(ctx)。
 *
 * 开发环境热重载：本地插件（plugins/ 目录）编译产出变化后自动重新加载。
 * 注意：热重载在 ts-node 下受限（ts-node 有独立编译缓存），推荐使用编译模式开发：
 *   cd backend && npm run build && npm start
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { getConfig, getPluginInstallDir, updatePluginConfig } from '../config'
import { createScriptContext } from '../context'
import { pluginApp } from '../app'
import { log } from '../utils/logger'
import type {
  BackendPluginContext,
  PluginInstallFunction,
  LoadedPlugin,
  PluginInfo,
  PluginManifestConfig,
} from './types'

// ==================== 内部类型 ====================

interface PluginInstance {
  name: string
  rootDir: string
  frontendPath: string | null
  /** 是否来自 plugins/ 目录（本地开发），支持热重载 */
  local: boolean
  /** 插件来源，持久化到 config.yml */
  source: 'local' | 'npm'
  /** install() 后在 pluginApp.stack 中新增的 Layer 对象 */
  layers: unknown[]
  /** 本插件注册的服务名列表，卸载时用于清理 */
  registeredServices: string[]
  /** fs.watch 监视器 */
  watcher?: fs.FSWatcher
  /** 防抖重载定时器 */
  reloadTimer?: ReturnType<typeof setTimeout>
  /** 是否正在重载中（防止并发重载导致重复条目） */
  reloading?: boolean
}

interface PluginManifest {
  name: string
  rootDir: string
  dependsOn: string[]
}

// ==================== 状态 ====================

const loadedPlugins: PluginInstance[] = []

// ==================== 解析 ====================

/** 通过 require.resolve 定位包入口，再向上查找 package.json 得到根目录。
 *  直接 require.resolve(name + '/package.json') 会被 exports 字段封锁，
 *  因此改为先解析入口再向上查找。 */
function resolvePackageRoot(spec: string, resolveOpts: { paths: string[] }): string | null {
  try {
    let dir = path.dirname(require.resolve(spec, resolveOpts))
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir
      }
      dir = path.dirname(dir)
    }
    return null
  } catch {
    return null
  }
}

/** 查找插件包的根目录（package.json 所在目录） */
export function resolvePluginRoot(name: string): string | null {
  const config = getConfig()
  const pluginCfg = (config.plugins || {})[name] as Record<string, unknown> | undefined
  const source = pluginCfg?.source

  // 从 node_modules 下收集 @scope 目录列表
  function collectScopes(nodeModulesDir: string): string[] {
    try {
      return fs.readdirSync(nodeModulesDir).filter((d) => d.startsWith('@'))
    } catch {
      return []
    }
  }

  function tryResolve(baseDir: string): string | null {
    const resolveOpts = { paths: [baseDir] }
    const nodeModulesDirs = [path.join(baseDir, 'node_modules')]
    if (baseDir.includes('node_modules')) {
      nodeModulesDirs.push(path.dirname(baseDir))
    }

    const prefixed = 'file-manager-plugin-' + name

    // 1. 精确匹配（支持 scoped 包名如 @scope/pkg）
    const exact = resolvePackageRoot(name, resolveOpts)
    if (exact) return exact

    // 2. 加 file-manager-plugin- 前缀查找
    const pkg = resolvePackageRoot(prefixed, resolveOpts)
    if (pkg) return pkg

    // 3. 在 @scope 子目录下查找
    for (const nmDir of nodeModulesDirs) {
      for (const scope of collectScopes(nmDir)) {
        const exactScoped = resolvePackageRoot(scope + '/' + name, resolveOpts)
        if (exactScoped) return exactScoped
        const prefixedScoped = resolvePackageRoot(scope + '/' + prefixed, resolveOpts)
        if (prefixedScoped) return prefixedScoped
      }
    }

    return null
  }

  // npm 插件：从统一的 pluginInstallDir 解析
  // tryResolve 的 baseDir 参数应为 node_modules 的父目录（require.resolve 的 paths 选项会自动追加 /node_modules）
  if (source === 'npm') {
    const installDir = getPluginInstallDir()
    return tryResolve(path.dirname(installDir))
  }

  // 本地/未知来源：从 projectRoot 解析，回退 pluginInstallDir，再回退 plugins/ 开发目录
  const projectRoot = path.resolve(__dirname, '..', '..', '..')
  let result = tryResolve(projectRoot)
  if (!result) {
    // npm 安装后 config 可能尚未写入 source: 'npm'，仍需在统一安装目录查找
    result = tryResolve(path.dirname(getPluginInstallDir()))
  }
  if (result) return result

  // 4. 回退 plugins/ 开发目录
  try {
    return path.dirname(
      require.resolve(path.join(projectRoot, 'plugins', name, 'package.json'), {
        paths: [projectRoot],
      })
    )
  } catch {
    /* 不在 plugins */
  }

  return null
}

/** 判断 rootDir 是否为本地开发插件 */
function isLocalPlugin(rootDir: string): boolean {
  return !rootDir.includes('node_modules')
}

// ==================== 辅助 ====================

/** 从模块导出中提取 install 函数，支持多种导出模式 */
function getInstallFn(mod: unknown): PluginInstallFunction | null {
  if (typeof mod === 'function') return mod as PluginInstallFunction
  if (mod && typeof mod === 'object') {
    const obj = mod as Record<string, unknown>
    if (typeof obj.install === 'function') return obj.install as PluginInstallFunction
    if (typeof obj.default === 'function') return obj.default as PluginInstallFunction
    if (obj.default && typeof (obj.default as Record<string, unknown>).install === 'function') {
      return (obj.default as Record<string, unknown>).install as PluginInstallFunction
    }
  }
  return null
}

/** 清除 Node.js 模块缓存中属于指定 rootDir 的条目 */
function clearModuleCache(rootDir: string): void {
  if (!require.cache) return
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(rootDir)) {
      delete require.cache[key]
    }
  })
}

// ==================== 共享插件上下文 ====================

/**
 * 所有插件共享同一个 ctx 对象（单例），因此插件 A 在 ctx 上挂载的自定义属性
 * 可被插件 B 直接访问，实现插件间服务共享。
 *
 * 同时注入 registerService / getService 两个方法，提供带冲突检测和
 * 卸载清理的服务注册机制。
 */

/** 记录每个服务由哪个插件注册，serviceName → pluginName */
const serviceRegistry = new Map<string, string>()

/** 当前正在执行 install() 的插件名（并行加载时用于准确归属服务注册） */
let currentInstallingPlugin: string | null = null

let _sharedPluginCtx: BackendPluginContext | null = null

function getSharedPluginCtx(): BackendPluginContext {
  if (!_sharedPluginCtx) {
    const base = createScriptContext()
    _sharedPluginCtx = {
      ...base,
      app: pluginApp,
      registerService(name: string, impl: any) {
        if (serviceRegistry.has(name)) {
          throw new Error(
            `Service "${name}" is already registered by plugin "${serviceRegistry.get(name)}"`
          )
        }
        // 直接归属当前正在 install 的插件，避免并行加载时占位符被其他插件抢走；
        // install 之外注册时回退占位符，由 loadSinglePlugin 在 install 后兜底归属
        serviceRegistry.set(name, currentInstallingPlugin ?? '___loading___')
        ;(_sharedPluginCtx as any)[name] = impl
      },
      getService(name: string) {
        if (!serviceRegistry.has(name)) {
          throw new Error(`Service "${name}" is not registered by any plugin`)
        }
        return (_sharedPluginCtx as any)[name]
      },
    }
  }
  return _sharedPluginCtx!
}

// ==================== 单插件装载/卸载 ====================

/**
 * 装载单个插件
 * @param name 插件名（配置键）
 * @param rootDir 插件根目录
 * @param cacheBust 是否需要用临时副本绕过模块缓存（热重载时传入 true）
 */
async function loadSinglePlugin(
  name: string,
  rootDir: string,
  cacheBust?: boolean
): Promise<PluginInstance | null> {
  try {
    // 读取 package.json 获取入口文件路径
    const pkg: { main?: string; exports?: Record<string, string>; type?: string } = require(
      path.join(rootDir, 'package.json')
    )
    const entryRel = pkg.main || 'dist/backend.js'
    const entryAbs = path.resolve(rootDir, entryRel)

    // 导入模块：统一使用 CJS require 加载（v3 起不再支持 ESM 插件）
    // 热重载时调用方（reloadPlugin）已先 unloadPlugin 清除 require.cache，
    // 但为绕过 ts-node/tsx 等中间层缓存，仍将整个 dist 目录复制到唯一临时路径加载；
    // 整体复制而非仅入口文件，保证多文件插件（入口 require('./xxx')）的相对依赖可解析。
    let mod: unknown
    if (cacheBust) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'))
      fs.cpSync(path.dirname(entryAbs), tmpDir, { recursive: true })
      mod = require(path.join(tmpDir, path.basename(entryAbs)))
      // 延迟清理：install 可能异步引用相对依赖，30 秒后删除临时目录
      setTimeout(() => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
          /* 忽略清理失败 */
        }
      }, 30_000).unref?.()
    } else {
      mod = require(entryAbs)
    }

    const install = getInstallFn(mod)

    if (!install) {
      log('WARNING', 'Plugin', `Plugin "${name}" has no install function`)
      return null
    }

    // 记录安装前的 stack 长度，捕获新增的 Layer 对象
    const stackBefore = (pluginApp as unknown as { stack: unknown[] }).stack.length
    const pluginCtx = getSharedPluginCtx()

    // 记录当前安装中的插件，使 registerService 能准确归属（并行加载时避免串抢）
    currentInstallingPlugin = name
    try {
      await install(pluginCtx)
    } finally {
      currentInstallingPlugin = null
    }

    // 归属 install 期间注册的服务：registerService 已直接归属当前插件，
    // 此处兜底处理极少数在 install 之外注册的占位符（___loading___）
    const registeredServices: string[] = []
    for (const [svcName, owner] of serviceRegistry) {
      if (owner === '___loading___') {
        serviceRegistry.set(svcName, name)
        registeredServices.push(svcName)
      } else if (owner === name) {
        registeredServices.push(svcName)
      }
    }

    const layers = (pluginApp as unknown as { stack: unknown[] }).stack.slice(stackBefore)

    // 解析 frontend 子路径导出
    let frontendPath: string | null = null
    if (pkg.exports?.['./frontend']) {
      frontendPath = pkg.exports['./frontend']
    }

    const instance: PluginInstance = {
      name,
      rootDir,
      frontendPath,
      local: isLocalPlugin(rootDir),
      source: isLocalPlugin(rootDir) ? 'local' : 'npm',
      layers,
      registeredServices,
    }

    log('INFO', 'Plugin', `Plugin "${name}" loaded from ${rootDir}`)
    return instance
  } catch (err: unknown) {
    // install 抛异常时，清理当前插件注册的占位符/服务（含并行加载竞态兜底）
    for (const [svcName, owner] of serviceRegistry) {
      if (owner === '___loading___' || owner === name) {
        delete (_sharedPluginCtx as any)?.[svcName]
        serviceRegistry.delete(svcName)
      }
    }
    const message = err instanceof Error ? err.message : String(err)
    log('ERROR', 'Plugin', `Plugin "${name}" failed: ${message}`)
    return null
  }
}

/** 卸载单个插件：移除路由层 + 清除模块缓存 + 停止文件监视 + 清理服务 */
function unloadPlugin(instance: PluginInstance): void {
  // 停止文件监视（防止旧 watcher 在重载后继续触发）
  stopWatching(instance)

  const stack = (pluginApp as unknown as { stack: unknown[] }).stack

  // 从 pluginApp.stack 中移除该插件的路由层
  for (const layer of instance.layers) {
    const idx = stack.indexOf(layer)
    if (idx !== -1) {
      stack.splice(idx, 1)
    }
  }

  // 清除 Node.js 模块缓存（CJS）
  clearModuleCache(instance.rootDir)

  // 清理 ctx 上的自定义服务和注册表记录
  for (const svcName of instance.registeredServices) {
    delete (_sharedPluginCtx as any)?.[svcName]
    serviceRegistry.delete(svcName)
  }

  log('INFO', 'Plugin', `Plugin "${instance.name}" unloaded`)
}

/** 重载单个插件 */
async function reloadPlugin(instance: PluginInstance): Promise<PluginInstance | null> {
  // 防止并发重载（tsc 写入多个文件会触发多次 watch 回调）
  if (instance.reloading) {
    log('INFO', 'Plugin', `Plugin "${instance.name}" reload already in progress, skipping`)
    return null
  }
  instance.reloading = true

  try {
    log('INFO', 'Plugin', `Reloading plugin "${instance.name}"...`)

    // 1. 卸载旧版本
    unloadPlugin(instance)

    // 2. 从 loadedPlugins 中移除旧实例
    const idx = loadedPlugins.indexOf(instance)
    if (idx !== -1) {
      loadedPlugins.splice(idx, 1)
    }

    // 3. 重新装载（通过临时副本绕过缓存）
    const newInstance = await loadSinglePlugin(instance.name, instance.rootDir, true)

    if (newInstance) {
      // 4. 替换到 loadedPlugins 中（保持原位置）
      if (idx !== -1) {
        loadedPlugins.splice(idx, 0, newInstance)
      } else {
        loadedPlugins.push(newInstance)
      }

      // 5. 重新启动文件监视
      if (newInstance.local) {
        startWatching(newInstance)
      }

      log('INFO', 'Plugin', `Plugin "${instance.name}" reloaded`)
    } else {
      log('ERROR', 'Plugin', `Plugin "${instance.name}" reload failed — plugin removed`)
    }

    return newInstance
  } finally {
    instance.reloading = false
  }
}

// ==================== 文件监视（热重载） ====================

/** 对本地插件启动 dist/ 目录监视 */
function startWatching(instance: PluginInstance): void {
  if (!instance.local) return

  const distDir = path.join(instance.rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    log('WARNING', 'Plugin', `Plugin "${instance.name}" dist/ not found, skipping watch`)
    return
  }

  try {
    const watcher = fs.watch(distDir, { persistent: false }, (_eventType, filename) => {
      // 只对 .js 文件变更做出反应
      if (!filename || !filename.endsWith('.js')) return
      // 正在重载中则跳过（防抖定时器会处理后续变化）
      if (instance.reloading) return

      // 防抖：清除旧定时器，设置新的 500ms 延迟
      if (instance.reloadTimer) {
        clearTimeout(instance.reloadTimer)
      }
      instance.reloadTimer = setTimeout(() => {
        reloadPlugin(instance)
      }, 500)
    })

    instance.watcher = watcher
    log('INFO', 'Plugin', `Watching "${instance.name}" dist/ for changes`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log('ERROR', 'Plugin', `Failed to watch "${instance.name}": ${message}`)
  }
}

/** 停止单个插件的文件监视 */
function stopWatching(instance: PluginInstance): void {
  if (instance.watcher) {
    instance.watcher.close()
    instance.watcher = undefined
  }
  if (instance.reloadTimer) {
    clearTimeout(instance.reloadTimer)
    instance.reloadTimer = undefined
  }
}

// ==================== 依赖拓扑排序 ====================

/**
 * 从 config.yml 收集所有已启用插件的清单（含依赖声明）。
 * 返回的 manifests 顺序不确定，需交由 toposort 排序。
 */
function collectManifests(): PluginManifest[] {
  const config = getConfig()
  const pluginsCfg: Record<string, unknown> = config.plugins || {}

  const manifests: PluginManifest[] = []

  for (const [name, cfg] of Object.entries(pluginsCfg)) {
    if (typeof cfg !== 'object' || cfg === null) continue
    if ((cfg as Record<string, unknown>).enabled === false) continue

    const rootDir = resolvePluginRoot(name)
    if (!rootDir) {
      log('INFO', 'Plugin', `Plugin "${name}" not found in node_modules or plugins/`)
      continue
    }

    let dependsOn: string[] = []
    try {
      const pkg = require(path.join(rootDir, 'package.json')) as {
        fileManagerPlugin?: PluginManifestConfig
      }
      dependsOn = pkg.fileManagerPlugin?.dependsOn ?? []
    } catch {
      /* package.json 读取失败则视为无依赖 */
    }

    manifests.push({ name, rootDir, dependsOn })
  }

  return manifests
}

/**
 * Kahn 算法 BFS 分层拓扑排序。
 *
 * @returns order - 按批次排列的加载顺序，同一批次内插件互不依赖，可并行加载
 *          errors - 缺失依赖、循环依赖等错误信息
 */
function toposort(manifests: PluginManifest[]): {
  order: PluginManifest[][]
  errors: string[]
} {
  const errors: string[] = []
  const nameSet = new Set(manifests.map((m) => m.name))

  // 检查缺失依赖
  for (const m of manifests) {
    for (const dep of m.dependsOn) {
      if (!nameSet.has(dep)) {
        errors.push(`Plugin "${m.name}" depends on "${dep}", which is not enabled or not found`)
      }
    }
  }

  // 计算入度（仅统计已启用的依赖）
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>() // dep → 谁依赖它

  for (const m of manifests) {
    const validDeps = m.dependsOn.filter((d) => nameSet.has(d))
    inDegree.set(m.name, validDeps.length)
    for (const dep of validDeps) {
      if (!dependents.has(dep)) dependents.set(dep, [])
      dependents.get(dep)!.push(m.name)
    }
  }

  // BFS 分层
  const order: PluginManifest[][] = []
  const nameToManifest = new Map(manifests.map((m) => [m.name, m]))
  const queue = manifests.filter((m) => inDegree.get(m.name) === 0)

  while (queue.length > 0) {
    order.push([...queue])
    const next: PluginManifest[] = []
    for (const m of queue) {
      for (const depOf of dependents.get(m.name) ?? []) {
        const newDeg = (inDegree.get(depOf) ?? 1) - 1
        inDegree.set(depOf, newDeg)
        if (newDeg === 0) {
          next.push(nameToManifest.get(depOf)!)
        }
      }
    }
    queue.length = 0
    queue.push(...next)
  }

  // 检测循环依赖
  if (order.flat().length < manifests.length) {
    const stuck = manifests.filter((m) => inDegree.get(m.name)! > 0)
    errors.push(`Circular dependency detected among: ${stuck.map((m) => m.name).join(', ')}`)
  }

  return { order, errors }
}

// ==================== 全量加载 ====================

export async function loadPlugins(): Promise<void> {
  const manifests = collectManifests()
  if (manifests.length === 0) return

  const { order, errors } = toposort(manifests)
  for (const err of errors) {
    log('ERROR', 'Plugin', err)
  }

  for (const batch of order) {
    // 同一批次内插件互不依赖，可并行加载
    const results = await Promise.all(batch.map((m) => loadSinglePlugin(m.name, m.rootDir)))
    for (const instance of results) {
      if (instance) {
        loadedPlugins.push(instance)
      }
    }
  }
}

// ==================== 运行时加载/卸载 ====================

/** 运行时加载单个插件（通过 API 触发），自动持久化到 config.yml */
export async function loadPlugin(name: string): Promise<LoadedPlugin | null> {
  // 检查是否已加载
  const existing = loadedPlugins.find((p) => p.name === name)
  if (existing) {
    log('WARNING', 'Plugin', `Plugin "${name}" is already loaded`)
    return null
  }

  const rootDir = resolvePluginRoot(name)
  if (!rootDir) {
    log('WARNING', 'Plugin', `Plugin "${name}" not found in node_modules or plugins/`)
    return null
  }

  // 检查依赖是否已加载
  let dependsOn: string[] = []
  try {
    const pkg = require(path.join(rootDir, 'package.json')) as {
      fileManagerPlugin?: PluginManifestConfig
    }
    dependsOn = pkg.fileManagerPlugin?.dependsOn ?? []
  } catch {
    /* ignore */
  }

  for (const dep of dependsOn) {
    if (!loadedPlugins.find((p) => p.name === dep)) {
      log('ERROR', 'Plugin', `Cannot load "${name}": dependency "${dep}" is not loaded`)
      return null
    }
  }

  const instance = await loadSinglePlugin(name, rootDir)
  if (!instance) return null

  loadedPlugins.push(instance)

  // 本地插件启动文件监视
  if (instance.local) {
    startWatching(instance)
  }

  // 持久化：在 config.yml 中启用该插件并写入 source
  try {
    updatePluginConfig(name, { enabled: true, source: instance.source })
  } catch (err) {
    log('ERROR', 'Plugin', `Failed to update config for "${name}": ${err}`)
  }

  return {
    name: instance.name,
    rootDir: instance.rootDir,
    local: instance.local,
    source: instance.source,
    frontendPath: instance.frontendPath,
  }
}

/** 运行时卸载单个插件（通过 API 触发），自动持久化到 config.yml */
export function unloadPluginByName(name: string): boolean {
  const idx = loadedPlugins.findIndex((p) => p.name === name)
  if (idx === -1) {
    log('WARNING', 'Plugin', `Plugin "${name}" is not loaded`)
    return false
  }

  const instance = loadedPlugins[idx]
  unloadPlugin(instance)
  loadedPlugins.splice(idx, 1)

  // 持久化：在 config.yml 中禁用该插件
  try {
    updatePluginConfig(name, { enabled: false })
  } catch (err) {
    log('ERROR', 'Plugin', `Failed to update config for "${name}": ${err}`)
  }

  return true
}

// ==================== 监视入口 ====================

/**
 * 启动所有本地插件的文件监视（热重载）。
 * 应在服务器启动后调用。
 */
export function startPluginWatchers(): void {
  for (const instance of loadedPlugins) {
    if (instance.local) {
      startWatching(instance)
    }
  }
}

/**
 * 停止所有插件的文件监视。
 * 应在服务器关闭前调用以释放资源。
 */
export function stopAllWatchers(): void {
  for (const instance of loadedPlugins) {
    stopWatching(instance)
  }
}

/**
 * 读取插件的 fileManagerPlugin 清单配置。
 * 用于安装时获取 config schema 和依赖声明。
 */
export function getPluginManifestConfig(rootDir: string): PluginManifestConfig {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(path.join(rootDir, 'package.json'))
    return pkg.fileManagerPlugin ?? {}
  } catch {
    return {}
  }
}

// ==================== 查询 ====================

/** 获取已加载的插件列表（供路由使用） */
export function getLoadedPlugins(): LoadedPlugin[] {
  return loadedPlugins.map(({ name, rootDir, local, source, frontendPath }) => ({
    name,
    rootDir,
    local,
    source,
    frontendPath,
  }))
}

/** 获取 config.yml 中所有插件及其启用状态（含未加载的） */
export function getAllPluginInfos(): PluginInfo[] {
  const config = getConfig()
  const pluginsCfg: Record<string, unknown> = config.plugins || {}

  return Object.entries(pluginsCfg)
    .filter(([, cfg]) => typeof cfg === 'object' && cfg !== null)
    .map(([name, cfg]) => {
      const cfgObj = cfg as Record<string, unknown>
      const enabled = cfgObj.enabled !== false
      const instance = loadedPlugins.find((p) => p.name === name)
      // 已加载的直接取 local/source，未加载的从 config 读取或推断
      const local = instance
        ? instance.local
        : (() => {
            const r = resolvePluginRoot(name)
            return r ? isLocalPlugin(r) : false
          })()
      // source: 优先读 config 中的持久化值，其次从 local 推断
      const source: 'local' | 'npm' =
        cfgObj.source === 'local' || cfgObj.source === 'npm'
          ? cfgObj.source
          : local
            ? 'local'
            : 'npm'
      return {
        name,
        enabled,
        local,
        source,
        frontendPath: instance?.frontendPath ?? null,
      }
    })
}
