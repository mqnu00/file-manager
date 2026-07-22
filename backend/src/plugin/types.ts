/**
 * 插件系统类型定义
 *
 * 供主项目和插件共同引用。插件通过 peerDependencies 声明对 @mqn00/file-manager 的依赖，
 * 编译时从 node_modules 解析这些类型。
 */

import type { Router } from 'express'
import type { ScriptContext } from '../context'

// ==================== 插件信息 ====================

/** 已加载插件的元信息 */
export interface LoadedPlugin {
  name: string
  /** package.json 所在目录 */
  rootDir: string
  /** exports["./frontend"] 值，相对于 rootDir */
  frontendPath: string | null
}

/** 前端插件列表项（含启用状态） */
export interface PluginInfo {
  name: string
  enabled: boolean
  frontendPath: string | null
}

// ==================== 插件上下文 ====================

/**
 * 后端插件上下文
 *
 * 与 ScriptContext 相同，但 app 限定为 Router（插件只能注册路由，不能启动服务器）。
 * 这是插件 install(ctx) 收到的 ctx 参数的类型。
 */
export interface BackendPluginContext extends Omit<ScriptContext, 'app'> {
  app: Router
}

// ==================== 安装函数签名 ====================

/**
 * 插件 install 函数签名
 *
 * @param ctx - 后端或前端插件上下文
 * @returns void 或 Promise<void>
 */
export type PluginInstallFunction<C = BackendPluginContext> = (ctx: C) => void | Promise<void>
