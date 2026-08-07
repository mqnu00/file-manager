import http from 'http'
import type { BackendPluginContext } from '@mqn00/file-manager/plugin'

/**
 * 托管服务：一个运行在文件管理器进程内的 HTTP 测试服务。
 *
 * 用途：验证托管服务机制 —— 通过 ctx.manageService 注册后，
 * 重启文件管理器会自动恢复（config.yml plugins.test.startedServices 持久化）。
 * 服务随进程退出而关闭，重启后端口不会残留占用，适合反复测试。
 */

// ==================== 类型 ====================

export interface TestServiceStatus {
  running: boolean
  port: number
  startedAt: number | null
  startCount: number
}

// ==================== 状态 ====================

let _ctx: BackendPluginContext | null = null
let server: http.Server | null = null
let startedAt: number | null = null
let startCount = 0

/** 默认监听端口，可用 config.yml plugins.test.servicePort 覆盖 */
const DEFAULT_PORT = 18765

export function initTestService(ctx: BackendPluginContext): void {
  _ctx = ctx
}

function getCtx(): BackendPluginContext {
  if (!_ctx) throw new Error('Test service not initialized')
  return _ctx
}

function getPort(): number {
  const cfg = getCtx().config.get()
  const saved = (cfg.plugins?.test || {}) as Record<string, unknown>
  return typeof saved.servicePort === 'number' ? saved.servicePort : DEFAULT_PORT
}

// ==================== HTTP 服务 ====================

/** 服务响应：携带 CORS 头，便于前端跨端口请求验证 */
function createHandler(): http.RequestListener {
  return (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(
      JSON.stringify({
        plugin: 'test',
        service: 'test-service',
        port: getPort(),
        startedAt,
        startCount,
        message: 'Hello from test service',
        timestamp: new Date().toISOString(),
      })
    )
  }
}

export function start(): { port: number } {
  if (isRunning()) {
    throw new Error('测试服务已在运行中')
  }
  const port = getPort()
  server = http.createServer(createHandler())
  // 端口占用等错误仅记录，避免未捕获异常导致文件管理器进程崩溃
  server.on('error', (err) => {
    console.error('Test service error:', err)
    server = null
    startedAt = null
  })
  server.listen(port, '127.0.0.1')
  startedAt = Date.now()
  startCount++
  console.log(`Test service started on port ${port}`)
  return { port }
}

export function stop(): void {
  if (!server) return
  server.close()
  server = null
  startedAt = null
  console.log('Test service stopped')
}

/**
 * 用 server !== null 判断运行状态（而非 server.listening）：
 * listen() 后 listening 异步才变为 true，立即查询会误判为未运行；
 * 端口占用等 error 会把 server 置 null，恢复为未运行。
 */
export function isRunning(): boolean {
  return server !== null
}

export function getStatus(): TestServiceStatus {
  return {
    running: isRunning(),
    port: getPort(),
    startedAt,
    startCount,
  }
}
