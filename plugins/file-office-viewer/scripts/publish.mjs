#!/usr/bin/env node
/**
 * 发布脚本：版本号管理 + 构建 + npm publish
 *
 * 用法：
 *   node scripts/publish.mjs            # 自动 patch 递增当前版本
 *   node scripts/publish.mjs 0.1.0      # 指定版本号
 *
 * 发布为公开包（scoped 包默认 restricted），通过 publishConfig.access=public 保证。
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pkgPath = path.join(root, 'package.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const pkgName = pkg.name

// ---- 版本号 ----
const arg = process.argv[2]
let newVersion

if (arg) {
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(arg)) {
    console.error(`版本号格式非法: ${arg}（应为 semver，如 0.1.0）`)
    process.exit(1)
  }
  newVersion = arg
} else {
  const [major, minor, patch] = pkg.version.split('.').map(Number)
  newVersion = `${major}.${minor}.${patch + 1}`
}

if (newVersion === pkg.version) {
  // 本地版本与 npm 已发布版本冲突检查：npm 上不存在该版本时允许直接发布（本地已 bump 但未发布的场景）
  let published = false
  try {
    published =
      execSync(`npm view ${pkgName}@${newVersion} version`, { cwd: root, stdio: 'pipe' })
        .toString()
        .trim() !== ''
  } catch {
    published = false
  }
  if (published) {
    console.error(`版本号未变化（当前已是 ${newVersion}）且已在 npm 发布，请显式传入新版本号`)
    process.exit(1)
  }
  console.log(`版本号: ${pkg.version}（npm 无此版本，直接发布）`)
} else {
  console.log(`版本号: ${pkg.version} → ${newVersion}`)
  // ---- 写回 package.json ----
  pkg.version = newVersion
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

// ---- 构建 ----
console.log('构建中…')
execSync('npm run build', { stdio: 'inherit', cwd: root })

// ---- 发布 ----
console.log(`发布 ${pkgName}@${newVersion} …`)
execSync('npm publish --access public', { stdio: 'inherit', cwd: root })
console.log(`已发布 ${pkgName}@${newVersion}`)