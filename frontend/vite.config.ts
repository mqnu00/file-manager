import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue 相关的 API（如 ref, computed 等）和 Element Plus 的 API（如 ElMessage）
    AutoImport({
      resolvers: [ElementPlusResolver()],
      // 可选：生成类型声明文件的路径，建议放在 src 目录下
      dts: resolve(__dirname, 'src/auto-imports.d.ts'),
    }),
    // 自动导入 Vue 模板中使用的组件（如 el-button）
    Components({
      resolvers: [ElementPlusResolver()],
      // 可选：生成类型声明文件的路径，建议放在 src 目录下
      dts: resolve(__dirname, 'src/components.d.ts'),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/dist',
    emptyOutDir: true,
  },
});
