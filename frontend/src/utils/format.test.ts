import { describe, it, expect } from 'vitest'
import { formatSize, formatTime, formatSpeed, formatProgress } from './format'

describe('formatSize', () => {
  it('字节单位', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(1023)).toBe('1023 B')
  })

  it('KB/MB/GB 单位', () => {
    expect(formatSize(2048)).toBe('2.00 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB')
    expect(formatSize(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
  })
})

describe('formatTime', () => {
  it('格式化为本地时间 YYYY-MM-DD HH:mm:ss', () => {
    // 用本地时间构造，避免测试环境时区差异
    const local = new Date(2026, 7, 6, 12, 34, 56)
    expect(formatTime(local.toISOString())).toBe('2026-08-06 12:34:56')
  })
})

describe('formatSpeed', () => {
  it('KB/s / MB/s / GB/s', () => {
    expect(formatSpeed(0.5)).toBe('512.00 KB/s')
    expect(formatSpeed(10)).toBe('10.00 MB/s')
    expect(formatSpeed(2048)).toBe('2.00 GB/s')
  })
})

describe('formatProgress', () => {
  it('无速度时只显示百分比', () => {
    expect(formatProgress(50, 0)).toBe('50%')
  })

  it('有速度与总量时估算剩余时间（秒）', () => {
    // totalSize 10MB，速度 10MB/s，进度 50% → 剩余 0.5s → toFixed(0) 四舍五入为 "1s"
    expect(formatProgress(50, 10, 10 * 1024 * 1024)).toBe('50% (1s 剩余)')
  })

  it('剩余时间超过 1 分钟显示分钟', () => {
    // totalSize 100MB，速度 1MB/s，进度 50% → 剩余 50s？ 不，50s < 60 显示秒
    // 进度 0 → 剩余 100s → "1.7m"
    expect(formatProgress(0, 1, 100 * 1024 * 1024)).toBe('0% (1.7m 剩余)')
  })
})
