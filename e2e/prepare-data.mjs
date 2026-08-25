/**
 * E2E 数据准备脚本（webServer 启动前由 command 调用）：
 * - 重建测试数据目录 storage，预置文件/文件夹
 * - 生成测试 config.yml（token / storageRoot / log 指向 e2e 目录）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const STORAGE_ROOT = path.join(FIXTURES_DIR, 'storage')

// 重建数据目录
fs.rmSync(STORAGE_ROOT, { recursive: true, force: true })
fs.mkdirSync(path.join(STORAGE_ROOT, 'docs'), { recursive: true })
fs.mkdirSync(path.join(STORAGE_ROOT, 'empty'), { recursive: true })
fs.writeFileSync(path.join(STORAGE_ROOT, 'hello.txt'), 'Hello E2E', 'utf-8')
fs.writeFileSync(path.join(STORAGE_ROOT, '中文文件.txt'), '中文内容', 'utf-8')
fs.writeFileSync(path.join(STORAGE_ROOT, 'docs', 'readme.md'), '# E2E Docs', 'utf-8')

// 预置日志（当日文件，格式对齐 backend logger）
const LOG_DIR = path.join(FIXTURES_DIR, 'logs')
fs.rmSync(LOG_DIR, { recursive: true, force: true })
fs.mkdirSync(LOG_DIR, { recursive: true })
const today = new Date().toISOString().split('T')[0]
const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC')
const logLines = [
  `[${now}] [INFO] [page-open] 用户进入文件列表`,
  `[${now}] [INFO] [file-download] 下载了 report.pdf`,
  `[${now}] [ERROR] [auth-fail] 令牌错误: invalid`,
  `[${now}] [WARNING] [disk] 磁盘空间不足 10%`,
  `[${now}] [INFO] [login] 登录成功`,
  `[${now}] [ERROR] [delete] 删除失败: EACCES`,
]
fs.writeFileSync(path.join(LOG_DIR, `${today}.log`), logLines.join('\n') + '\n', 'utf-8')

// 生成 config.yml（含本地 test / compress 插件，供插件管理页与压缩 E2E 使用）
const configYml = [
  'auth:',
  '  token: e2e-token-123',
  '  tokenExpiryHours: 24',
  `storageRoot: ${STORAGE_ROOT}`,
  'log:',
  '  cleanupOnStartup: false',
  '  retentionDays: 30',
  'plugins:',
  '  test:',
  '    enabled: true',
  '    source: local',
  '  compress:',
  '    enabled: true',
  '    source: local',
  '',
].join('\n')
fs.writeFileSync(path.join(FIXTURES_DIR, 'config.yml'), configYml, 'utf-8')

console.log('[e2e] 测试数据与 config.yml 已生成:', FIXTURES_DIR)
