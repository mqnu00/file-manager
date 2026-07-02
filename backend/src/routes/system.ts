import express, { Request, Response } from 'express'
import os from 'os'
import { execSync } from 'child_process'
import { asyncHandler } from '../middleware/asyncHandler'

const router = express.Router()

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  return parts.join(' ') || '0分钟'
}

function getCpuUsage(): number {
  try {
    const stat = os.cpus()
    let totalIdle = 0
    let totalTick = 0
    for (const cpu of stat) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times]
      }
      totalIdle += cpu.times.idle
    }
    return Math.round((1 - totalIdle / totalTick) * 1000) / 10
  } catch {
    return 0
  }
}

function getDiskInfo(): { path: string; total: number; free: number; used: number } {
  const baseDir = process.env.FILE_MANAGER_BASE_DIR || '/'
  try {
    const output = execSync(`df -B1 "${baseDir}" 2>/dev/null`, { encoding: 'utf-8' })
    const lines = output.trim().split('\n')
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/)
      if (parts.length >= 4) {
        const total = parseInt(parts[1], 10) || 0
        const free = parseInt(parts[3], 10) || 0
        const used = total - free
        return { path: baseDir, total, free, used }
      }
    }
  } catch {
    // fallback
  }
  return { path: baseDir, total: 0, free: 0, used: 0 }
}

router.get(
  '/',
  asyncHandler((_req: Request, res: Response) => {
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const disk = getDiskInfo()
    const cpuUsage = getCpuUsage()

    res.json({
      os: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        uptimeFormatted: formatUptime(os.uptime()),
      },
      cpu: {
        model: cpus.length > 0 ? cpus[0].model.replace(/\s+/g, ' ').trim() : 'Unknown',
        cores: cpus.length,
        physicalCores: cpus.length,
        speed: cpus.length > 0 ? cpus[0].speed : 0,
        usage: cpuUsage,
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
        totalFormatted: formatBytes(totalMem),
        freeFormatted: formatBytes(freeMem),
        usedFormatted: formatBytes(usedMem),
      },
      disk: {
        path: disk.path,
        total: disk.total,
        free: disk.free,
        used: disk.used,
        usagePercent: disk.total > 0 ? Math.round((disk.used / disk.total) * 1000) / 10 : 0,
        totalFormatted: formatBytes(disk.total),
        freeFormatted: formatBytes(disk.free),
        usedFormatted: formatBytes(disk.used),
      },
      node: {
        version: process.version,
        pid: process.pid,
      },
    })
  })
)

export default router
