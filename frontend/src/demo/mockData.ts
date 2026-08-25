import type { FileItem } from '@/types'
import type { AppConfig } from '@/api/config'
import type { LogEntry } from '@/api/file'

// ============================================================
// Mock 文件系统
// ============================================================

const now = Date.now()
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString()

export const mockFileTree: Record<string, FileItem[]> = {
  '': [
    {
      name: '文档',
      path: '文档',
      isDirectory: true,
      size: 0,
      modified: daysAgo(1),
    },
    {
      name: '图片',
      path: '图片',
      isDirectory: true,
      size: 0,
      modified: daysAgo(3),
    },
    {
      name: '代码',
      path: '代码',
      isDirectory: true,
      size: 0,
      modified: daysAgo(0),
    },
    {
      name: '音乐',
      path: '音乐',
      isDirectory: true,
      size: 0,
      modified: daysAgo(7),
    },
    {
      name: '视频',
      path: '视频',
      isDirectory: true,
      size: 0,
      modified: daysAgo(5),
    },
    {
      name: '.gitignore',
      path: '.gitignore',
      isDirectory: false,
      size: 128,
      modified: daysAgo(10),
    },
    {
      name: 'package.json',
      path: 'package.json',
      isDirectory: false,
      size: 2048,
      modified: daysAgo(0),
    },
  ],
  '文档': [
    {
      name: 'README.md',
      path: '文档/README.md',
      isDirectory: false,
      size: 2150,
      modified: daysAgo(2),
    },
    {
      name: 'CHANGELOG.md',
      path: '文档/CHANGELOG.md',
      isDirectory: false,
      size: 16080,
      modified: daysAgo(0),
    },
    {
      name: 'API文档.md',
      path: '文档/API文档.md',
      isDirectory: false,
      size: 8450,
      modified: daysAgo(4),
    },
    {
      name: '项目规划',
      path: '文档/项目规划',
      isDirectory: true,
      size: 0,
      modified: daysAgo(6),
    },
  ],
  '文档/项目规划': [
    {
      name: '需求文档.md',
      path: '文档/项目规划/需求文档.md',
      isDirectory: false,
      size: 5200,
      modified: daysAgo(14),
    },
    {
      name: '架构设计.md',
      path: '文档/项目规划/架构设计.md',
      isDirectory: false,
      size: 9800,
      modified: daysAgo(10),
    },
    {
      name: '迭代计划.md',
      path: '文档/项目规划/迭代计划.md',
      isDirectory: false,
      size: 3400,
      modified: daysAgo(5),
    },
  ],
  '图片': [
    {
      name: 'screenshot.png',
      path: '图片/screenshot.png',
      isDirectory: false,
      size: 250880,
      modified: daysAgo(7),
    },
    {
      name: 'logo.svg',
      path: '图片/logo.svg',
      isDirectory: false,
      size: 3280,
      modified: daysAgo(14),
    },
    {
      name: 'banner.jpg',
      path: '图片/banner.jpg',
      isDirectory: false,
      size: 450560,
      modified: daysAgo(8),
    },
  ],
  '代码': [
    {
      name: 'app.ts',
      path: '代码/app.ts',
      isDirectory: false,
      size: 8600,
      modified: daysAgo(0),
    },
    {
      name: 'utils.ts',
      path: '代码/utils.ts',
      isDirectory: false,
      size: 4200,
      modified: daysAgo(3),
    },
    {
      name: 'components',
      path: '代码/components',
      isDirectory: true,
      size: 0,
      modified: daysAgo(1),
    },
  ],
  '代码/components': [
    {
      name: 'Toolbar.vue',
      path: '代码/components/Toolbar.vue',
      isDirectory: false,
      size: 6400,
      modified: daysAgo(2),
    },
    {
      name: 'FileTable.vue',
      path: '代码/components/FileTable.vue',
      isDirectory: false,
      size: 5200,
      modified: daysAgo(1),
    },
    {
      name: 'ContextMenu.vue',
      path: '代码/components/ContextMenu.vue',
      isDirectory: false,
      size: 1800,
      modified: daysAgo(5),
    },
  ],
  '音乐': [],
  '视频': [
    {
      name: 'demo.mp4',
      path: '视频/demo.mp4',
      isDirectory: false,
      size: 52428800,
      modified: daysAgo(12),
    },
  ],
}

// ============================================================
// Mock 系统信息
// ============================================================

// ============================================================
// Mock 配置
// ============================================================

export const mockConfig: AppConfig = {
  auth: {
    token: 'abc123***',
    tokenExpiryHours: 24,
  },
  storageRoot: '/home/user/files',
  log: {
    cleanupOnStartup: true,
    retentionDays: 30,
  },
}

// ============================================================
// Mock 日志
// ============================================================

function logTime(daysAgo: number, hour: number, minute: number): string {
  const d = new Date(now - daysAgo * 86400000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const mockLogs: LogEntry[] = [
  {
    time: logTime(0, 9, 15),
    level: 'INFO',
    action: 'login',
    detail: '用户登录成功',
  },
  {
    time: logTime(0, 9, 16),
    level: 'INFO',
    action: 'list',
    detail: '列出目录 /home/user/files',
  },
  {
    time: logTime(0, 9, 30),
    level: 'INFO',
    action: 'create',
    detail: '创建文件夹 /home/user/files/新项目',
  },
  {
    time: logTime(0, 10, 5),
    level: 'WARN',
    action: 'other',
    detail: '文件大小计算超时: /home/user/files/大文件夹',
  },
  {
    time: logTime(0, 10, 22),
    level: 'INFO',
    action: 'move',
    detail: '移动 /home/user/files/旧文档 → /home/user/files/归档/旧文档',
  },
  {
    time: logTime(0, 11, 0),
    level: 'ERROR',
    action: 'delete',
    detail: '删除失败: 权限不足 /home/user/files/受保护文件',
  },
  {
    time: logTime(1, 14, 30),
    level: 'INFO',
    action: 'rename',
    detail: '重命名 /home/user/files/文档1.md → 文档v2.md',
  },
  {
    time: logTime(1, 15, 45),
    level: 'INFO',
    action: 'login',
    detail: '用户登录成功',
  },
  {
    time: logTime(1, 16, 10),
    level: 'WARN',
    action: 'other',
    detail: 'GET /api/files: 路径不存在 /tmp/nonexistent',
  },
  {
    time: logTime(2, 8, 0),
    level: 'INFO',
    action: 'login',
    detail: '用户登录成功',
  },
  {
    time: logTime(2, 9, 20),
    level: 'INFO',
    action: 'create',
    detail: '创建文件夹 /home/user/files/backup',
  },
  {
    time: logTime(2, 9, 35),
    level: 'INFO',
    action: 'move',
    detail: '移动 /home/user/files/数据备份 → /home/user/files/backup/数据备份',
  },
  {
    time: logTime(4, 16, 0),
    level: 'INFO',
    action: 'delete',
    detail: '删除 /home/user/files/临时文件.tmp',
  },
  {
    time: logTime(5, 10, 30),
    level: 'INFO',
    action: 'rename',
    detail: '重命名 /home/user/files/项目A → 项目Alpha',
  },
  {
    time: logTime(6, 14, 0),
    level: 'INFO',
    action: 'login',
    detail: '用户登录成功',
  },
]

// 近 7 天的日期列表
export function getMockLogDates(): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now - i * 86400000)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}
