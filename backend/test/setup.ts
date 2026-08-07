/**
 * 后端测试全局 setup：
 * - 创建独立临时目录（每个测试文件各自的 worker 进程，互不干扰）
 * - 设置 CONFIG_PATH / LOG_DIR 指向临时目录，隔离配置与日志
 * - 在测试文件 import app 之前同步写入最小 config.yml
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll } from 'vitest'

const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-backend-test-'))
const STORAGE_ROOT = path.join(TEST_ROOT, 'storage')

process.env.CONFIG_PATH = path.join(TEST_ROOT, 'config.yml')
process.env.LOG_DIR = path.join(TEST_ROOT, 'logs')

fs.mkdirSync(STORAGE_ROOT, { recursive: true })
fs.writeFileSync(
  process.env.CONFIG_PATH,
  JSON.stringify(
    {
      auth: { token: 'test-token-123', tokenExpiryHours: 1 },
      storageRoot: STORAGE_ROOT,
      log: { cleanupOnStartup: false, retentionDays: 1 },
    },
    null,
    2
  ),
  'utf-8'
)

export { TEST_ROOT, STORAGE_ROOT }

afterAll(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})
