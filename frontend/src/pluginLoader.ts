/**
 * 前端插件加载器 — 运行时动态加载插件前端模块
 *
 * 从后端 /api/plugins 获取已启用插件列表，逐个 import() 并调用 install(ctx)。
 * 插件前端模块必须是零外部依赖的独立 JS 文件（所有依赖通过 ctx 获取）。
 */

import { ctx } from '@/context'

interface PluginInfo {
  name: string
  frontendPath: string | null
}

export async function initPlugins(): Promise<void> {
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
        // @vite-ignore: 运行时动态 import，URL 指向后端静态资源
        const mod = await import(/* @vite-ignore */ plugin.frontendPath)

        const install =
          mod.install ||
          (typeof mod.default === 'function' ? mod.default : null) ||
          mod.default?.install

        if (typeof install === 'function') {
          await install(ctx)
          console.log(`[Plugin] ${plugin.name} loaded`)
        } else {
          console.warn(`[Plugin] ${plugin.name} has no install function`)
        }
      } catch (err) {
        console.error(`[Plugin] ${plugin.name} failed:`, err)
      }
    }
  } catch (err) {
    console.warn('[Plugin] Failed to fetch plugin list:', err)
  }
}
