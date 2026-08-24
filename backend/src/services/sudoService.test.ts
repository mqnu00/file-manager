import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as sudo from './sudoService'
import { AppError } from '../utils/AppError'
import type { AppConfig } from '../config'

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    auth: { token: 'x', tokenExpiryHours: 1, elevationTtlMinutes: 5 },
    storageRoot: '/',
    log: { cleanupOnStartup: true, retentionDays: 1 },
    features: { sudoElevation: true },
    plugins: {},
    ...overrides,
  }
}

describe('sudoService', () => {
  let calls: { args: string[]; password: string }[] = []

  beforeEach(() => {
    calls = []
    sudo.clearCredentials()
    sudo.__setConfigGetter(() => fakeConfig())
    sudo.__setRunner((args, password) => {
      calls.push({ args, password })
    })
  })

  afterEach(() => {
    sudo.__setRunner(null)
    sudo.__setConfigGetter(null)
    sudo.clearCredentials()
    vi.useRealTimers()
  })

  it('setCredentials 成功 → 缓存凭据且 hasCredentials 为真', () => {
    expect(sudo.setCredentials('u', 'p', true)).toBe(true)
    expect(sudo.hasCredentials()).toBe(true)
    expect(sudo.shouldChownBack()).toBe(true)
  })

  it('setCredentials 失败（runner 抛错）→ 返回 false 且不缓存', () => {
    sudo.__setRunner(() => {
      throw new Error('auth fail')
    })
    expect(sudo.setCredentials('u', 'wrong', true)).toBe(false)
    expect(sudo.hasCredentials()).toBe(false)
  })

  it('chownBack=false 时 shouldChownBack 返回 false', () => {
    sudo.setCredentials('u', 'p', false)
    expect(sudo.shouldChownBack()).toBe(false)
  })

  it('未缓存时 shouldChownBack 默认 true', () => {
    sudo.clearCredentials()
    expect(sudo.shouldChownBack()).toBe(true)
  })

  it('runElevated 无凭据 → 抛 ELEVATION_REQUIRED', () => {
    let caught: AppError | null = null
    try {
      sudo.runElevated(['true'])
    } catch (e) {
      caught = e as AppError
    }
    expect(caught).toBeInstanceOf(AppError)
    expect(caught?.code).toBe('ELEVATION_REQUIRED')
    expect(caught?.statusCode).toBe(403)
  })

  it('runElevated 有凭据 → 以数组参数调用 runner 并携带密码', () => {
    sudo.setCredentials('u', 'secret', true)
    sudo.runElevated(['touch', '--', '/tmp/x'])
    const last = calls[calls.length - 1]
    expect(last.args).toEqual(['touch', '--', '/tmp/x'])
    expect(last.password).toBe('secret')
  })

  it('runElevated sudo 失败 → 清凭据并抛 500 AppError', () => {
    sudo.setCredentials('u', 'secret', true)
    const err: any = new Error('denied')
    err.stderr = Buffer.from('sudo: 1 incorrect password attempt')
    sudo.__setRunner(() => {
      throw err
    })
    expect(() => sudo.runElevated(['true'])).toThrow(/sudo 执行失败/)
    expect(sudo.hasCredentials()).toBe(false)
  })

  it('凭据超过 TTL 后 hasCredentials 返回 false 并清除', () => {
    vi.useFakeTimers()
    sudo.setCredentials('u', 'p', true)
    expect(sudo.hasCredentials()).toBe(true)
    vi.advanceTimersByTime(5 * 60_000 + 1000)
    expect(sudo.hasCredentials()).toBe(false)
    vi.useRealTimers()
  })

  it('isEnabled 受 features.sudoElevation 控制', () => {
    sudo.__setConfigGetter(() => fakeConfig({ features: { sudoElevation: false } }))
    expect(sudo.isEnabled()).toBe(false)
    sudo.__setConfigGetter(() => fakeConfig({ features: { sudoElevation: true } }))
    expect(sudo.isEnabled()).toBe(true)
    sudo.__setConfigGetter(() => fakeConfig({ features: undefined }))
    expect(sudo.isEnabled()).toBe(true)
  })

  it('TTL 取自配置 elevationTtlMinutes', () => {
    sudo.__setConfigGetter(() => fakeConfig({ auth: { token: 'x', tokenExpiryHours: 1, elevationTtlMinutes: 10 } }))
    vi.useFakeTimers()
    sudo.setCredentials('u', 'p', true)
    vi.advanceTimersByTime(5 * 60_000) // 未满 10 分钟
    expect(sudo.hasCredentials()).toBe(true)
    vi.advanceTimersByTime(5 * 60_000 + 1000) // 超过 10 分钟
    expect(sudo.hasCredentials()).toBe(false)
    vi.useRealTimers()
  })
})
