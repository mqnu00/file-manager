/**
 * @element-plus/icons-vue 的类型门面（仅供 tsc 类型解析）
 *
 * 为什么存在：icons 2.3.2 的类型入口（dist/types 下 .vue.d.ts + export * 结构）
 * 在插件 tsconfig（NodeNext + CJS 模式）下无法解析出具名导出，且其内部类型
 * 引用与插件无关的嵌套 vue 版本。
 *
 * 方案：tsconfig `paths` 把 `@element-plus/icons-vue` 映射到本文件——
 * tsc 用这里的类型（经主项目 frontend-types 的 Vue 类型链，与主应用 vue 版本一致）；
 * esbuild 打包时不读 tsconfig paths，仍解析真实包并 tree-shake，
 * 仅打包本插件 import 到的图标组件（配合 build.mjs 的 vue → vue-shim 桥）。
 */
import type { NavAction } from '@mqn00/file-manager/plugin/frontend'

/**
 * 图标组件类型：直接取发布入口 NavAction['icon']（Component，可选）的非空形态，
 * 与注册表契约保持同一类型链。不用 Parameters<h>[0]（含 string 标签分支，
 * 与组件图标语义不符，且无法赋给 Component）。
 */
type Icon = NonNullable<NavAction['icon']>

export declare const ArrowLeft: Icon
export declare const Refresh: Icon
export declare const Monitor: Icon
export declare const Cpu: Icon
export declare const Coin: Icon
export declare const Box: Icon
export declare const Tickets: Icon
export declare const Loading: Icon
export declare const WarningFilled: Icon