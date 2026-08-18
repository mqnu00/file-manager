/**
 * file-image-viewer 内联的注册表对接（契约见 file-viewer README）。
 */

export interface FileViewerModule {
  id: string
  label: string
  extensions: string[]
  editable: boolean
  component: unknown
}

export interface FileViewerRegistry {
  register(module: FileViewerModule): () => void
}

export const GLOBAL_REGISTRY_KEY = '__fm_file_viewer_registry__'

/** 获取 file-viewer 核心的全局查看器注册表（未安装核心返回 null） */
export function getRegistry(): FileViewerRegistry | null {
  const g = globalThis as Record<string, unknown>
  const reg = g[GLOBAL_REGISTRY_KEY] as FileViewerRegistry | undefined
  if (reg && typeof reg.register === 'function') return reg
  return null
}