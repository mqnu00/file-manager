export function install(ctx) {
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginCtxs = globalThis.__pluginCtxs || []
  globalThis.__pluginCalls.push('miku-demo')
  globalThis.__pluginCtxs.push(ctx)
}
