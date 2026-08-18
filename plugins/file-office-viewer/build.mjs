import * as esbuild from 'esbuild'

// 构建前端：将 frontend.ts 打包为单个浏览器 ESM 文件
// docx-preview / xlsx 等重依赖全部打入 bundle
await esbuild.build({
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  outfile: 'dist/frontend.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'],
  loader: {
    '.css': 'text',
  },
})

console.log('Frontend bundled to dist/frontend.js')