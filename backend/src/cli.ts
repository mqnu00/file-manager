#!/usr/bin/env node

import os from 'os'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))

function printHelp() {
  console.log(`File Manager v${pkg.version}

用法: file-manager [选项]

选项:
  -p, --port <port>      监听端口 (默认: 3000)
  -c, --config <path>    配置文件路径 (默认: ~/.file-manager/config.yml)
  -d, --dir <path>       文件管理根目录
  --daemon               后台运行
  -v, --version          显示版本号
  --help                 显示帮助信息
`)
}

// === 解析参数 ===

const args = process.argv.slice(2)
let port = ''
let configPath = ''
let baseDir = ''
let daemon = false

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  const next = args[i + 1]
  switch (arg) {
    case '-p':
    case '--port':
      port = next
      i++
      break
    case '-c':
    case '--config':
      configPath = next
      i++
      break
    case '-d':
    case '--dir':
      baseDir = next
      i++
      break
    case '--daemon':
      daemon = true
      break
    case '-v':
    case '--version':
      console.log(pkg.version)
      process.exit(0)
      break
    case '--help':
      printHelp()
      process.exit(0)
  }
}

// === 设置环境变量 ===

if (port) process.env.PORT = port

process.env.CONFIG_PATH = configPath || path.join(os.homedir(), '.file-manager', 'config.yml')
process.env.LOG_DIR = path.join(os.homedir(), '.file-manager', 'logs')

if (baseDir) process.env.FILE_MANAGER_BASE_DIR = baseDir

// 确保 ~/.file-manager/ 目录存在
const fmDir = path.join(os.homedir(), '.file-manager')
if (!fs.existsSync(fmDir)) {
  fs.mkdirSync(fmDir, { recursive: true })
}

// === 后台运行 ===

if (daemon) {
  const childArgs = process.argv.filter((a) => a !== '--daemon')
  const child = spawn(process.argv[0], childArgs.slice(1), {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  console.log(`File Manager 已后台启动 (PID: ${child.pid})`)
  process.exit(0)
}

// === 启动服务 ===

const { createServer } = require('./app')
createServer()
