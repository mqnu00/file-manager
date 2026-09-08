import fs from 'fs'
import path from 'path'
import semver from 'semver'
import { getNpmRegistry } from '../config'

/** npm 发布包名（与 backend/package.json 的 name 一致） */
const NPM_PACKAGE_NAME = '@mqn00/file-manager'
/** 未启用镜像源时使用的官方 registry */
const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
/** 更新检测超时（毫秒） */
const CHECK_TIMEOUT_MS = 10000

export interface AppInfo {
  version: string
  repoUrl: string
}

export interface UpdateCheckResult {
  current: string
  latest: string
  hasUpdate: boolean
  /** 有更新时的 GitHub Release 链接 */
  releaseUrl?: string
}

interface PackageMeta {
  version?: string
  repository?: { url?: string } | string
}

let cachedPkgMeta: PackageMeta | null = null

/**
 * 读取 backend/package.json（兼容三种运行路径）：
 * - 开发 tsx：backend/src/utils → ../../package.json = backend/package.json
 * - 编译产物：backend/dist/utils → ../../package.json = backend/package.json
 * - npm 全局安装：node_modules/@mqn00/file-manager/dist/utils → 包根 package.json
 */
function readPackageMeta(): PackageMeta {
  if (cachedPkgMeta) return cachedPkgMeta
  try {
    const pkgPath = path.join(__dirname, '../../package.json')
    cachedPkgMeta = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageMeta
  } catch {
    cachedPkgMeta = {}
  }
  return cachedPkgMeta
}

/** 当前应用版本（读取 package.json；读取失败返回空字符串） */
export function getAppVersion(): string {
  return readPackageMeta().version ?? ''
}

/** 项目仓库地址（读取 package.json 的 repository 字段，去掉 .git 后缀；缺失返回空字符串） */
export function getRepoUrl(): string {
  const repo = readPackageMeta().repository
  const url = typeof repo === 'string' ? repo : repo?.url
  if (!url) return ''
  return url.replace(/\.git$/, '')
}

/** 有更新时的 GitHub Release 链接（基于仓库地址 + tag 规范 v{version}） */
function buildReleaseUrl(repoUrl: string, version: string): string | undefined {
  if (!repoUrl || !version) return undefined
  return `${repoUrl}/releases/tag/v${version}`
}

/**
 * 检测更新：查询 npm registry 的 dist-tags.latest 并与当前版本比较。
 * 若 config.yml 启用了 npm 镜像源，则使用同一镜像（与插件下载行为一致）。
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = getAppVersion()
  const registry = (getNpmRegistry() || DEFAULT_REGISTRY).replace(/\/+$/, '')

  const resp = await fetch(`${registry}/${encodeURIComponent(NPM_PACKAGE_NAME)}`, {
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  })
  if (!resp.ok) {
    throw new Error(`npm registry returned ${resp.status}`)
  }

  const data = (await resp.json()) as { 'dist-tags'?: Record<string, string> }
  const latest = data['dist-tags']?.latest ?? ''
  const hasUpdate = !!latest && !!current && semver.gt(latest, current)
  const repoUrl = getRepoUrl()

  return {
    current,
    latest,
    hasUpdate,
    releaseUrl: hasUpdate ? buildReleaseUrl(repoUrl, latest) : undefined,
  }
}

/** 应用信息（当前版本 + 项目地址），纯本地读取，无网络请求 */
export function getAppInfo(): AppInfo {
  return {
    version: getAppVersion(),
    repoUrl: getRepoUrl(),
  }
}
