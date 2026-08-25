export function install(ctx) {
  // 注册路由与主题（平台经包装 ctx 收集）
  ctx.router.addRoute({ path: '/plugin/x', component: {}, meta: { requiresAuth: true } })
  ctx.composables.useTheme().registerTheme({ name: 'midnight', label: '午夜', className: 'midnight' })
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginTears = globalThis.__pluginTears || []
  globalThis.__pluginCalls.push('route-theme-install')
  return () => {
    globalThis.__pluginTears.push('route-theme-teardown')
  }
}