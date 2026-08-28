/**
 * 前端插件加载器 — 运行时动态加载插件前端模块
 *
 * 从后端 /api/plugins 获取已启用插件列表，逐个 import() 并调用 install(ctx)。
 * 插件前端模块必须是零外部依赖的独立 JS 文件（所有依赖通过 ctx 获取）。
 *
 * ── 生命周期契约 ──
 * install(ctx) 可返回 teardown 函数（撤销 install 期间产生的全局副作用）。
 * 平台额外自动收集两类资源，卸载时统一清理：
 *   - ctx.router.addRoute 注册的路由（记录其返回的移除函数）
 *   - ctx.composables.useTheme().registerTheme 注册的主题（逐个反注册）
 * unloadPluginFrontend(name) 按「路由 → 主题 → 插件 teardown」顺序清理，
 * 任一步骤失败仅记录日志，不阻断其余步骤。
 * 重载 = 先完整卸载再重新 install；同一插件重复加载自动先卸载旧实例。
 */

import { ctx, type PluginRouteRecord, type ScriptContext } from '@/context'
import { useTheme, type ThemeDefinition } from '@/composables/useTheme'
import type { FileOpenHandler } from '@/platform/fileOpen'
import { createPluginDataApi, type PluginDataApi } from '@/api/pluginData'
import { DEMO_PLUGINS } from '@/demo/plugins'

interface PluginInfo {
  name: string
  frontendPath: string | null
}

/** 插件 teardown 契约：撤销 install 期间的全局副作用（与 plugin-design.md 一致） */
export type PluginTeardown = () => void | Promise<void>

/** 平台侧记录的单个前端插件实例资源 */
interface FrontendPluginRecord {
  name: string
  /** install 返回的 teardown（可缺省 = 插件声明无全局副作用） */
  teardown?: PluginTeardown
  /** ctx.router.addRoute 返回的移除函数（平台收集） */
  removeRoutes: Array<() => void>
  /** 经 ctx.composables.useTheme().registerTheme 注册的主题名（平台收集） */
  themeNames: string[]
  /** 经 ctx.platform.fileOpen.register 注册的 handler 注销函数（平台收集） */
  removeFileOpenHandlers: Array<() => void>
  /** 绑定到本插件的 pluginData 实例（缓存，避免每次访问重建） */
  pluginData?: PluginDataApi
}

/** 已安装的前端插件实例（name → record） */
const loadedFrontend = new Map<string, FrontendPluginRecord>()

/**
 * 包装插件 ctx：拦截 router.addRoute 与 useTheme().registerTheme，
 * 把插件注册的路由/主题记录进 record，卸载时由平台统一清理。
 * 其余能力原样透传（同一底层 ctx，插件不感知包装）。
 */
export function wrapPluginContext(record: FrontendPluginRecord): ScriptContext {
  return new Proxy(ctx, {
    get(target, prop, receiver) {
      if (prop === 'router') {
        const r = target.router
        return {
          ...r,
          addRoute: (route: PluginRouteRecord) => {
            const remove = r.addRoute(route)
            record.removeRoutes.push(remove)
            return remove
          },
        }
      }
      if (prop === 'composables') {
        const c = target.composables
        return {
          ...c,
          useTheme: () => {
            const theme = c.useTheme()
            return {
              ...theme,
              registerTheme: (def: ThemeDefinition) => {
                record.themeNames.push(def.name)
                theme.registerTheme(def)
              },
            }
          },
        }
      }
      if (prop === 'platform') {
        const p = target.platform
        // 旧版 ctx / 测试 mock 未提供 platform 时原样透传，不抛错
        if (!p?.fileOpen) return p ?? {}
        return {
          ...p,
          fileOpen: {
            ...p.fileOpen,
            register: (handler: FileOpenHandler) => {
              const unregister = p.fileOpen.register(handler)
              record.removeFileOpenHandlers.push(unregister)
              return unregister
            },
          },
        }
      }
      if (prop === 'pluginData') {
        // 绑定到当前插件名的数据存储（缓存于 record，按 name 隔离）
        if (!record.pluginData) {
          record.pluginData = createPluginDataApi(record.name)
        }
        return record.pluginData
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as ScriptContext
}

/** 执行单个记录的全部清理（路由 → 主题 → teardown），任一步骤失败不阻断后续 */
async function unloadRecord(record: FrontendPluginRecord): Promise<void> {
  for (const remove of record.removeRoutes) {
    try {
      remove()
    } catch (e) {
      console.error(`[Plugin] ${record.name} 路由清理失败:`, e)
    }
  }
  for (const themeName of record.themeNames) {
    try {
      useTheme().unregisterTheme(themeName)
    } catch (e) {
      console.error(`[Plugin] ${record.name} 主题清理失败:`, e)
    }
  }
  for (const remove of record.removeFileOpenHandlers) {
    try {
      remove()
    } catch (e) {
      console.error(`[Plugin] ${record.name} 文件打开 handler 清理失败:`, e)
    }
  }
  if (record.teardown) {
    try {
      await record.teardown()
    } catch (e) {
      console.error(`[Plugin] ${record.name} teardown 执行失败:`, e)
    }
  }
}

/**
 * 卸载前端插件实例（幂等）：移除平台收集的路由与主题，并调用插件 teardown。
 * 已卸载/未加载的插件为 no-op。
 */
export async function unloadPluginFrontend(name: string): Promise<void> {
  const record = loadedFrontend.get(name)
  if (!record) return
  loadedFrontend.delete(name)
  await unloadRecord(record)
  console.log(`[Plugin] ${name} frontend unloaded`)
}

/**
 * 加载前端插件模块并调用 install(ctx)。
 * 同一插件已有实例时先完整卸载再安装（避免路由/监听器/副作用叠加）。
 */
export async function loadPluginFrontend(plugin: PluginInfo, cacheBust = true): Promise<void> {
  if (!plugin.frontendPath) return

  // 幂等：已加载的同名插件先卸载（重载语义 = 先清理再安装）
  await unloadPluginFrontend(plugin.name)

  const record: FrontendPluginRecord = {
    name: plugin.name,
    removeRoutes: [],
    themeNames: [],
    removeFileOpenHandlers: [],
  }
  try {
    // 缓存破坏：安装/切换版本后 URL 不变但内容已变，追加时间戳强制重新请求
    const url = cacheBust
      ? plugin.frontendPath + (plugin.frontendPath.includes('?') ? '&' : '?') + '_t=' + Date.now()
      : plugin.frontendPath
    // @vite-ignore: 运行时动态 import，URL 指向后端静态资源
    const mod = await import(/* @vite-ignore */ url)

    const install =
      mod.install ||
      (typeof mod.default === 'function' ? mod.default : null) ||
      mod.default?.install

    if (typeof install === 'function') {
      const result = await install(wrapPluginContext(record))
      if (typeof result === 'function') {
        record.teardown = result as PluginTeardown
      }
      loadedFrontend.set(plugin.name, record)
      console.log(`[Plugin] ${plugin.name} frontend loaded`)
    } else {
      console.warn(`[Plugin] ${plugin.name} has no install function`)
    }
  } catch (err) {
    // install 中途失败：回滚已收集的路由/主题，避免残留
    await unloadRecord(record).catch(() => {})
    console.error(`[Plugin] ${plugin.name} frontend failed:`, err)
  }
}

/** demo 模式：加载内置静态插件（gh-pages 无后端，跳过 /api/plugins） */
async function loadDemoPlugins(): Promise<void> {
  const base = import.meta.env.BASE_URL

  for (const plugin of DEMO_PLUGINS) {
    await loadPluginFrontend({ name: plugin.name, frontendPath: `${base}${plugin.entry}` }, false)
  }
}

export async function initPlugins(): Promise<void> {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    await loadDemoPlugins()
    return
  }

  try {
    const res = await fetch('/api/plugins')
    if (!res.ok) {
      console.warn('[Plugin] Failed to fetch plugin list:', res.status)
      return
    }

    const plugins: PluginInfo[] = await res.json()

    for (const plugin of plugins) {
      if (!plugin.frontendPath) continue

      try {
        await loadPluginFrontend(plugin, false)
      } catch (err) {
        console.error(`[Plugin] ${plugin.name} failed:`, err)
      }
    }
  } catch (err) {
    console.warn('[Plugin] Failed to fetch plugin list:', err)
  }
}
