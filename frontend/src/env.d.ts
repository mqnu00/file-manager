declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

import * as THREE from 'three'
import type { BulkActionsApi } from '@/pluginActions'
import type { NavActionsApi } from '@/pluginNav'
import type { FileOpenApi } from '@/platform/fileOpen'

declare global {
  interface Window {
    /** 主项目自用全局（必选：由 main.ts 模块求值期挂载） */
    THREE: typeof THREE
    Vue: typeof import('vue')
    ElementPlus: typeof import('element-plus')
    __runScript: () => void

    /**
     * 插件挂载点注册表（可选：主应用 v3.0.0 起保证提供，但插件需兼容更旧主应用，
     * 访问前判空降级——与发布类型入口 backend/src/plugin/frontend-types.ts 的
     * declare global 保持结构一致，interface 合并强制两侧同型）。
     */
    __fm_bulk_actions?: BulkActionsApi
    __fm_nav_actions?: NavActionsApi
    __fm_file_open?: FileOpenApi
  }
}