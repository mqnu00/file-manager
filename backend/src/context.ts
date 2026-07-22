/**
 * ctx 上下文 — 后端公共资源聚合
 *
 * 供动态导入的脚本引用，通过 ctx 访问所有后端公共模块。
 *
 * 用法：
 *   import { ctx } from './context'
 *   // 或
 *   import { createScriptContext } from './context'
 */

import type { Express } from 'express'
import { Router } from 'express'

import app from './app'
import { getConfig, reloadConfig, updateConfig, getSanitizedConfig, isDefaultToken } from './config'

import {
  authMiddleware,
  createSession,
  validateSession,
  destroySession,
  clearAllSessions,
  getTokenFromHeader,
} from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import { asyncHandler } from './middleware/asyncHandler'

import * as fileService from './services/fileService'
import {
  createMoveTask,
  createCompressTask,
  getTask,
  getAllTasks,
  cancelTask,
  subscribe,
} from './services/taskManager'
import {
  createSession as createTerminalSession,
  killSession,
  attachViewer,
  detachViewer,
  isRunning as isTerminalRunning,
  getSession as getTerminalSession,
} from './services/terminalManager'

import { log, readLogs, readLogsByRange, getAvailableDates, cleanOldLogs } from './utils/logger'
import { AppError } from './utils/AppError'
import { safePath, getStorageRoot, isVirtualFs, calculateDirSize } from './utils/safePath'
import {
  setSSEHeaders,
  sendSSEMessage,
  sendSSEProgress,
  sendSSEComplete,
  sendSSEError,
  endSSE,
} from './utils/sse'
import { detectPackageManager } from './utils/packageManager'

// ==================== 接口 ====================

export interface ScriptContext {
  /** Express 应用实例 */
  app: Express

  /** Express Router 工厂 */
  express: {
    Router: typeof Router
  }

  /** 中间件 */
  middleware: {
    auth: typeof authMiddleware
    errorHandler: typeof errorHandler
    asyncHandler: typeof asyncHandler
    session: {
      create: typeof createSession
      validate: typeof validateSession
      destroy: typeof destroySession
      clearAll: typeof clearAllSessions
      getTokenFromHeader: typeof getTokenFromHeader
    }
  }

  /** 配置管理 */
  config: {
    get: typeof getConfig
    reload: typeof reloadConfig
    update: typeof updateConfig
    getSanitized: typeof getSanitizedConfig
    isDefaultToken: typeof isDefaultToken
  }

  /** 服务层 */
  services: {
    file: typeof fileService
    task: {
      createMove: typeof createMoveTask
      createCompress: typeof createCompressTask
      get: typeof getTask
      getAll: typeof getAllTasks
      cancel: typeof cancelTask
      subscribe: typeof subscribe
    }
    terminal: {
      createSession: typeof createTerminalSession
      killSession: typeof killSession
      attachViewer: typeof attachViewer
      detachViewer: typeof detachViewer
      isRunning: typeof isTerminalRunning
      getSession: typeof getTerminalSession
    }
  }

  /** 工具函数 */
  utils: {
    logger: {
      log: typeof log
      readLogs: typeof readLogs
      readLogsByRange: typeof readLogsByRange
      getAvailableDates: typeof getAvailableDates
      cleanOldLogs: typeof cleanOldLogs
    }
    AppError: typeof AppError
    path: {
      safe: typeof safePath
      getStorageRoot: typeof getStorageRoot
      isVirtualFs: typeof isVirtualFs
      calculateDirSize: typeof calculateDirSize
    }
    sse: {
      setHeaders: typeof setSSEHeaders
      sendMessage: typeof sendSSEMessage
      sendProgress: typeof sendSSEProgress
      sendComplete: typeof sendSSEComplete
      sendError: typeof sendSSEError
      end: typeof endSSE
    }
    packageManager: {
      detect: typeof detectPackageManager
    }
  }
}

// ==================== 工厂函数 ====================

export function createScriptContext(): ScriptContext {
  return {
    app,

    express: {
      Router,
    },

    middleware: {
      auth: authMiddleware,
      errorHandler,
      asyncHandler,
      session: {
        create: createSession,
        validate: validateSession,
        destroy: destroySession,
        clearAll: clearAllSessions,
        getTokenFromHeader,
      },
    },

    config: {
      get: getConfig,
      reload: reloadConfig,
      update: updateConfig,
      getSanitized: getSanitizedConfig,
      isDefaultToken,
    },

    services: {
      file: fileService,
      task: {
        createMove: createMoveTask,
        createCompress: createCompressTask,
        get: getTask,
        getAll: getAllTasks,
        cancel: cancelTask,
        subscribe,
      },
      terminal: {
        createSession: createTerminalSession,
        killSession,
        attachViewer,
        detachViewer,
        isRunning: isTerminalRunning,
        getSession: getTerminalSession,
      },
    },

    utils: {
      logger: {
        log,
        readLogs,
        readLogsByRange,
        getAvailableDates,
        cleanOldLogs,
      },
      AppError,
      path: {
        safe: safePath,
        getStorageRoot,
        isVirtualFs,
        calculateDirSize,
      },
      sse: {
        setHeaders: setSSEHeaders,
        sendMessage: sendSSEMessage,
        sendProgress: sendSSEProgress,
        sendComplete: sendSSEComplete,
        sendError: sendSSEError,
        end: endSSE,
      },
      packageManager: {
        detect: detectPackageManager,
      },
    },
  }
}

// ==================== 单例 ====================

let _ctx: ScriptContext | null = null

export const ctx: ScriptContext = new Proxy({} as ScriptContext, {
  get(_, prop) {
    if (!_ctx) {
      _ctx = createScriptContext()
    }
    return (_ctx as any)[prop]
  },
})
