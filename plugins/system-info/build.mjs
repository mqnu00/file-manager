import * as esbuild from 'esbuild'

// 构建前端：将 frontend.ts 打包为单个浏览器 ESM 文件
// - vue 别名到 vue-shim（运行时从 window.Vue 转发），bundle 不含 vue runtime
// - @element-plus/icons-vue 显式别名到真实包 ESM 入口（tsconfig paths 仅给 tsc
//   提供类型门面 icons-types.ts；此处 alias 优先于 tsconfig paths），
//   tree-shake 只打包本插件 import 到的图标组件
await esbuild.build({
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  outfile: 'dist/frontend.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'],
  alias: {
    vue: './src/vue-shim.ts',
    '@element-plus/icons-vue': './node_modules/@element-plus/icons-vue/dist/index.js',
  },
})

console.log('Frontend bundled to dist/frontend.js')