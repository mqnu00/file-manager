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
