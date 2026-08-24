import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import * as sudo from '../services/sudoService'
import { createSession } from '../middleware/auth'
import { STORAGE_ROOT } from '../../test/setup'

let authHeader: string

beforeEach(() => {
  authHeader = `Bearer ${createSession()}`
  sudo.clearCredentials()
  // 默认启用提权
  sudo.__setConfigGetter(() => ({
    auth: { token: 'x', tokenExpiryHours: 1, elevationTtlMinutes: 5 },
    storageRoot: '/',
    log: { cleanupOnStartup: true, retentionDays: 1 },
    features: { sudoElevation: true },
    plugins: {},
  }))
  // 记录 sudo 调用
  sudo.__setRunner(() => {
    /* 成功，不实际执行 */
  })
})

afterEach(() => {
  sudo.__setRunner(null)
  sudo.__setConfigGetter(null)
  sudo.clearCredentials()
  vi.restoreAllMocks()
})

/** 强制 fs.writeFileSync 抛 EACCES（与运行用户/环境无关，确定性触发提权分支） */
function forceWriteEacces(): void {
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
    const e: any = new Error('EACCES')
    e.code = 'EACCES'
    throw e
  })
}

describe('文件操作提权（集成）', () => {
  it('无凭据且权限不足 → 403 + code=ELEVATION_REQUIRED', async () => {
    forceWriteEacces()
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'elevated.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ELEVATION_REQUIRED')
  })

  it('已缓存凭据且权限不足 → 走 sudo 重试并返回 200', async () => {
    const calls: string[][] = []
    sudo.__setRunner((args) => {
      calls.push(args)
    })
    sudo.setCredentials('ubuntu', 'pw', true)
    forceWriteEacces()
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'elevated.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    // 已缓存凭据 → 经 sudo touch 创建（参数含 -- 防护）
    expect(calls.some((a) => a[0] === 'touch' && a.includes('--'))).toBe(true)
  })

  it('未启用提权（features.sudoElevation=false）且权限不足 → 不进入提权流程', async () => {
    sudo.__setConfigGetter(() => ({
      auth: { token: 'x', tokenExpiryHours: 1, elevationTtlMinutes: 5 },
      storageRoot: '/',
      log: { cleanupOnStartup: true, retentionDays: 1 },
      features: { sudoElevation: false },
      plugins: {},
    }))
    forceWriteEacces()
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'elevated.txt' })
      .set('Authorization', authHeader)
    expect(res.body.code).not.toBe('ELEVATION_REQUIRED')
  })

  it('目录本身不可读且无凭据 → 403 ELEVATION_REQUIRED', async () => {
    const e: any = new Error('EACCES')
    e.code = 'EACCES'
    const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw e
    })
    const res = await request(app)
      .get('/api/files')
      .query({ path: '' })
      .set('Authorization', authHeader)
    spy.mockRestore()
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ELEVATION_REQUIRED')
  })

  it('目录本身不可读且有凭据 → sudo find 列目录并解析', async () => {
    const calls: string[][] = []
    sudo.__setRunner((args) => {
      calls.push(args)
      return 'd\t4096\t1700000000\tsub\nf\t123\t1700000001.5\tfile.txt\n'
    })
    sudo.setCredentials('ubuntu', 'pw', true)
    const e: any = new Error('EACCES')
    e.code = 'EACCES'
    const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw e
    })
    const res = await request(app)
      .get('/api/files')
      .query({ path: '' })
      .set('Authorization', authHeader)
    spy.mockRestore()
    expect(res.status).toBe(200)
    // 文件夹在前；find 输出被正确解析为 FileInfo
    expect(res.body.files.map((f: { name: string }) => f.name)).toEqual(['sub', 'file.txt'])
    expect(res.body.files[0].isDirectory).toBe(true)
    expect(res.body.files[1].size).toBe(123)
    expect(calls.some((a) => a[0] === 'find')).toBe(true)
  })

  it('单条目 stat EACCES（如受限符号链接）→ 降级展示，整页不失败', async () => {
    fs.writeFileSync(path.join(STORAGE_ROOT, 'ok.txt'), 'ok')
    fs.writeFileSync(path.join(STORAGE_ROOT, 'bad.txt'), 'bad')
    const realStat = fs.statSync
    const spy = vi.spyOn(fs, 'statSync').mockImplementation(((p: unknown, opts?: unknown) => {
      if (String(p).endsWith('bad.txt')) {
        const e: any = new Error('EACCES')
        e.code = 'EACCES'
        throw e
      }
      return realStat.call(fs, p, opts)
    }) as typeof fs.statSync)
    const res = await request(app)
      .get('/api/files')
      .query({ path: '' })
      .set('Authorization', authHeader)
    spy.mockRestore()
    expect(res.status).toBe(200)
    const names = res.body.files.map((f: { name: string }) => f.name)
    expect(names).toContain('ok.txt')
    expect(names).toContain('bad.txt') // 降级展示而非整页 500
  })

  it('权限正常时仍直接 fs 写入，不触发 sudo', async () => {
    const calls: string[][] = []
    sudo.__setRunner((args) => {
      calls.push(args)
    })
    sudo.setCredentials('ubuntu', 'pw', true)
    calls.length = 0 // 清除 setCredentials 自身的校验调用，仅观察实际操作是否触发 sudo
    const res = await request(app)
      .post('/api/files')
      .send({ path: '', name: 'normal.txt' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(fs.existsSync(path.join(STORAGE_ROOT, 'normal.txt'))).toBe(true)
    expect(calls.length).toBe(0) // 未触发 sudo
  })

  it('读取无权限文件且无凭据 → 403 ELEVATION_REQUIRED', async () => {
    fs.writeFileSync(path.join(STORAGE_ROOT, 'secret.txt'), 'secret')
    const e: any = new Error('EACCES')
    e.code = 'EACCES'
    const spy = vi.spyOn(fs, 'openSync').mockImplementation(() => {
      throw e
    })
    const res = await request(app)
      .get('/api/files/read')
      .query({ path: 'secret.txt' })
      .set('Authorization', authHeader)
    spy.mockRestore()
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ELEVATION_REQUIRED')
  })

  it('读取无权限文件且有凭据 → sudo dd 读取并按区间裁剪', async () => {
    const calls: string[][] = []
    sudo.__setRunner((args) => {
      calls.push(args)
      return Buffer.from('abcdefghij') // 模拟 dd 输出（首块）
    })
    sudo.setCredentials('ubuntu', 'pw', true)
    fs.writeFileSync(path.join(STORAGE_ROOT, 'secret.txt'), 'secret')
    const e: any = new Error('EACCES')
    e.code = 'EACCES'
    const spy = vi.spyOn(fs, 'openSync').mockImplementation(() => {
      throw e
    })
    // offset=5, length=3 → 期望裁剪出 'fgh'
    const res = await request(app)
      .get('/api/files/read')
      .query({ path: 'secret.txt', offset: 5, length: 3 })
      .set('Authorization', authHeader)
    spy.mockRestore()
    expect(res.status).toBe(200)
    expect(Buffer.from(res.body.data, 'base64').toString()).toBe('fgh')
    expect(res.body.length).toBe(3)
    // dd 参数：4KB 块对齐，skip=0 count=1
    const dd = calls.find((a) => a[0] === 'dd')
    expect(dd).toBeDefined()
    expect(dd!.some((x) => x.startsWith('if=') && x.endsWith('secret.txt'))).toBe(true)
    expect(dd).toContain('skip=0')
    expect(dd).toContain('count=1')
  })
})
