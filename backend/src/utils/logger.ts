import fs from 'fs'
import path from 'path'

const LOG_DIR = process.env.LOG_DIR
  || path.join(__dirname, '../../logs')

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

export interface LogEntry {
  time: string
  level: string
  action: string
  detail: string
}

const LOG_LINE_REGEX = /^\[(.+?)\]\s\[(.+?)\]\s\[(.+?)\]\s(.+)$/

function parseLogLine(line: string): LogEntry | null {
  const match = line.match(LOG_LINE_REGEX)
  if (!match) return null
  return {
    time: match[1],
    level: match[2],
    action: match[3],
    detail: match[4],
  }
}

export interface LogFilters {
  level?: string
  action?: string
  keyword?: string
}

export function readLogs(date: string, filters?: LogFilters): LogEntry[] {
  const filePath = path.join(LOG_DIR, `${date}.log`)
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  return lines
    .map(parseLogLine)
    .filter((entry): entry is LogEntry => {
      if (!entry) return false
      if (filters?.level && entry.level !== filters.level) return false
      if (filters?.action && entry.action !== filters.action) return false
      if (filters?.keyword && !entry.detail.includes(filters.keyword)) return false
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
export function readLogsByRange(startDate: string, endDate: string, filters?: LogFilters): LogEntry[] {
  const dateRange = getDateRange(startDate, endDate)
  const allLogs: LogEntry[] = []
  for (const date of dateRange) {
    const logs = readLogs(date, filters)
    allLogs.push(...logs)
  }
  return allLogs
}

/**
 * 清理超过 maxDays 天的旧日志文件
 * 建议在应用启动时调用
 */
export function cleanOldLogs(maxDays: number = 30): number {
  try {
    ensureLogDir()
    const files = fs.readdirSync(LOG_DIR)
    const datePattern = /^\d{4}-\d{2}-\d{2}\.log$/
    const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000
    let deleted = 0
    for (const file of files) {
      if (!datePattern.test(file)) continue
      const fileDate = file.replace(/\.log$/, '')
      const timestamp = new Date(fileDate + 'T00:00:00Z').getTime()
      if (timestamp < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file))
        deleted++
      }
    }
    return deleted
  } catch {
    return 0
  }
}
