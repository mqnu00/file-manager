/**
 * 同步 demo 插件到 frontend/public：构建插件 demo bundle 并连同静态资源拷入 public，
 * 由 Vite 在 `vite build --mode demo` 时原样打进 gh-pages-dist。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const pluginDir = path.join(root, 'plugins', 'hatsune-miku-theme')
const publicPluginDir = path.join(root, 'frontend', 'public', 'plugins', 'hatsune-miku-theme')

// 1. 构建 demo bundle（esbuild，需插件依赖已安装）
execSync('npm run build:demo', { cwd: pluginDir, stdio: 'inherit' })

// 2. 拷贝 bundle 与静态资源到 frontend/public（Vite public 目录会原样复制进构建产物）
fs.rmSync(publicPluginDir, { recursive: true, force: true })
fs.mkdirSync(publicPluginDir, { recursive: true })
fs.copyFileSync(
  path.join(pluginDir, 'dist', 'frontend.demo.js'),
  path.join(publicPluginDir, 'frontend.js')
)
fs.cpSync(path.join(pluginDir, 'assets'), path.join(publicPluginDir, 'assets'), {
  recursive: true,
})

console.log('[sync-demo-plugins] hatsune-miku-theme synced to frontend/public/plugins/')
