import * as esbuild from 'esbuild'

// 构建前端：将 frontend.ts 及其依赖（xterm 等）打包为单个 ESM 文件
await esbuild.build({
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  outfile: 'dist/frontend.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'],
  loader: {
    '.css': 'text', // xterm CSS 作为文本内联
  },
})

console.log('Frontend bundled to dist/frontend.js')
