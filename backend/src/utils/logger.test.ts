import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { log, readLogs, readLogsByRange, getAvailableDates, cleanOldLogs } from './logger'

const LOG_DIR = process.env.LOG_DIR as string

function today(): string {
  return new Date().toISOString().split('T')[0]
}

describe('log 写入', () => {
  it('写入当天日志文件，行格式正确', () => {
    log('INFO', 'test-action', 'hello detail')
    const filePath = path.join(LOG_DIR, `${today()}.log`)
    expect(fs.existsSync(filePath)).toBe(true)
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/^\[.+?\] \[INFO\] \[test-action\] hello detail\n/m)
  })
})

describe('readLogs', () => {
  it('读取并解析日志条目', () => {
    log('WARNING', 'list', 'warn detail')
    const entries = readLogs(today())
    const match = entries.find((e) => e.action === 'list')
    expect(match).toBeTruthy()
    if (!match) return
    expect(match.level).toBe('WARNING')
    expect(match.detail).toBe('warn detail')
    expect(match.time).toMatch(/^\d{4}-\d{2}-\d{2} /)
  })

  it('不存在的日期返回空数组', () => {
    expect(readLogs('1999-01-01')).toEqual([])
  })

  it('按 level 过滤', () => {
    log('ERROR', 'filter-test', 'error line')
    const errors = readLogs(today(), { level: 'ERROR' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.every((e) => e.level === 'ERROR')).toBe(true)
  })

  it('按 action 过滤', () => {
    const filtered = readLogs(today(), { action: 'filter-test' })
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((e) => e.action === 'filter-test')).toBe(true)
  })

  it('按 keyword 过滤 detail', () => {
    log('INFO', 'kw-test', 'contains-unique-keyword')
    const hit = readLogs(today(), { keyword: 'unique-keyword' })
    expect(hit.length).toBeGreaterThan(0)
    expect(hit[0].action).toBe('kw-test')

    const miss = readLogs(today(), { keyword: 'no-such-keyword' })
    expect(miss).toEqual([])
  })
})

describe('readLogsByRange', () => {
  it('跨日期合并日志，单日起止等价', () => {
    log('INFO', 'range-test', 'in range')
    const all = readLogsByRange(today(), today())
    expect(all.some((e) => e.action === 'range-test')).toBe(true)
  })

  it('非法/反向区间返回空数组', () => {
    expect(readLogsByRange('2026-08-10', '2026-08-01')).toEqual([])
  })
})

describe('getAvailableDates', () => {
  it('只返回 YYYY-MM-DD.log 格式日期并排序', () => {
    fs.writeFileSync(path.join(LOG_DIR, '2026-08-05.log'), '', 'utf-8')
    fs.writeFileSync(path.join(LOG_DIR, '2026-08-06.log'), '', 'utf-8')
    fs.writeFileSync(path.join(LOG_DIR, 'not-a-date.log'), '', 'utf-8')
    fs.writeFileSync(path.join(LOG_DIR, 'readme.txt'), '', 'utf-8')

    const dates = getAvailableDates()
    expect(dates).toContain('2026-08-05')
    expect(dates).toContain('2026-08-06')
    expect(dates).not.toContain('not-a-date')
    expect(dates).toEqual([...dates].sort())
  })
})

describe('cleanOldLogs', () => {
  it('删除早于保留期限的日志，保留未来日期', () => {
    fs.writeFileSync(path.join(LOG_DIR, '2020-01-01.log'), '', 'utf-8')
    fs.writeFileSync(path.join(LOG_DIR, '2099-01-01.log'), '', 'utf-8')

    const deleted = cleanOldLogs(0)
    expect(deleted).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(LOG_DIR, '2020-01-01.log'))).toBe(false)
    // 未来日期不受影响
    expect(fs.existsSync(path.join(LOG_DIR, '2099-01-01.log'))).toBe(true)
    fs.rmSync(path.join(LOG_DIR, '2099-01-01.log'), { force: true })
  })

  it('无过期日志返回 0', () => {
    fs.writeFileSync(path.join(LOG_DIR, '2099-01-02.log'), '', 'utf-8')
    expect(cleanOldLogs(36500)).toBe(0)
    fs.rmSync(path.join(LOG_DIR, '2099-01-02.log'), { force: true })
  })
})
