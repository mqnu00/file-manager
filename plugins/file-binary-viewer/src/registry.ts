/**
 * file-binary-viewer 内联的小工具：与 file-viewer 核心的 registry 契约对接。
 *
 * 契约文档见 file-viewer 插件 README；子插件为独立 npm 包，故此处重复最小定义，
 * 避免跨包运行时依赖。
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