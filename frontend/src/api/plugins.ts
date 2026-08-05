/**
 * 插件 API — 获取已启用的插件列表，运行时加载/卸载，npm 搜索/安装/删除
 */

import api from './index'

export interface PluginInfo {
  name: string
  enabled: boolean
  /** 是否来自 plugins/ 本地目录（否则来自 node_modules） */
  local: boolean
  /** 插件来源：local=本地开发目录，npm=node_modules */
  source: 'local' | 'npm'
  frontendPath: string | null
}

export interface NpmSearchResult {
  name: string
  version: string
  description: string
  publisher: string
  date: string
  links: { npm: string; repository?: string; homepage?: string }
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

export function searchPlugins(query: string): Promise<NpmSearchResult[]> {
  return api.get('/plugins/search', { params: { q: query } }).then((res) => res.data)
}

export interface PluginVersions {
  versions: string[]
  latest: string
}

export function getPluginVersions(packageName: string): Promise<PluginVersions> {
  return api.get('/plugins/versions', { params: { name: packageName } }).then((res) => res.data)
}

export function installPlugin(packageName: string, version?: string, force?: boolean): Promise<PluginInfo> {
  return api.post('/plugins/install', { packageName, version, force }).then((res) => res.data)
}

export function deletePlugin(name: string): Promise<void> {
  return api.delete(`/plugins/${name}`).then((res) => res.data)
}
