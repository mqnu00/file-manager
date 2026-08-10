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
