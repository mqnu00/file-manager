export default function install(ctx) {
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginCalls.push('default-fn')
}
