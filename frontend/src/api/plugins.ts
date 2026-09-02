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
  /** 插件声明的前端配置页路由路径（无独立页面为 null） */
  frontendPage: string | null
  /** package.json 中的版本号（读取失败为 null） */
  version: string | null
  /** 要求的主项目最低版本（语义化范围字符串，未声明为 null） */
  minHostVersion?: string | null
  /** 依赖插件版本校验问题列表 */
  dependencyIssues?: Array<{
    name: string
    required?: string
    current: string | null
    status: 'missing' | 'disabled' | 'not-started' | 'mismatch'
  }>
  /** 是否兼容当前主项目与依赖（无硬阻塞为 true） */
  compatible?: boolean
  /** 兼容性软提示（仍允许加载）：仅宿主版本偏低 / 仅依赖版本偏低时的告警文案，否则 null */
  compatibilityWarning?: string | null
}

export interface NpmSearchResult {
  name: string
  version: string
  description: string
  publisher: string
  date: string
  links: { npm: string; repository?: string; homepage?: string }
}

export interface NpmSearchResponse {
  total: number
  results: NpmSearchResult[]
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

export function searchPlugins(query: string, page = 1, pageSize = 20): Promise<NpmSearchResponse> {
  return api
    .get('/plugins/search', { params: { q: query, page, pageSize } })
    .then((res) => res.data)
}

export interface PluginVersions {
  versions: string[]
  latest: string
}

export function getPluginVersions(packageName: string): Promise<PluginVersions> {
  return api.get('/plugins/versions', { params: { name: packageName } }).then((res) => res.data)
}

/** 安装任务状态 */
export type InstallTaskStatus = 'running' | 'success' | 'failed' | 'terminated'

export interface InstallTaskInfo {
  id: string
  packageName: string
  status: InstallTaskStatus
  startedAt: number
}

export interface InstallLogResult {
  id: string
  packageName: string
  status: InstallTaskStatus
  exitCode: number | null
  /** 已读行数（下次轮询的 offset） */
  offset: number
  lines: string[]
}

/**
 * 安装插件。不设请求超时（安装无自动超时，进度通过 install-log 轮询观察，
 * 用户可手动终止）；taskId 由调用方预生成，用于请求发出后立即轮询日志。
 */
export function installPlugin(
  packageName: string,
  version?: string,
  force?: boolean,
  taskId?: string
): Promise<PluginInfo> {
  return api
    .post('/plugins/install', { packageName, version, force, taskId }, { timeout: 0 })
    .then((res) => res.data)
}

/** 活跃/近期安装任务列表（页面刷新后恢复安装面板用） */
export function getInstallTasks(): Promise<InstallTaskInfo[]> {
  return api.get('/plugins/install-tasks').then((res) => res.data)
}

/** 增量拉取安装日志 */
export function getInstallLog(taskId: string, offset = 0): Promise<InstallLogResult> {
  return api
    .get(`/plugins/install-log/${encodeURIComponent(taskId)}`, { params: { offset } })
    .then((res) => res.data)
}

/** 手动终止进行中的安装 */
export function terminateInstall(taskId: string): Promise<void> {
  return api
    .post(`/plugins/install-log/${encodeURIComponent(taskId)}/terminate`)
    .then((res) => res.data)
}

export function deletePlugin(name: string, clearData = false): Promise<void> {
  return api
    .delete(`/plugins/${name}`, { params: { clearData: clearData ? 1 : 0 } })
    .then((res) => res.data)
}
