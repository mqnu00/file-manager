import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    // 登录一次保存会话，供 authenticated 项目复用（避免触发登录限流）
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'authenticated',
      testMatch: /(files|tasks|logs|config|plugins)\.spec\.ts/,
      use: { storageState: path.join(__dirname, '.auth', 'user.json') },
      dependencies: ['setup'],
    },
    // 登录流程与未登录安全场景：独立 context，无会话
    { name: 'guest', testMatch: /(auth|security)\.spec\.ts/ },
  ],
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    // 先准备测试数据，再构建前后端，最后以测试配置启动后端（提供静态页面 + API）
    command: 'node prepare-data.mjs && cd .. && npm run build && node backend/dist/app.js',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: '3100',
      CONFIG_PATH: path.join(__dirname, 'fixtures', 'config.yml'),
      LOG_DIR: path.join(__dirname, 'fixtures', 'logs'),
    },
  },
})
