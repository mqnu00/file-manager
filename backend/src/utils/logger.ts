import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(__dirname, '../../logs')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function getLogFilePath(date?: Date): string {
  const d = date || new Date()
  const dateStr = d.toISOString().split('T')[0]
  return path.join(LOG_DIR, `${dateStr}.log`)
}

function formatTime(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC')
}

export function log(level: 'INFO' | 'WARNING' | 'ERROR', action: string, detail: string) {
  try {
    ensureLogDir()
    const line = `[${formatTime()}] [${level}] [${action}] ${detail}\n`
    fs.appendFileSync(getLogFilePath(), line)
  } catch {
    // 日志写入失败不应影响主流程
  }
}

export interface LogFilters {
  level?: string
  action?: string
  keyword?: string
}

export function readLogs(date: string, filters?: LogFilters): string[] {
  const filePath = path.join(LOG_DIR, `${date}.log`)
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  return lines.filter((line) => {
    if (filters?.level && !line.includes(`[${filters.level}]`)) return false
    if (filters?.action && !line.includes(`[${filters.action}]`)) return false
    if (filters?.keyword && !line.includes(filters.keyword)) return false
    return true
  })
}

/**
 * 扫描日志目录，返回所有可用日志文件的日期列表
 */
export function getAvailableDates(): string[] {
  ensureLogDir()
  const files = fs.readdirSync(LOG_DIR)
  const datePattern = /^\d{4}-\d{2}-\d{2}\.log$/
  return files
    .filter((f) => datePattern.test(f))
    .map((f) => f.replace(/\.log$/, ''))
    .sort()
}

/**
 * 生成从 start 到 end 范围内的所有日期字符串（含起止）
 */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const startDate = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  const current = new Date(startDate)
  while (current <= endDate) {
    const y = current.getUTCFullYear()
    const m = String(current.getUTCMonth() + 1).padStart(2, '0')
    const d = String(current.getUTCDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}

/**
 * 按日期范围查询日志，日期格式 YYYY-MM-DD
 */
export function readLogsByRange(startDate: string, endDate: string, filters?: LogFilters): string[] {
  const dateRange = getDateRange(startDate, endDate)
  const allLogs: string[] = []
  for (const date of dateRange) {
    const logs = readLogs(date, filters)
    allLogs.push(...logs)
  }
  return allLogs
}
