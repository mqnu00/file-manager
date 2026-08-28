/**
 * 插件数据目录与 KV 存储
 *
 * 为主项目提供按插件隔离的持久化存储能力：
 *   - getPluginDataDir(name)  → 插件私有目录绝对路径（惰性创建，可存放缓存/二进制大文件）
 *   - getPluginStore(name)    → 结构化 KV 存储（JSON 序列化，落盘到 <dir>/store.json）
 *   - clearPluginData(name)   → 删除插件数据目录（卸载插件时可选调用）
 *
 * 数据目录基址：默认 <pluginInstallPrefix>/data（生产 = ~/.file-manager/data）；
 * 可用环境变量 FILE_MANAGER_PLUGIN_DATA_DIR 覆盖（测试/部署可重定向）。
 *
 * 约束：KV 键禁止路径分隔符（防越目录）；值必须可 JSON 序列化；单进程内串行 RMW，
 * 适用于配置型小数据；大/二进制数据请直接使用 ctx.dataDir 写文件。
 */

import fs from 'fs'
import path from 'path'
import { getPluginInstallPrefix } from '../config'
import { AppError } from '../utils/AppError'

const STORE_FILE = 'store.json'

/** 数据目录基址（惰性读取环境变量，便于测试重定向） */
function getDataBase(): string {
  const override = process.env.FILE_MANAGER_PLUGIN_DATA_DIR
  if (override) return path.resolve(override)
  return path.join(getPluginInstallPrefix(), 'data')
}

/** 插件数据目录绝对路径（确保存在） */
export function getPluginDataDir(name: string): string {
  const dir = path.join(getDataBase(), name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** 删除插件数据目录（不存在则无操作；卸载插件时调用） */
export function clearPluginData(name: string): void {
  const dir = path.join(getDataBase(), name)
  fs.rmSync(dir, { recursive: true, force: true })
}

/** 校验 KV 键：非空字符串且不含路径分隔符 */
function sanitizeKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw new AppError('插件数据存储键不能为空', 400, 'INVALID_KEY')
  }
  if (key.includes('/') || key.includes('\\') || key === '.' || key === '..') {
    throw new AppError('插件数据存储键不能包含路径分隔符', 400, 'INVALID_KEY')
  }
  return key
}

/** 校验值可 JSON 序列化（排除 undefined / 函数 / symbol；JSON.stringify 对后两者静默丢弃为 undefined） */
function assertSerializable(value: unknown): void {
  if (value === undefined) {
    throw new AppError('插件数据存储值不能为 undefined', 400, 'INVALID_VALUE')
  }
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new AppError('插件数据存储值必须可 JSON 序列化', 400, 'INVALID_VALUE')
  }
  if (serialized === undefined) {
    throw new AppError('插件数据存储值必须可 JSON 序列化', 400, 'INVALID_VALUE')
  }
}

type StoreShape = Record<string, unknown>

/**
 * 单插件 KV 存储：内存缓存 + store.json 落盘。
 * 实例按插件名缓存（getPluginStore 保证同进程内单例），读写一致。
 */
class PluginStore {
  private dir: string
  private file: string
  private cache: StoreShape | null = null

  constructor(name: string) {
    this.dir = getPluginDataDir(name)
    this.file = path.join(this.dir, STORE_FILE)
  }

  private read(): StoreShape {
    if (this.cache) return this.cache
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      this.cache = JSON.parse(raw) as StoreShape
    } catch {
      // 文件缺失/损坏：按空存储处理并记录（不抛出，避免单点数据错误拖垮插件）
      this.cache = {}
    }
    return this.cache
  }

  private write(data: StoreShape): void {
    this.cache = data
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf8')
  }

  get<T = unknown>(key: string): T | undefined {
    return this.read()[sanitizeKey(key)] as T | undefined
  }

  set(key: string, value: unknown): void {
    const k = sanitizeKey(key)
    assertSerializable(value)
    const data = this.read()
    data[k] = value
    this.write(data)
  }

  delete(key: string): void {
    const k = sanitizeKey(key)
    const data = this.read()
    if (k in data) {
      delete data[k]
      this.write(data)
    }
  }

  has(key: string): boolean {
    return sanitizeKey(key) in this.read()
  }

  keys(): string[] {
    return Object.keys(this.read())
  }

  all(): Record<string, unknown> {
    return { ...this.read() }
  }
}

const storeCache = new Map<string, PluginStore>()

/** 取插件的 KV 存储单例（按 name 缓存） */
export function getPluginStore(name: string): PluginStore {
  let store = storeCache.get(name)
  if (!store) {
    store = new PluginStore(name)
    storeCache.set(name, store)
  }
  return store
}

/** 测试辅助：清空进程内存储缓存（不删磁盘数据） */
export function __resetStoreCache(): void {
  storeCache.clear()
}
