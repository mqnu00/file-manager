/**
 * file-viewer 前端状态：已注册查看器 + 映射/默认查看器缓存
 *
 * 子插件经后端 `file-viewer:viewers` 注册服务报备能力；前端从
 * `GET /api/file-viewer/viewers` 拉取（含配置表映射），缓存于此，供
 * fileOpen 的 canOpen/open 与配置页使用。配置保存后 refreshViewers 重新拉取。
 *
 * 注意：本模块不引入 vue —— file-viewer 包为纯 CJS（后端 + 前端 esbuild 打包），
 * 不能直接依赖 vue。状态用普通导出变量，配置页拷贝到局部 ref 使用。
 */

import type { ViewerMeta } from './types'

/** 已注册查看器（id/label/默认扩展名/路由） */
export let viewers: ViewerMeta[] = []
/** config.yml 扩展名→查看器映射（小写后缀） */
export let extensionMappings: Record<string, string> = {}
/** 默认查看器 id（空串表示未设置） */
export let defaultViewer = ''

/** 最小 HTTP 客户端（兼容 axios 实例） */
interface HttpLike {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
}

/** 从后端拉取查看器列表 + 映射配置，更新缓存 */
export async function refreshViewers(http: HttpLike): Promise<void> {
  const r = await http.get<{
    viewers: ViewerMeta[]
    extensionMappings: Record<string, string>
    defaultViewer: string
  }>('/file-viewer/viewers')
  viewers = r.data.viewers ?? []
  extensionMappings = r.data.extensionMappings ?? {}
  defaultViewer = r.data.defaultViewer ?? ''
}

/** 文件名的扩展名（小写、不含点；无点返回 ''） */
export function normExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

/** 该扩展名是否可打开（映射命中或某查看器默认扩展名包含） */
export function canOpenExt(ext: string): boolean {
  if (!ext) return false
  const mapped = extensionMappings[ext]
  if (mapped && viewers.some((v) => v.id === mapped)) return true
  return viewers.some((v) => v.defaultExtensions.includes(ext))
}

/** 解析某扩展名的最佳查看器（映射 > 默认扩展名命中 > 默认查看器） */
export function resolveViewer(ext: string): ViewerMeta | null {
  if (!ext) return null
  const mapped = extensionMappings[ext]
  if (mapped) {
    const v = viewers.find((x) => x.id === mapped)
    if (v) return v
  }
  const byExt = viewers.find((v) => v.defaultExtensions.includes(ext))
  if (byExt) return byExt
  if (defaultViewer) {
    const dv = viewers.find((v) => v.id === defaultViewer)
    if (dv) return dv
  }
  return null
}
