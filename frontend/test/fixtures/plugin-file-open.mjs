export function install(ctx) {
  // 注册文件打开 handler（平台经包装 ctx 收集注销函数，卸载时兜底注销）
  ctx.platform.fileOpen.register({
    id: 'demo-viewer',
    canOpen: () => false,
    open: () => {},
  })
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginCalls.push('file-open-install')
  return () => {
    globalThis.__pluginTears = globalThis.__pluginTears || []
    globalThis.__pluginTears.push('file-open-teardown')
  }
}
