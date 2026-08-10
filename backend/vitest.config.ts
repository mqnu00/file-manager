import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/plugin/frontend-types.ts', 'src/plugin/types.ts', 'src/types.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // 第一期只暴露真实覆盖情况，不设阈值，避免本地/CI 被阈值阻塞
    },
  },
})
