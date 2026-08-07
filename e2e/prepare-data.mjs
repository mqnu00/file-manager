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

// 生成 config.yml
const configYml = [
  'auth:',
  '  token: e2e-token-123',
  '  tokenExpiryHours: 24',
  `storageRoot: ${STORAGE_ROOT}`,
  'log:',
  '  cleanupOnStartup: false',
  '  retentionDays: 1',
  '',
].join('\n')
fs.writeFileSync(path.join(FIXTURES_DIR, 'config.yml'), configYml, 'utf-8')

console.log('[e2e] 测试数据与 config.yml 已生成:', FIXTURES_DIR)
