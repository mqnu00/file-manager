import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
    typecheck: {
      // 插件发布类型一致性断言（test/types-sync.test-d.ts）：
      // 发布类型（backend/src/plugin/frontend-types.ts）与前端真实类型漂移即编译失败。
      // ignoreSourceErrors：断言文件经 import 链会引入 backend 源码，
      // 其中 express 等后端依赖在 frontend 目录不可解析，属预期噪声，
      // 真正需要拦截的错误都落在断言文件本身（expect-type 在调用点报错）。
      checker: 'tsc',
      enabled: true,
      ignoreSourceErrors: true,
      tsconfig: './test/tsconfig.json',
      include: ['test/types-sync.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/env.d.ts', 'src/demo/**', 'src/main.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // 第一期只暴露真实覆盖情况，不设阈值，避免本地/CI 被阈值阻塞
    },
  },
})
