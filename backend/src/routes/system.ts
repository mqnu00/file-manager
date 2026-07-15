import express, { Request, Response } from 'express'
import os from 'os'
import { execSync } from 'child_process'
import si from 'systeminformation'
import { asyncHandler } from '../middleware/asyncHandler'
import { getStorageRoot } from '../utils/safePath'

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

interface DiskInfo {
  device: string
  vendor: string
  model: string
  mountpoint: string
  mountpoints: string[]
  fstype: string
  total: number
  free: number
  used: number
  totalFormatted: string
  freeFormatted: string
  usedFormatted: string
  partitions: Array<{
    mountpoint: string
    totalFormatted: string
    usedFormatted: string
    percent: number
  }>
}

/** 提取基础设备名: Linux /dev/sda1 → sda, Windows C: → C */
function getBaseDevice(devPath: string): string {
  if (process.platform === 'win32') {
    return devPath.replace(/^([A-Z]):.*$/i, '$1')
  }
  return devPath.replace(/\/dev\//, '').replace(/\d+$/, '')
}

/** 构建磁盘列表，将 fsSize 条目按物理磁盘分组 */
function buildDiskList(
  fsSizes: si.Systeminformation.FsSizeData[],
  diskLayouts: si.Systeminformation.DiskLayoutData[]
): DiskInfo[] {
  // 构建 vendor/model 查找表
  const layoutMap = new Map<string, si.Systeminformation.DiskLayoutData>()
  for (const dl of diskLayouts) {
    layoutMap.set(getBaseDevice(dl.device), dl)
  }

  // 按基础设备名分组，过滤虚拟文件系统
  const groups = new Map<string, si.Systeminformation.FsSizeData[]>()
  for (const fs of fsSizes) {
    if (['tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'nsfs'].includes(fs.type)) continue
    const base = getBaseDevice(fs.fs)
    if (!groups.has(base)) groups.set(base, [])
    const group = groups.get(base)
    if (group) group.push(fs)
  }

  const disks: DiskInfo[] = []
  for (const [base, partitions] of groups) {
    const layout = layoutMap.get(base)
    const mountpoints = partitions.map((p) => p.mount).filter(Boolean)
    let total = 0
    let free = 0
    const partDetails: DiskInfo['partitions'] = []

    for (const p of partitions) {
      total += p.size
      free += p.available
      partDetails.push({
        mountpoint: p.mount,
        totalFormatted: formatBytes(p.size),
        usedFormatted: formatBytes(p.used),
        percent: Math.round(p.use),
      })
    }

    let device: string
    if (process.platform === 'win32') {
      device = layout?.device || base + ':'
    } else {
      device = layout?.device || '/dev/' + base
    }

    disks.push({
      device,
      vendor: (layout?.vendor || '').trim(),
      model: (layout?.type || '').trim(),
      mountpoint: mountpoints[0] || '未挂载',
      mountpoints: mountpoints.length > 0 ? mountpoints : ['未挂载'],
      fstype: partitions[0]?.type || 'unknown',
      total,
      free,
      used: total - free,
      totalFormatted: total > 0 ? formatBytes(total) : 'Unknown',
      freeFormatted: free > 0 ? formatBytes(free) : '--',
      usedFormatted: total > 0 ? formatBytes(total - free) : '--',
      partitions: partDetails,
    })
  }

  return disks
}

/** 获取 CPU 频率 (MHz)，systeminformation 在 WSL/容器环境可能返回 0，逐级回退 */
function getCpuSpeed(cpuInfo: si.Systeminformation.CpuData): number {
  if (cpuInfo.speed > 0) return Math.round(cpuInfo.speed * 1000)
  if (cpuInfo.speedMax > 0) return Math.round(cpuInfo.speedMax * 1000)

  // Linux: 尝试 lscpu 命令行获取
  if (process.platform === 'linux') {
    try {
      const output = execSync('lscpu | grep "CPU MHz"', { encoding: 'utf-8' })
      const match = output.match(/CPU MHz:\s*([\d.]+)/)
      if (match) return parseFloat(match[1])
    } catch {
      // lscpu 不可用，继续回退
    }
  }

  const cpus = os.cpus()
  return cpus.length > 0 ? cpus[0].speed : 0
}

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const [cpuInfo, currentLoad, mem, fsSizes, diskLayouts] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.diskLayout(),
    ])

    const disks = buildDiskList(fsSizes, diskLayouts)
    const storageRoot = getStorageRoot()
    const defaultDisk =
      disks.find((d) => d.mountpoint === storageRoot) ||
      disks.find((d) => d.mountpoints.includes(storageRoot)) ||
      disks[0]

    const cpus = os.cpus()

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
        model: cpuInfo.brand || (cpus.length > 0 ? cpus[0].model.replace(/\s+/g, ' ').trim() : 'Unknown'),
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: getCpuSpeed(cpuInfo),
        usage: Math.round(currentLoad.currentLoad * 10) / 10,
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        usagePercent: Math.round((mem.used / mem.total) * 1000) / 10,
        totalFormatted: formatBytes(mem.total),
        freeFormatted: formatBytes(mem.free),
        usedFormatted: formatBytes(mem.used),
      },
      disk: defaultDisk || {
        device: 'Unknown',
        mountpoint: '/',
        fstype: 'unknown',
        total: 0,
        free: 0,
        used: 0,
        totalFormatted: '0 B',
        freeFormatted: '0 B',
        usedFormatted: '0 B',
      },
      disks,
      node: {
        version: process.version,
        pid: process.pid,
      },
    })
  })
)

export default router
