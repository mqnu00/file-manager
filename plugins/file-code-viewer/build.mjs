import * as esbuild from 'esbuild'
import { cpSync, rmSync, writeFileSync } from 'fs'
import path from 'path'

// 构建前端：将 frontend.ts 打包为单个浏览器 ESM 文件
await esbuild.build({
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  outfile: 'dist/frontend.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'],
})

// 拷贝 monaco-editor 的 min/vs 目录到 assets/vs：
// monaco 的 worker 体系无法用 esbuild 简单打包，采用运行时 AMD 加载
// （/plugins-assets/file-code-viewer/assets/vs/loader.js），获得完整能力
const src = 'node_modules/monaco-editor/min/vs'
const dest = 'assets/vs'
rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })

// 生成 worker 引导脚本：blob worker 内 importScripts 绝对 URL 会被判 invalid，
// 改用同源静态 JS（innerHTML 中的上报路径与前端 VS_BASE 保持一致）。
writeFileSync(
  path.join(dest, 'worker-hook.js'),
  [
    "self.MonacoEnvironment = { baseUrl: '/plugins-assets/file-code-viewer/assets' };",
    "importScripts('/plugins-assets/file-code-viewer/assets/vs/base/worker/workerMain.js');",
    '',
  ].join('\n')
)

console.log('Frontend bundled to dist/frontend.js')
console.log('Monaco assets copied to assets/vs')