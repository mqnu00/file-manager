/**
 * sudo 提权凭据服务
 *
 * 文件操作因权限不足（EACCES / EPERM）失败时，若已缓存有效凭据则自动以 sudo
 * 提升到 root 重试。凭据仅在内存缓存、限时有效（见 config.yml 的 auth.elevationTtlMinutes），
 * 不落盘；过期 / 进程重启 / 登出即失效。
 *
 * 安全要点：
 * - sudo 以数组参数调用（execFileSync('sudo', ['-S', ...args], { input })），参数不进 shell，
 *   避免命令注入；路径统一以 `--` 开头，防止 `-flag` 注入。
 * - 提权后新建/重命名的文件默认通过 chown 归还给应用启动用户（APP_UID:APP_GID），
 *   否则文件会属 root 导致应用后续无法读写。
 * - 本功能整体受 config.yml 的 features.sudoElevation（默认 true）开关控制。
 *
 * 注：sudo 默认以「应用启动用户」的身份、用其密码认证并提升到 root（目标用户为 root）。
 * 对话框收集的 username 仅作记录与未来扩展，sudo 调用不传 -u（保持目标为 root）。
 */

import { execFileSync } from 'child_process'
import os from 'os'
import { AppError } from '../utils/AppError'
import { getConfig, type AppConfig } from '../config'

/** 应用启动用户（提权创建的文件归还给该用户，保证应用仍可读写） */
const APP_UID = os.userInfo().uid
const APP_GID = os.userInfo().gid

interface ElevationCredentials {
  username: string
  password: string
  chownBack: boolean
  expiresAt: number
}

/** sudo 执行器（可注入，便于测试不真实调用 sudo）；返回值用于需要捕获 stdout 的场景 */
type SudoRunner = (args: string[], password: string) => string | Buffer | void

function defaultRunner(args: string[], password: string): Buffer {
  return execFileSync('sudo', ['-S', ...args], {
    input: password + '\n',
  })
}

let cached: ElevationCredentials | null = null
let runner: SudoRunner = defaultRunner
let configFn: () => AppConfig = getConfig

/** 测试注入：替换为假执行器（传 null 恢复默认） */
export function __setRunner(r: SudoRunner | null): void {
  runner = r ?? defaultRunner
}

/** 测试注入：替换为假配置读取（传 null 恢复默认） */
export function __setConfigGetter(fn: (() => AppConfig) | null): void {
  configFn = fn ?? getConfig
}

/** 凭据有效期（毫秒），取自 config.yml，缺省 5 分钟 */
function ttlMs(): number {
  const minutes = configFn().auth.elevationTtlMinutes ?? 5
  return Math.max(1, minutes) * 60_000
}

/** 提权总开关（features.sudoElevation，默认启用） */
export function isEnabled(): boolean {
  return configFn().features?.sudoElevation !== false
}

/** 是否存在未过期的提权凭据 */
export function hasCredentials(): boolean {
  if (!cached) return false
  if (Date.now() >= cached.expiresAt) {
    cached = null
    return false
  }
  return true
}

/**
 * 校验并缓存凭据。
 * 以 `sudo -S true` 验证密码是否正确（sudo 不存在 / 密码错误均失败）。
 * 成功返回 true 并写入 expiresAt；失败返回 false 且不缓存。
 */
export function setCredentials(username: string, password: string, chownBack: boolean): boolean {
  try {
    runner(['true'], password)
  } catch {
    cached = null
    return false
  }
  cached = {
    username,
    password,
    chownBack,
    expiresAt: Date.now() + ttlMs(),
  }
  return true
}

/** 清除凭据（登出 / 过期 / sudo 执行失败均调用） */
export function clearCredentials(): void {
  cached = null
}

/** 提权后是否归还文件属主给应用用户（未缓存时默认 true） */
export function shouldChownBack(): boolean {
  return cached?.chownBack ?? true
}

/**
 * 以提升的权限执行命令（参数数组）。要求已缓存有效凭据。
 * sudo 非 0 退出时清凭据并抛出 AppError（调用方据此改抛 ElevationRequiredError）。
 */
export function runElevated(args: string[]): void {
  if (!hasCredentials() || !cached) {
    throw new AppError('未缓存提权凭据', 403, 'ELEVATION_REQUIRED')
  }
  try {
    runner(args, cached.password)
  } catch (e: any) {
    cached = null
    const stderr = e?.stderr?.toString?.()
    const msg = stderr?.trim() || e?.message || '未知错误'
    throw new AppError(`sudo 执行失败: ${msg}`, 500)
  }
}

/** 将目标路径属主归还给应用启动用户（提权创建/重命名后调用） */
export function runElevatedChown(target: string): void {
  runElevated(['chown', `${APP_UID}:${APP_GID}`, '--', target])
}

/**
 * 以提升的权限执行命令并捕获 stdout（Buffer，二进制安全；如 sudo 列目录/读文件）。
 * 要求已缓存有效凭据；失败时清凭据并抛出 AppError。
 */
export function runElevatedCapture(args: string[]): Buffer {
  if (!hasCredentials() || !cached) {
    throw new AppError('未缓存提权凭据', 403, 'ELEVATION_REQUIRED')
  }
  try {
    const out = runner(args, cached.password)
    if (!out) return Buffer.alloc(0)
    return Buffer.isBuffer(out) ? out : Buffer.from(out, 'utf8')
  } catch (e: any) {
    cached = null
    const stderr = e?.stderr?.toString?.()
    const msg = stderr?.trim() || e?.message || '未知错误'
    throw new AppError(`sudo 执行失败: ${msg}`, 500)
  }
}

/** 导出供测试断言属主归还逻辑 */
export const __test = { APP_UID, APP_GID }
