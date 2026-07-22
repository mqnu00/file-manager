/**
 * Test Plugin — 前端入口
 *
 * 浏览器运行时通过 import() 动态加载，接收 ctx 访问所有前端公共资源。
 * 不得直接 import vue / element-plus —— 所有依赖通过 ctx 获取。
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

export const install: FrontendPluginInstallFunction = (ctx) => {
  const { ElMessage } = ctx.ElementPlus

  ElMessage.success('123Test plugin loaded successfully!')

  console.log('[Test Plugin] Frontend loaded')
  console.log('[Test Plugin] Available ctx keys:', Object.keys(ctx))
}
