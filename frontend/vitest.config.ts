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
    // 超时抖动治理（v3.0.0）：
    // 现象：默认 5s 超时在 CPU 过载 + 默认 15 个 fork worker 并发冷启动（每 worker
    // 全量 import element-plus + 编译 SFC）时，文件内首个/全部重度 mount 用例偶发
    // `Test timed out in 5000ms`（复现：16 核机器负载 ≥ nproc 时 39 文件中最多 10 个
    // 各挂 1 例，且全为耗时长于 5s 的冷启动用例）。
    // 单个用例本身 <2s（同样负载下单文件运行 5/5 通过），属调度饿死而非逻辑缺陷。
    // 治理：超时放宽到 10s（覆盖 5-10s 冷启动排队）+ worker 并发减半（16 核 → 8，
    // 实测套件耗时基本不变，过载/饿死风险减半）。CI 与多任务开发机均受益。
    testTimeout: 10_000,
    maxWorkers: 8,
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
