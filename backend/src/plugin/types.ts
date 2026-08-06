/**
 * 插件系统类型定义
 *
 * 供主项目和插件共同引用。插件通过 peerDependencies 声明对 @mqn00/file-manager 的依赖，
 * 编译时从 node_modules 解析这些类型。
 */

import { Router } from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ScriptContext } from '../context'

// Re-export express 核心类型与 Router 构造函数，插件无需直接依赖 express
export { Router }
export type { Request, Response, NextFunction, RequestHandler }

// ==================== 插件信息 ====================

/** 已加载插件的元信息 */
export interface LoadedPlugin {
  name: string
  /** package.json 所在目录 */
  rootDir: string
  /** 是否从 plugins/ 本地目录加载（否则来自 node_modules） */
  local: boolean
  /** 插件来源，持久化到 config.yml */
  source: 'local' | 'npm'
  /** exports["./frontend"] 值，相对于 rootDir */
  frontendPath: string | null
}

/** 前端插件列表项（含启用状态） */
export interface PluginInfo {
  name: string
  enabled: boolean
  /** 是否从 plugins/ 本地目录加载（否则来自 node_modules） */
  local: boolean
  /** 插件来源：local=本地开发目录，npm=node_modules */
  source: 'local' | 'npm'
  frontendPath: string | null
}

// ==================== 插件清单 ====================

/** 插件配置字段描述（由插件在 package.json 的 fileManagerPlugin.config 中声明） */
export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  default: unknown
  description?: string
  required?: boolean
}

/** 插件在 package.json 中 fileManagerPlugin 字段的声明 */
export interface PluginManifestConfig {
  /** 依赖的其他插件名（对应 config.yml 的插件键），可选 */
  dependsOn?: string[]
  /** 插件自定义配置 schema，安装时默认值自动写入 config.yml */
  config?: Record<string, PluginConfigField>
}

// ==================== 托管服务 ====================

/**
 * 可托管服务：启停可管理、状态可查询。
 * 插件通过 ctx.manageService 注册，主进程按 config 中 startedServices
 * 自动启动，并支持服务级依赖等待（dependsOn）。
 */
export interface ManagedServiceSpec {
  /** 启动服务（返回值透传给调用方，如 smb 返回 { port }） */
  start(): unknown
  /** 停止服务 */
  stop(): void | Promise<void>
  /** 服务当前是否运行 */
  isRunning(): boolean | Promise<boolean>
  /** 自动启动前预检；返回 false 则跳过自动启动（如 sudo -n 探测） */
  canAutoStart?(): boolean | Promise<boolean>
  /** 启动前需已运行的服务名（服务级依赖） */
  dependsOn?: string[]
}

// ==================== npm 搜索 ====================

/** npm registry 搜索返回的包信息 */
export interface NpmSearchResult {
  name: string
  version: string
  description: string
  publisher: string
  date: string
  links: { npm: string; repository?: string; homepage?: string }
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
  /** 注册插件间共享服务。若服务名已被注册则抛出错误 */
  registerService(name: string, impl: any): void
  /** 获取其他插件注册的服务。若未注册则抛出错误 */
  getService(name: string): any
  /** 注册托管服务（启停可管理、状态可查询，支持自动启动与依赖等待） */
  manageService(name: string, spec: ManagedServiceSpec): void
  /** 启动托管服务：调用 spec.start() 并持久化 config 中 startedServices */
  startService(name: string): unknown
  /** 停止托管服务：调用 spec.stop() 并从 config 中 startedServices 移除 */
  stopService(name: string): void | Promise<void>
  /** 等待服务满足状态（默认运行中），超时抛错。服务未注册立即抛错 */
  waitForService(
    name: string,
    opts?: { running?: boolean; timeout?: number }
  ): Promise<void>
  /** 查询托管服务是否运行 */
  isServiceRunning(name: string): boolean | Promise<boolean>
  /** 插件间共享服务的扩展字段 */
  [key: string]: any
}

// ==================== 安装函数签名 ====================

/**
 * 插件 install 函数签名
 *
 * @param ctx - 后端或前端插件上下文
 * @returns void 或 Promise<void>
 */
export type PluginInstallFunction<C = BackendPluginContext> = (ctx: C) => void | Promise<void>
