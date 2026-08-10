import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import { createSession } from '../middleware/auth'
import { log } from '../utils/logger'

let authHeader: string

function today(): string {
  return new Date().toISOString().split('T')[0]
}

beforeAll(() => {
  authHeader = `Bearer ${createSession()}`
  // 预置日志（写入 LOG_DIR 当天文件）
  log('INFO', 'page-open', '用户进入文件列表')
  log('INFO', 'file-download', '下载了 report.pdf')
  log('ERROR', 'auth-fail', '令牌错误: invalid')
  log('WARNING', 'disk', '磁盘空间不足 10%')
})

describe('日志 API（集成）', () => {
  it('未认证访问 → 401', async () => {
    const res = await request(app).get('/api/logs')
    expect(res.status).toBe(401)
  })

  it('按日期读取日志并解析', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ date: today() })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(4)
    const actions = res.body.logs.map((l: { action: string }) => l.action)
    expect(actions).toContain('page-open')
    expect(actions).toContain('auth-fail')
  })

  it('无日志日期返回空数组', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ date: '1999-01-01' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.logs).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('按 level 过滤', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ date: today(), level: 'ERROR' })
      .set('Authorization', authHeader)
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1)
    expect(res.body.logs.every((l: { level: string }) => l.level === 'ERROR')).toBe(true)
  })

  it('按 keyword 过滤 detail', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ date: today(), keyword: 'report.pdf' })
      .set('Authorization', authHeader)
    expect(res.body.logs.length).toBe(1)
    expect(res.body.logs[0].action).toBe('file-download')
  })

  it('分页：pageSize 与 total 正确', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ date: today(), pageSize: '2', page: '1' })
      .set('Authorization', authHeader)
    expect(res.body.logs.length).toBe(2)
    expect(res.body.total).toBeGreaterThanOrEqual(4)
  })

  it('区间查询（startDate=endDate 等价单日）', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ startDate: today(), endDate: today() })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(4)
  })

  it('日期列表包含当天', async () => {
    const res = await request(app).get('/api/logs/dates').set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.dates).toContain(today())
  })

  it('异常日期参数不会导致 500', async () => {
    // 日期仅用于拼接文件名；非法值返回空结果而非崩溃
    const res = await request(app)
      .get('/api/logs')
      .query({ date: '..%2F..%2Fetc' })
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
  })
})

describe('日志文件清理端点', () => {
  it('clean-logs 正常返回删除数', async () => {
    fs.writeFileSync(path.join(process.env.LOG_DIR!, '2020-01-01.log'), '', 'utf-8')
    const res = await request(app)
      .post('/api/config/clean-logs')
      .set('Authorization', authHeader)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.deleted).toBeGreaterThanOrEqual(1)
  })
})
