/**
 * 插件加载器 — 运行时发现并加载插件
 *
 * 从 config.yml 的 plugins 段读取启用列表，按优先级查找插件包：
 *   1. node_modules/{name}
 *   2. plugins/{name}
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
import { getConfig, updatePluginConfig } from '../config'
import { createScriptContext } from '../context'
import { pluginApp } from '../app'
import { log } from '../utils/logger'
import type { BackendPluginContext, PluginInstallFunction, LoadedPlugin, PluginInfo } from './types'

// ==================== 内部类型 ====================

interface PluginInstance {
  name: string
  rootDir: string
  frontendPath: string | null
  /** 是否来自 plugins/ 目录（本地开发），支持热重载 */
  local: boolean
  /** install() 后在 pluginApp.stack 中新增的 Layer 对象 */
  layers: unknown[]
  /** fs.watch 监视器 */
  watcher?: fs.FSWatcher
  /** 防抖重载定时器 */
  reloadTimer?: ReturnType<typeof setTimeout>
  /** 是否正在重载中（防止并发重载导致重复条目） */
  reloading?: boolean
}

// ==================== 状态 ====================

const loadedPlugins: PluginInstance[] = []

// ==================== 解析 ====================

/** 查找插件包的根目录（package.json 所在目录） */
function resolvePluginRoot(name: string): string | null {
  const projectRoot = path.resolve(__dirname, '..', '..', '..')

  // 1. 优先 node_modules
  try {
    return path.dirname(
      require.resolve(name + '/package.json', { paths: [projectRoot] })
    )
  } catch { /* 不在 node_modules */ }

  // 2. 回退 plugins/ 开发目录
  try {
    return path.dirname(
      require.resolve(
        path.join(projectRoot, 'plugins', name, 'package.json'),
        { paths: [projectRoot] }
      )
    )
  } catch { /* 不在 plugins */ }

  return null
}

/** 判断 rootDir 是否为本地开发插件 */
function isLocalPlugin(rootDir: string): boolean {
  return !rootDir.includes('node_modules')
}

// ==================== 辅助 ====================

/** 从模块导出中提取 install 函数，支持多种导出模式 */
function getInstallFn(mod: Record<string, unknown>): PluginInstallFunction | null {
  if (typeof mod.install === 'function') return mod.install as PluginInstallFunction
  if (typeof mod.default === 'function') return mod.default as PluginInstallFunction
  if (mod.default && typeof (mod.default as Record<string, unknown>).install === 'function') {
    return (mod.default as Record<string, unknown>).install as PluginInstallFunction
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
    const pkg: { main?: string; exports?: Record<string, string> } =
      require(path.join(rootDir, 'package.json'))
    const entryRel = pkg.main || 'dist/backend.js'
    const entryAbs = path.resolve(rootDir, entryRel)

    // 导入模块
    let mod: Record<string, unknown>
    if (cacheBust) {
      // 热重载：将入口文件复制到临时目录并用 require 加载
      // 由于临时路径唯一，绕过所有 Node.js / ts-node 模块缓存
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'))
      const tmpFile = path.join(tmpDir, path.basename(entryAbs))
      fs.copyFileSync(entryAbs, tmpFile)
      mod = require(tmpFile)
      fs.unlinkSync(tmpFile)
      fs.rmdirSync(tmpDir)
    } else {
      // 首次加载：走目录导入
      mod = await import(rootDir)
    }

    const install = getInstallFn(mod)

    if (!install) {
      log('WARNING', 'Plugin', `Plugin "${name}" has no install function`)
      return null
    }

    // 记录安装前的 stack 长度，捕获新增的 Layer 对象
    const stackBefore = (pluginApp as unknown as { stack: unknown[] }).stack.length
    const baseCtx = createScriptContext()
    const pluginCtx: BackendPluginContext = { ...baseCtx, app: pluginApp }
    await install(pluginCtx)
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
      layers,
    }

    log('INFO', 'Plugin', `Plugin "${name}" loaded from ${rootDir}`)
    return instance
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log('ERROR', 'Plugin', `Plugin "${name}" failed: ${message}`)
    return null
  }
}

/** 卸载单个插件：移除路由层 + 清除模块缓存 + 停止文件监视 */
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

// ==================== 全量加载 ====================

export async function loadPlugins(): Promise<void> {
  const config = getConfig()
  const pluginsCfg: Record<string, unknown> = config.plugins || {}

  for (const [name, cfg] of Object.entries(pluginsCfg)) {
    // 跳过非对象配置（如字符串值）或明确禁用的插件
    if (typeof cfg !== 'object' || cfg === null) continue
    if ((cfg as Record<string, unknown>).enabled === false) continue

    const rootDir = resolvePluginRoot(name)
    if (!rootDir) {
      log('INFO', 'Plugin', `Plugin "${name}" not found in node_modules or plugins/`)
      continue
    }

    const instance = await loadSinglePlugin(name, rootDir)
    if (instance) {
      loadedPlugins.push(instance)
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

  const instance = await loadSinglePlugin(name, rootDir)
  if (!instance) return null

  loadedPlugins.push(instance)

  // 本地插件启动文件监视
  if (instance.local) {
    startWatching(instance)
  }

  // 持久化：在 config.yml 中启用该插件
  try {
    updatePluginConfig(name, { enabled: true })
  } catch (err) {
    log('ERROR', 'Plugin', `Failed to update config for "${name}": ${err}`)
  }

  return {
    name: instance.name,
    rootDir: instance.rootDir,
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

// ==================== 查询 ====================

/** 获取已加载的插件列表（供路由使用） */
export function getLoadedPlugins(): LoadedPlugin[] {
  return loadedPlugins.map(({ name, rootDir, frontendPath }) => ({
    name,
    rootDir,
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
      return {
        name,
        enabled,
        frontendPath: instance?.frontendPath ?? null,
      }
    })
}
