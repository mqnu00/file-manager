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

function getCpuBaseFrequency(): number {
  // Linux: 使用 lscpu 获取 CPU 频率
  try {
    const output = execSync('lscpu | grep "CPU MHz"', { encoding: 'utf-8' })
    const match = output.match(/CPU MHz:\s*([\d.]+)/)
    if (match) {
      return parseFloat(match[1])
    }
  } catch {
    // lscpu 不可用，继续尝试其他方法
  }

  // macOS: 使用 sysctl 获取 CPU 频率
  try {
    const output = execSync('sysctl -n hw.cpufrequency 2>/dev/null', { encoding: 'utf-8' }).trim()
    const freqHz = parseInt(output, 10)
    if (!isNaN(freqHz) && freqHz > 0) {
      return Math.round(freqHz / 1000000) // 转换为 MHz
    }
  } catch {
    // sysctl 不可用，使用默认值
  }

  // 回退: 使用 os.cpus()
  const cpus = os.cpus()
  return cpus.length > 0 ? cpus[0].speed : 0
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
}

function getDiskInfo(mountpoint: string, mountpoints: string[], fstype: string, deviceSize: string): DiskInfo {
  let total = 0
  let free = 0

  // 遍历所有挂载点，累加各分区容量
  const targets = mountpoints.length > 0 ? mountpoints : [mountpoint]
  for (const mp of targets) {
    if (!mp || mp === '[SWAP]') continue
    try {
      const dfOutput = execSync(`df -T "${mp}" 2>/dev/null`, { encoding: 'utf-8' })
      const lines = dfOutput.trim().split('\n')
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/)
        if (parts.length >= 4) {
          if (!fstype && parts[1]) fstype = parts[1]
          total += (parseInt(parts[2], 10) || 0) * 1024
          free += (parseInt(parts[4], 10) || 0) * 1024
        }
      }
    } catch {
      // df 命令失败，跳过该挂载点
    }
  }

  return {
    device: '',
    vendor: '',
    model: '',
    mountpoint: mountpoint || '未挂载',
    mountpoints: mountpoints.length > 0 ? mountpoints : [mountpoint || '未挂载'],
    fstype: fstype || 'unknown',
    total,
    free,
    used: total - free,
    totalFormatted: total > 0 ? formatBytes(total) : deviceSize || 'Unknown',
    freeFormatted: free > 0 ? formatBytes(free) : '--',
    usedFormatted: total > 0 ? formatBytes(total - free) : '--',
  }
}

function getAllDisks(): DiskInfo[] {
  try {
    // 使用 lsblk 获取所有磁盘设备（包含子设备）
    const output = execSync('lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,VENDOR,MODEL 2>/dev/null', {
      encoding: 'utf-8',
    })
    const data = JSON.parse(output)
    const disks: DiskInfo[] = []

    if (data.blockdevices) {
      for (const device of data.blockdevices) {
        if (device.type === 'disk') {
          // 查找该磁盘下所有已挂载的分区（排除 SWAP）
          const partitions = device.children || []
          const mountedPartitions = partitions.filter(
            (p: { mountpoint?: string }) => p.mountpoint && p.mountpoint !== '[SWAP]'
          )

          // 收集所有挂载点
          const mountpoints = mountedPartitions.map((p: { mountpoint: string }) => p.mountpoint)
          const mountpoint = mountpoints[0] || device.mountpoint || ''
          const fstype = mountedPartitions[0]?.fstype || device.fstype || ''

          const diskInfo = getDiskInfo(mountpoint, mountpoints, fstype, device.size)
          diskInfo.device = `/dev/${device.name}`
          diskInfo.vendor = (device.vendor || '').trim()
          diskInfo.model = (device.model || '').trim()
          disks.push(diskInfo)
        }
      }
    }
    return disks
  } catch {
    return []
  }
}

router.get(
  '/',
  asyncHandler((_req: Request, res: Response) => {
    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const disks = getAllDisks()
    const defaultDisk =
      disks.find((d) => d.mountpoint === (process.env.FILE_MANAGER_BASE_DIR || '/')) || disks[0]
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
        speed: getCpuBaseFrequency(),
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
      disks: disks,
      node: {
        version: process.version,
        pid: process.pid,
      },
    })
  })
)

export default router
