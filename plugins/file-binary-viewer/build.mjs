import * as esbuild from 'esbuild'

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

console.log('Frontend bundled to dist/frontend.js')