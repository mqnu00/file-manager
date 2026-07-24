/**
 * 插件 API — 获取已启用的插件列表，运行时加载/卸载
 */

import api from './index'

export interface PluginInfo {
  name: string
  enabled: boolean
  /** 是否来自 plugins/ 本地目录（否则来自 node_modules） */
  local: boolean
  frontendPath: string | null
}

export function getPlugins(): Promise<PluginInfo[]> {
  return api.get('/plugins').then((res) => res.data)
}

export function loadPlugin(name: string): Promise<PluginInfo> {
  return api.post('/plugins/load', { name }).then((res) => res.data)
}

export function unloadPlugin(name: string): Promise<void> {
  return api.post(`/plugins/${name}/unload`).then((res) => res.data)
}
