export function install() {
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginTears = globalThis.__pluginTears || []
  globalThis.__pluginCalls.push('install-with-teardown')
  // teardown 契约：返回撤销函数
  return () => {
    globalThis.__pluginTears.push('teardown')
  }
}