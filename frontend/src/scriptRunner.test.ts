import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import { initScriptRunner } from './scriptRunner'

const FIXTURE = path.resolve(__dirname, '../test/fixtures/script-fixture.mjs')

/** 构造 fake ctx（scriptRunner 只使用 ElementPlus） */
function makeCtx() {
  return {
    ElementPlus: {
      // prompt 结尾有 .catch 链，必须返回 Promise（never resolve，避免递归打开）
      ElMessageBox: { prompt: vi.fn(() => new Promise(() => {})), alert: vi.fn(() => new Promise(() => {})) },
      ElMessage: { success: vi.fn(), error: vi.fn() },
    },
  }
}

/** 调用 prompt 并返回其 options 与 mock 实例 */
function capturePrompt(ctx: ReturnType<typeof makeCtx>) {
  const promptOpts = (ctx.ElementPlus.ElMessageBox.prompt.mock.calls[0]![2] as any)
  const instance = { inputValue: 'return 1' }
  return { promptOpts, instance }
}

/** 模拟 blob import：createObjectURL 指向 fixture，revokeObjectURL 记 spy */
function stubObjectURL() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue(FIXTURE as unknown as string)
  return vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
}

beforeEach(() => {
  delete (globalThis as any).__scriptFixtureResult
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as any).__runScript
})

describe('initScriptRunner', () => {
  it('注入样式（只一次）并挂载 window.__runScript', () => {
    const ctx = makeCtx()
    initScriptRunner(ctx)
    initScriptRunner(ctx)

    expect(typeof window.__runScript).toBe('function')
    const styles = document.querySelectorAll('#script-runner-style')
    expect(styles.length).toBe(1)
    expect(ctx.ElementPlus.ElMessageBox.prompt).not.toHaveBeenCalled()
  })

  it('触发 __runScript 弹出 prompt 对话框', () => {
    const ctx = makeCtx()
    initScriptRunner(ctx)
    ;(window as any).__runScript()
    expect(ctx.ElementPlus.ElMessageBox.prompt).toHaveBeenCalledTimes(1)
  })
})

describe('openScriptDialog beforeClose', () => {
  function open(ctx: ReturnType<typeof makeCtx>) {
    initScriptRunner(ctx)
    ;(window as any).__runScript()
    return capturePrompt(ctx)
  }

  it('取消/关闭 → 直接 done，不执行脚本', async () => {
    const ctx = makeCtx()
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    promptOpts.beforeClose('cancel', instance, done)
    await Promise.resolve()
    expect(done).toHaveBeenCalled()
    expect(ctx.ElementPlus.ElMessageBox.alert).not.toHaveBeenCalled()
  })

  it('输入为空 → 直接 done', async () => {
    const ctx = makeCtx()
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    promptOpts.beforeClose('confirm', { inputValue: '   ' }, done)
    await Promise.resolve()
    expect(done).toHaveBeenCalled()
  })

  it('执行成功且返回非 undefined → alert 展示结果（对象 JSON 化）', async () => {
    const ctx = makeCtx()
    const revoke = stubObjectURL()
    ;(globalThis as any).__scriptFixtureResult = { value: { a: 1 } }
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    await promptOpts.beforeClose('confirm', instance, done)
    expect(done).toHaveBeenCalled()
    const [html, title] = ctx.ElementPlus.ElMessageBox.alert.mock.calls[0]!
    // JSON 引号经 escapeHtml 转义为 &quot;
    expect(html).toContain('&quot;a&quot;: 1')
    expect(title).toContain('执行成功')
    expect(revoke).toHaveBeenCalled()
  })

  it('执行成功返回字符串 → 原样展示', async () => {
    const ctx = makeCtx()
    stubObjectURL()
    ;(globalThis as any).__scriptFixtureResult = { value: 'hello world' }
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    await promptOpts.beforeClose('confirm', instance, done)
    const [html] = ctx.ElementPlus.ElMessageBox.alert.mock.calls[0]!
    expect(html).toContain('hello world')
  })

  it('返回 undefined → ElMessage.success 提示完成', async () => {
    const ctx = makeCtx()
    stubObjectURL()
    ;(globalThis as any).__scriptFixtureResult = undefined
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    await promptOpts.beforeClose('confirm', instance, done)
    expect(ctx.ElementPlus.ElMessageBox.alert).not.toHaveBeenCalled()
    expect(ctx.ElementPlus.ElMessage.success).toHaveBeenCalledWith(expect.stringContaining('执行完成'))
  })

  it('结果包含 HTML 特殊字符 → escapeHtml 转义', async () => {
    const ctx = makeCtx()
    stubObjectURL()
    ;(globalThis as any).__scriptFixtureResult = { value: '<script>&"' }
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    await promptOpts.beforeClose('confirm', instance, done)
    const [html] = ctx.ElementPlus.ElMessageBox.alert.mock.calls[0]!
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
    expect(html).not.toContain('<script>')
  })

  it('执行抛错 → alert 展示失败与堆栈', async () => {
    const ctx = makeCtx()
    const revoke = stubObjectURL()
    ;(globalThis as any).__scriptFixtureResult = { throw: true }
    const { promptOpts, instance } = open(ctx)
    const done = vi.fn()

    await promptOpts.beforeClose('confirm', instance, done)
    expect(done).toHaveBeenCalled()
    const [html, title] = ctx.ElementPlus.ElMessageBox.alert.mock.calls[0]!
    expect(title).toContain('执行失败')
    expect(html).toContain('boom')
    expect(revoke).toHaveBeenCalled()
  })
})
