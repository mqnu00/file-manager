/**
 * 插件数据 API（前端侧）
 *
 * 插件经 ctx.pluginData 访问，按插件名隔离的 KV 存储。
 * 正式环境：经已带认证拦截器的 axios 调用后端 `GET/PUT/DELETE /api/plugins/<name>/data[/<key>]`。
 * Demo 模式（无后端）：降级为 localStorage 垫片（键 fm-plugin-data:<name>:<key>）。
 *
 * 与后端 ctx.storage 接口保持一致（get/set/remove/all），便于插件前后端复用同一心智模型。
 */

import api from './index'

/** 插件 KV 存储接口（与后端 PluginKVStore 对应） */
export interface PluginDataApi {
  /** 读取键值（未设置返回 undefined） */
  get<T = unknown>(key: string): Promise<T | undefined>
  /** 写入键值 */
  set(key: string, value: unknown): Promise<void>
  /** 删除键值 */
  remove(key: string): Promise<void>
  /** 读取全部键值 */
  all(): Promise<Record<string, unknown>>
}

const DEMO_PREFIX = 'fm-plugin-data:'

function createDemoApi(name: string): PluginDataApi {
  const readAll = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(`${DEMO_PREFIX}${name}:`)) {
        const rel = k.slice(`${DEMO_PREFIX}${name}:`.length)
        try {
          out[rel] = JSON.parse(localStorage.getItem(k) as string)
        } catch {
          /* 跳过损坏项 */
        }
      }
    }
    return out
  }
  return {
    get<T = unknown>(key: string) {
      const raw = localStorage.getItem(`${DEMO_PREFIX}${name}:${key}`)
      return Promise.resolve(raw === null ? undefined : (JSON.parse(raw) as T))
    },
    set(key: string, value: unknown) {
      localStorage.setItem(`${DEMO_PREFIX}${name}:${key}`, JSON.stringify(value))
      return Promise.resolve()
    },
    remove(key: string) {
      localStorage.removeItem(`${DEMO_PREFIX}${name}:${key}`)
      return Promise.resolve()
    },
    all() {
      return Promise.resolve(readAll())
    },
  }
}

function createHttpApi(name: string): PluginDataApi {
  const base = `/plugins/${encodeURIComponent(name)}/data`
  return {
    get<T = unknown>(key: string) {
      return api
        .get<T>(`${base}/${encodeURIComponent(key)}`)
        .then((r) => r.data)
        .catch((err: unknown) => {
          if (err && typeof err === 'object' && 'response' in err) {
            const status = (err as { response?: { status?: number } }).response?.status
            if (status === 404) return undefined
          }
          throw err
        })
    },
    set(key: string, value: unknown) {
      return api.put(`${base}/${encodeURIComponent(key)}`, value).then(() => undefined)
    },
    remove(key: string) {
      return api.delete(`${base}/${encodeURIComponent(key)}`).then(() => undefined)
    },
    all() {
      return api.get<Record<string, unknown>>(base).then((r) => r.data)
    },
  }
}

/**
 * 创建绑定到指定插件名的 pluginData 实例。
 * 正式模式走 HTTP，Demo 模式走 localStorage。
 */
export function createPluginDataApi(name: string): PluginDataApi {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    return createDemoApi(name)
  }
  return createHttpApi(name)
}
