export default {
  install(ctx) {
    globalThis.__pluginCalls = globalThis.__pluginCalls || []
    globalThis.__pluginCalls.push('default-install')
  },
}
