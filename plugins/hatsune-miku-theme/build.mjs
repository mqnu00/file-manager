import * as esbuild from 'esbuild'

// 构建前端：将 frontend.ts 打包为单个浏览器 ESM 文件
// 后端由 tsc(NodeNext) 编译为 CJS，前端需为浏览器可 import() 的 ESM
const shared = {
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'],
  loader: {
    '.css': 'text', // 主题样式作为文本内联
  },
}

await esbuild.build({
  ...shared,
  outfile: 'dist/frontend.js',
})

// demo 专用 bundle：把静态资源地址烘焙进 /file-manager/ 前缀（gh-pages 项目站点，
// 无后端），与 frontend/vite.config.ts 的 demo base 保持一致
if (process.argv.includes('--demo')) {
  const DEMO_ASSET_BASE = '/file-manager/plugins/hatsune-miku-theme/assets'
  await esbuild.build({
    ...shared,
    outfile: 'dist/frontend.demo.js',
    define: {
      __MIKU_API_BASE__: JSON.stringify(DEMO_ASSET_BASE),
      __MIKU_LOGO_URL__: JSON.stringify(`${DEMO_ASSET_BASE}/logo.png`),
    },
  })
  console.log('Demo frontend bundled to dist/frontend.demo.js')
}

console.log('Frontend bundled to dist/frontend.js')
