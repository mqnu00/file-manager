export function install(ctx) {
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginCtxs = globalThis.__pluginCtxs || []
  globalThis.__pluginCalls.push('install-export')
  globalThis.__pluginCtxs.push(ctx)
}
