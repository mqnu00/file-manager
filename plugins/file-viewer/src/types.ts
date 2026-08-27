/**
 * file-viewer 查看器契约类型（供核心插件与子插件共享）
 *
 * 子插件经 `ctx.getService('file-viewer:viewers')` 拿到 FileViewerRegistryService，
 * 向核心报备自己的能力（默认扩展名 + 提供的查看页路由）；核心持有解析权
 * （配置表 extensionMappings + defaultViewer 可改写扩展名归属）。
 *
 * 注意：此处不含组件对象——渲染由子插件自己的查看页（route）完成，
 * 组件不存在跨插件边界传递，避免全局注册表。
 */

/** 子插件报备的查看器元数据 */
export interface ViewerMeta {
  /** 查看器唯一标识（同时是路由段与 mode 值，如 code/music/image） */
  id: string
  /** 下拉/配置页显示名 */
  label: string
  /** 默认可打开后缀（小写、不含点）；配置表可改写/扩充 */
  defaultExtensions: string[]
  /** 子插件提供的查看页路由（open 时由核心 fileOpen handler 跳转至此） */
  route: string
}

/** file-viewer 经 registerService 暴露的查看器注册服务 */
export interface FileViewerRegistryService {
  /** 注册/覆盖一个查看器元数据 */
  registerViewer(meta: ViewerMeta): void
  /** 注销指定查看器 */
  unregisterViewer(id: string): void
  /** 当前全部已注册查看器 */
  getViewers(): ViewerMeta[]
}
