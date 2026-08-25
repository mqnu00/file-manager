/**
 * vue 运行时桥：插件 bundle 不打包 vue（避免与主应用双实例），
 * 编译期把 `vue` 模块别名到此文件，浏览器运行时从主应用暴露的 window.Vue 转发。
 *
 * 类型经主项目 frontend-types（FrontendPluginContext.Vue = typeof import('vue')）
 * 传递解析，与 @element-plus/icons-vue 组件的 vue 类型完全一致，
 * 不做手写近似类型（同插件「类型从 @mqn00/file-manager/plugin/frontend 导入」的惯例）。
 *
 * 仅转发 @element-plus/icons-vue 编译产物实际使用的成员
 * （defineComponent / openBlock / createElementBlock / createElementVNode）。
 */
import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'

type VueRuntime = FrontendPluginContext['Vue']

const V = (window as unknown as { Vue: VueRuntime }).Vue

export const defineComponent: VueRuntime['defineComponent'] = V.defineComponent
export const openBlock: VueRuntime['openBlock'] = V.openBlock
export const createElementBlock: VueRuntime['createElementBlock'] = V.createElementBlock
export const createElementVNode: VueRuntime['createElementVNode'] = V.createElementVNode