/**
 * 插件加载器 — 运行时发现并加载插件
 *
 * 从 config.yml 的 plugins 段读取启用列表，按优先级查找插件包：
 *   1. node_modules/{name}
 *   2. plugins/{name}
 *
 * 通过 package.json 的 main/exports 解析入口文件，动态 import 并调用 install(ctx)。
 */

import path from 'path'
import { getConfig } from '../config'
import { createScriptContext } from '../context'
import { pluginApp } from '../app'
import { log } from '../utils/logger'

// ==================== 类型 ====================

export interface LoadedPlugin {
  name: string
  /** package.json 所在目录 */
  rootDir: string
  /** exports["./frontend"] 值，相对于 rootDir */
  frontendPath: string | null
}

// ==================== 状态 ====================

const loadedPlugins: LoadedPlugin[] = []

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

// ==================== 辅助 ====================

/** 从模块导出中提取 install 函数，支持多种导出模式 */
function getInstallFn(mod: any): Function | null {
  if (typeof mod.install === 'function') return mod.install
  if (typeof mod.default === 'function') return mod.default
  if (mod.default && typeof mod.default.install === 'function') {
    return mod.default.install
  }
  return null
}

// ==================== 加载 ====================

export async function loadPlugins(): Promise<void> {
  const config = getConfig()
  const pluginsCfg = (config as any).plugins || {}

  for (const [name, cfg] of Object.entries(pluginsCfg)) {
    // 跳过非对象配置（如字符串值）或明确禁用的插件
    if (typeof cfg !== 'object' || cfg === null) continue
    if ((cfg as any).enabled === false) continue

    const rootDir = resolvePluginRoot(name)
    if (!rootDir) {
      log('INFO', 'Plugin', `Plugin "${name}" not found in node_modules or plugins/`)
      continue
    }

    try {
      // 通过 package.json main/exports["."] 解析入口
      const mod = await import(rootDir)
      const install = getInstallFn(mod)

      if (!install) {
        log('WARNING', 'Plugin', `Plugin "${name}" has no install function`)
        continue
      }

      // 执行插件安装（使用 pluginApp 路由器，确保路由优先于静态文件 catch-all）
      const baseCtx = createScriptContext()
      const pluginCtx = { ...baseCtx, app: pluginApp }
      await install(pluginCtx)

      // 解析 frontend 子路径导出
      let frontendPath: string | null = null
      try {
        const pkg = require(path.join(rootDir, 'package.json'))
        if (pkg.exports?.['./frontend']) {
          frontendPath = pkg.exports['./frontend']
        }
      } catch { /* package.json 无 exports 字段 */ }

      loadedPlugins.push({ name, rootDir, frontendPath })
      log('INFO', 'Plugin', `Plugin "${name}" loaded from ${rootDir}`)
    } catch (err: any) {
      log('ERROR', 'Plugin', `Plugin "${name}" failed: ${err.message}`)
    }
  }
}

// ==================== 查询 ====================

/** 获取已加载的插件列表（供路由使用） */
export function getLoadedPlugins(): LoadedPlugin[] {
  return [...loadedPlugins]
}
