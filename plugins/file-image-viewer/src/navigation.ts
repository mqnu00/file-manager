/**
 * 图片查看器导航逻辑（纯函数，可单测）
 *
 * 识别当前文件夹内全部图片、按名称排列、定位当前位置，并在同文件夹
 * 图片间构造上一张/下一张的查看页 URL。
 */

import type { FileItem } from '@mqn00/file-manager/plugin/frontend'

/** 从相对路径取父目录；无分隔符（根目录内文件）返回 '' */
export function parentOf(relPath: string): string {
  const i = relPath.lastIndexOf('/')
  return i > 0 ? relPath.slice(0, i) : ''
}

/** 提取文件名扩展名（小写、不含点）；无扩展名返回 '' */
export function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

/**
 * 从目录条目中筛出图片文件（非目录且扩展名属于 exts）。
 * exts 传入时归一化（小写、去点、去空项），与前端 registry 一致。
 */
export function buildImageList(files: FileItem[], exts: string[]): FileItem[] {
  const set = new Set(exts.map((e) => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean))
  return files.filter((f) => !f.isDirectory && set.has(extOf(f.name)))
}

/** 按名称升序排列（返回新数组，不改原数组） */
export function sortByName(files: FileItem[]): FileItem[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name))
}

/** 定位当前路径在列表中的下标；未命中返回 -1 */
export function currentIndex(files: FileItem[], currentPath: string): number {
  return files.findIndex((f) => f.path === currentPath)
}

/**
 * 构造查看页 URL（仅改 query，保持同一 /plugin/file-viewer/view 路由，
 * 由 file-viewer page 的 parseFromRoute 重渲染）。mode 可选保留。
 */
export function makeViewerUrl(targetPath: string, mode?: string): string {
  const params = new URLSearchParams()
  params.set('path', targetPath)
  if (mode) params.set('mode', mode)
  return `/plugin/file-viewer/view?${params.toString()}`
}

// ==================== 缩略图图库分页 ====================

/**
 * 按页切片（page 从 1 开始；越界/空返回 []）。
 * 分页顺序沿用传入列表顺序（本插件为固定名称升序，与上一张/下一张一致）。
 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const size = Math.max(1, pageSize)
  if (page < 1 || items.length === 0) return []
  const start = (page - 1) * size
  if (start >= items.length) return []
  return items.slice(start, start + size)
}

/** 总页数（至少 1 页，即使无条目） */
export function pageCountOf(total: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  return Math.max(1, Math.ceil(total / size))
}

/** 条目下标所在页码（1-based）；index<0（未定位）返回 1 */
export function pageOf(currentIndex: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  return Math.floor(Math.max(0, currentIndex) / size) + 1
}
