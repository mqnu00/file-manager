export function install(ctx) {
  // install 中途注册路由后抛错：平台应回滚已收集的路由
  ctx.router.addRoute({ path: '/plugin/y', component: {} })
  globalThis.__pluginCalls = globalThis.__pluginCalls || []
  globalThis.__pluginCalls.push('throws-after-route')
  throw new Error('boom')
}