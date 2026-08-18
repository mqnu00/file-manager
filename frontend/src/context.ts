/**
 * ctx 上下文 — 传递给动态导入脚本的公共资源
 *
 * 用法：
 *   import { createScriptContext } from '@/context'
 *   const ctx = createScriptContext()
 *   // 或直接使用模块级单例 ctx
 *   import { ctx } from '@/context'
 */

import * as Vue from 'vue'
import * as ElementPlusAll from 'element-plus'

import api from '@/api'
import * as authApi from '@/api/auth'
import * as fileApi from '@/api/file'
import * as fileIOApi from '@/api/fileIO'
import * as configApi from '@/api/config'
import * as taskApi from '@/api/task'
import * as systemApi from '@/api/system'

import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'
import router from '@/router'

import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/file'
import { useTaskStore } from '@/stores/task'

import { useTheme } from '@/composables/useTheme'
import { useContextMenu } from '@/composables/useContextMenu'
import { useFileProgress } from '@/composables/useFileProgress'
import { useFileSort } from '@/composables/useFileSort'

import { formatSize, formatTime, formatSpeed, formatProgress } from '@/utils/format'

import {
  STORAGE_KEY_SESSION,
  STORAGE_KEY_THEME,
  THEME_CLASS_CYBER,
  THEME_VALUE_CYBER,
  THEME_VALUE_LIGHT,
  API_BASE_URL,
} from '@/constants'

/**
 * 插件页面路由记录（与 backend/src/plugin/frontend-types.ts 保持同步）。
 *
 * 页面是否需要登录由插件自行声明：`meta.requiresAuth: true` 时，
 * 未登录访问该页面将被路由守卫重定向到 /login（登录后跳回原页面）。
 * 不声明（如纯主题、公开页面）则默认放行。
 */
export type PluginRouteRecord = Omit<RouteRecordRaw, 'meta'> & {
  meta?: {
    /** 页面是否需要登录：true 时未登录访问重定向到登录页 */
    requiresAuth?: boolean
  }
}

export interface ScriptContext {
  /** Vue 核心库 */
  Vue: typeof Vue

  /** Element Plus 完整命名空间，包含所有组件和工具函数 */
  ElementPlus: typeof ElementPlusAll

  /** Pinia 状态管理 */
  stores: {
    auth: ReturnType<typeof useAuthStore>
    file: ReturnType<typeof useFileStore>
    task: ReturnType<typeof useTaskStore>
  }

  /** API 模块 */
  api: {
    /** axios 实例（已配置认证拦截器） */
    instance: typeof api
    auth: typeof authApi
    file: typeof fileApi
    /** 通用文件 I/O（纯二进制透传 read/write + 流令牌），文本/二进制/大小判断由查看器插件自行完成 */
    fileIO: typeof fileIOApi
    config: typeof configApi
    task: typeof taskApi
    system: typeof systemApi
  }

  /** 组合式函数 */
  composables: {
    useTheme: typeof useTheme
    useContextMenu: typeof useContextMenu
    useFileProgress: typeof useFileProgress
    useFileSort: typeof useFileSort
  }

  /** 工具函数 */
  utils: {
    formatSize: typeof formatSize
    formatTime: typeof formatTime
    formatSpeed: typeof formatSpeed
    formatProgress: typeof formatProgress
  }

  /** 常量 */
  constants: {
    STORAGE_KEY_SESSION: string
    STORAGE_KEY_THEME: string
    THEME_CLASS_CYBER: string
    THEME_VALUE_CYBER: string
    THEME_VALUE_LIGHT: string
    API_BASE_URL: string
  }

  /** Vue Router 工厂函数 + 实例方法 */
  router: {
    createRouter: typeof createRouter
    createWebHistory: typeof createWebHistory
    createWebHashHistory: typeof createWebHashHistory
    /**
     * 注册插件页面路由。需要登录的页面声明 `meta: { requiresAuth: true }`，
     * 未登录访问会被重定向到登录页（登录后跳回原页面）。
     */
    addRoute: (route: PluginRouteRecord) => () => void
    currentRoute: typeof router.currentRoute
  }

}

/**
 * 创建脚本上下文（单例）
 * 将所有公共资源打包到一个对象中，供动态导入的脚本使用
 */
export function createScriptContext(): ScriptContext {
  return {
    Vue,

    ElementPlus: ElementPlusAll,

    stores: {
      auth: useAuthStore(),
      file: useFileStore(),
      task: useTaskStore(),
    },

    api: {
      instance: api,
      auth: authApi,
      file: fileApi,
      fileIO: fileIOApi,
      config: configApi,
      task: taskApi,
      system: systemApi,
    },

    composables: {
      useTheme,
      useContextMenu,
      useFileProgress,
      useFileSort,
    },

    utils: {
      formatSize,
      formatTime,
      formatSpeed,
      formatProgress,
    },

    constants: {
      STORAGE_KEY_SESSION,
      STORAGE_KEY_THEME,
      THEME_CLASS_CYBER,
      THEME_VALUE_CYBER,
      THEME_VALUE_LIGHT,
      API_BASE_URL,
    },

    router: {
      createRouter,
      createWebHistory,
      createWebHashHistory,
      // 插件仅使用单参数重载（RouteRecordRaw 宽于 PluginRouteRecord，需收窄签名）
      addRoute: router.addRoute.bind(router) as (route: PluginRouteRecord) => () => void,
      currentRoute: router.currentRoute,
    },
  }
}

/** 模块级单例 ctx（延迟初始化，首次访问时创建） */
let _ctx: ScriptContext | null = null

export const ctx: ScriptContext = new Proxy({} as ScriptContext, {
  get(_, prop) {
    if (!_ctx) {
      _ctx = createScriptContext()
    }
    return (_ctx as any)[prop]
  },
})
