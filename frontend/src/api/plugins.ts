/**
 * 插件 API — 获取已启用的插件列表
 */

import api from './index'

export interface PluginInfo {
  name: string
  frontendPath: string | null
}

export function getPlugins(): Promise<PluginInfo[]> {
  return api.get('/plugins').then((res) => res.data)
}
