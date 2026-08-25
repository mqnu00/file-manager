export function install() {
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginTears = globalThis.__pluginTears || []
  globalThis.__pluginCalls.push('teardown-throws-install')
  return () => {
    globalThis.__pluginTears.push('teardown-throws')
    throw new Error('teardown boom')
  }
}