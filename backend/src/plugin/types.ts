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
  /** fileManagerPlugin.frontendPage 值：插件声明的前端配置页路由路径 */
  frontendPage: string | null
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
  /** fileManagerPlugin.frontendPage 值：插件声明的前端配置页路由路径 */
  frontendPage: string | null
  /** package.json 中的版本号（读取失败为 null） */
  version: string | null
  /** 要求的主项目最低版本（语义化范围字符串，未声明为 null） */
  minHostVersion: string | null
  /** 依赖插件版本校验问题列表（无问题为空数组） */
  dependencyIssues: PluginDepIssue[]
  /** 是否允许加载：无硬阻塞（缺失/未启用/未启动/多方面不兼容）为 true */
  compatible: boolean
  /** 兼容性软提示（仍允许加载）：仅宿主版本偏低 / 仅依赖版本偏低时的告警文案，否则 null */
  compatibilityWarning: string | null
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
  /** 依赖的其他插件名（对应 config.yml 的插件键），可选。仅声明存在 + 拓扑顺序 */
  dependsOn?: string[]
  /**
   * 依赖插件的最小版本约束（semver range）。
   * key 为依赖插件名，value 为要求的版本范围（如 ">=1.0.0"）。
   * 安装/加载时主项目会校验该依赖已安装、已启用且版本满足范围。
   */
  dependencies?: Record<string, string>
  /** 要求的主项目最低版本（semver range）。缺省时回退读取 peerDependencies["@mqn00/file-manager"] */
  minHostVersion?: string
  /** 插件自定义配置 schema，安装时默认值自动写入 config.yml */
  config?: Record<string, PluginConfigField>
  /** 插件声明的前端配置页路由路径（如 "/plugin/file-viewer"）。
   * 仅当插件注册了独立页面路由时声明；未声明则插件管理页不显示「进入前端」按钮 */
  frontendPage?: string
}

/** 插件依赖校验问题 */
export interface PluginDepIssue {
  /** 依赖插件名 */
  name: string
  /** 要求的版本范围（声明了 dependencies 时存在） */
  required?: string
  /** 依赖插件当前已安装版本（缺失/未启用时为 null） */
  current: string | null
  /** 问题类型 */
  status: 'missing' | 'disabled' | 'not-started' | 'mismatch'
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

// ==================== 插件数据目录（KV 存储） ====================

/**
 * 单插件 KV 存储（结构化、JSON 序列化）。插件经 ctx.storage 访问，
 * 落盘到 <dataDir>/store.json；大/二进制数据请直接用 ctx.dataDir 写文件。
 * 键禁止路径分隔符，值必须可 JSON 序列化（见 storage.ts）。
 */
export interface PluginKVStore {
  /** 读取键值（未设置返回 undefined） */
  get<T = unknown>(key: string): T | undefined
  /** 写入键值（覆盖同名键） */
  set(key: string, value: unknown): void
  /** 删除键（未设置则无操作） */
  delete(key: string): void
  /** 是否存在某键 */
  has(key: string): boolean
  /** 全部键名 */
  keys(): string[]
  /** 导出全部键值 */
  all(): Record<string, unknown>
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
  /** 插件私有数据目录绝对路径（惰性创建）。缓存/二进制大文件可直接在此写文件 */
  dataDir: string
  /** 插件结构化 KV 存储（JSON 序列化，落盘到 <dataDir>/store.json） */
  storage: PluginKVStore
  /** 插件间共享服务的扩展字段 */
  [key: string]: any
}

// ==================== 安装函数签名 ====================

/**
 * 后端插件 teardown 契约：撤销 install 期间产生的全局副作用
 * （如经其他插件注册表报备的能力——查看器注册等）。
 * 平台卸载/重载插件时会调用；路由层与注册服务由平台自动清理，无需插件处理。
 */
export type PluginTeardown = () => void | Promise<void>

/**
 * 插件 install 函数签名
 *
 * @param ctx - 后端或前端插件上下文
 * @returns void / Promise<void>，或返回 teardown 函数（可选）。
 *          返回 teardown = 插件声明「install 期间的全局副作用由我撤销」；
 *          不返回 = 无需要自行清理的全局副作用（路由层/注册服务于卸载时
 *          由平台自动清理）。
 */
export type PluginInstallFunction<C = BackendPluginContext> = (
  ctx: C
) => void | Promise<void> | PluginTeardown | Promise<PluginTeardown>
