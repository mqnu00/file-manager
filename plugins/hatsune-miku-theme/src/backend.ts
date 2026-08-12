import type { BackendPluginContext, PluginInstallFunction } from '@mqn00/file-manager/plugin'

/**
 * 初音未来主题插件 — 后端入口
 *
 * 纯前端主题插件：主题由前端 install(ctx) 通过 registerTheme 注册，
 * 后端无需任何功能，仅提供最小入口满足插件加载器要求（package.json main）。
 */
export const install: PluginInstallFunction<BackendPluginContext> = () => {
  // 无后端功能
}
