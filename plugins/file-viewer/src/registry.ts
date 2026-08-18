/**
 * file-viewer 查看器注册表（核心分发契约）
 *
 * 核心只做分发：具体查看/编辑模块由子插件（file-code-viewer 等）注册。
 * 注册表挂在 globalThis 上，子插件前端 install() 时调用 register()，
 * 查看页打开时读取（与插件加载顺序解耦）。
 *
 * 为避免插件包产生 vue 运行时依赖，component 用 unknown 声明，
 * 渲染前由页面侧转换为实际组件。
 */

/** 查看器模块（子插件注册的最小单元） */
export interface FileViewerModule {
  /** 模块唯一标识（同时用作 URL query 的 mode 值，如 code/music/video/office/hex） */
  id: string
  /** 下拉显示名，如「代码编辑器」「音乐播放器」 */
  label: string
  /** 支持后缀（小写、不含点）；空数组 = 兜底（未知扩展名的默认查看方式） */
  extensions: string[]
  /** 是否可编辑保存（页面头部据此显示保存按钮） */
  editable: boolean
  /** defineComponent 产物，props: { file: FileItem } */
  component: unknown
}

/** 注册表 API */
export interface FileViewerRegistry {
  /** 注册模块；重复 id 覆盖；返回取消注册函数 */
  register(module: FileViewerModule): () => void
  /** 按 id 取模块 */
  get(id: string): FileViewerModule | null
  /** 当前全部模块（注册顺序） */
  modules(): FileViewerModule[]
  /** 指定扩展名可用的模块：extensions 命中 或 兜底模块（extensions 为空） */
  getApplicable(ext: string): FileViewerModule[]
  /** 指定扩展名的默认模块：首个 extensions 命中的模块；无命中则兜底模块（extensions 为空）；再无则 null */
  getDefault(ext: string): FileViewerModule | null
}

/** globalThis 上的注册表键（便于多插件共享与调试） */
export const GLOBAL_REGISTRY_KEY = '__fm_file_viewer_registry__'

/** 创建独立注册表（纯逻辑，可单测） */
export function createRegistry(): FileViewerRegistry {
  const list: FileViewerModule[] = []

  const isFallback = (m: FileViewerModule) => m.extensions.length === 0

  return {
    register(module) {
      // 注册时归一化扩展名（小写、去点、去空项），与查询侧保持一致
      const normalized: FileViewerModule = {
        ...module,
        extensions: module.extensions
          .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
          .filter(Boolean),
      }
      const idx = list.findIndex((m) => m.id === normalized.id)
      if (idx >= 0) {
        list[idx] = normalized
      } else {
        list.push(normalized)
      }
      return () => {
        const i = list.findIndex((m) => m.id === normalized.id)
        if (i >= 0) list.splice(i, 1)
      }
    },

    get(id) {
      return list.find((m) => m.id === id) ?? null
    },

    modules() {
      return [...list]
    },

    getApplicable(ext) {
      const key = (ext || '').toLowerCase().replace(/^\./, '')
      return list.filter((m) => m.extensions.includes(key) || isFallback(m))
    },

    getDefault(ext) {
      const key = (ext || '').toLowerCase().replace(/^\./, '')
      const hit = list.find((m) => m.extensions.includes(key))
      if (hit) return hit
      return list.find(isFallback) ?? null
    },
  }
}

/** 获取全局注册表（未初始化返回 null） */
export function getRegistry(): FileViewerRegistry | null {
  return (globalThis as Record<string, unknown>)[GLOBAL_REGISTRY_KEY] as
    | FileViewerRegistry
    | undefined ?? null
}

/** 初始化/获取全局注册表（幂等，重复调用复用同一实例） */
export function initRegistry(): FileViewerRegistry {
  const g = globalThis as Record<string, unknown>
  const existing = g[GLOBAL_REGISTRY_KEY] as FileViewerRegistry | undefined
  if (existing && typeof existing.register === 'function' && typeof existing.getDefault === 'function') {
    return existing
  }
  const registry = createRegistry()
  g[GLOBAL_REGISTRY_KEY] = registry
  return registry
}