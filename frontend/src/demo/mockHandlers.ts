import type { AxiosInstance } from 'axios'
import { mockFileTree, mockSystemInfo, mockConfig, mockLogs, getMockLogDates } from './mockData'
import type { FileItem } from '@/types'

// 可变的文件树副本（同一会话内可操作）
let tree: Record<string, FileItem[]> = {}

function initTree() {
  tree = JSON.parse(JSON.stringify(mockFileTree))
}

function randomDelay(): number {
  return 200 + Math.random() * 250
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cloneFileTree(): Record<string, FileItem[]> {
  return JSON.parse(JSON.stringify(tree))
}

function getFilesInDir(dirPath: string): FileItem[] {
  const key = dirPath.replace(/^\/+/, '')
  return tree[key] ?? []
}

export function setupMockApi(api: AxiosInstance) {
  initTree()

  // 拦截所有请求
  api.interceptors.request.use((config) => {
    const url = config.url || ''
    const method = (config.method || 'get').toLowerCase()

    // 构建完整路径：axios 的 baseURL 在拦截器阶段尚未拼接到 url
    const baseURL = (config.baseURL || '').replace(/\/$/, '')
    const fullUrl = url.startsWith('/') ? baseURL + url : url

    // 只拦截 /api/ 请求
    if (!fullUrl.startsWith('/api/')) {
      return config
    }

    // 构造 mock 响应的辅助函数
    const mockResponse = (data: unknown) => {
      // 使用 adapter 方式返回 mock 数据
      // 修改 config.adapter 绕过真实请求
      ;(config as unknown as Record<string, unknown>).adapter = async () => {
        // 写操作延迟稍长
        const delay = method === 'get' ? randomDelay() : randomDelay() + 100
        await sleep(delay)
        return {
          data: JSON.parse(JSON.stringify(data)),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      }
      return config
    }

    // ============================================================
    // Auth
    // ============================================================
    if (fullUrl === '/api/auth/check') {
      return mockResponse({ valid: true })
    }
    if (fullUrl === '/api/auth/login') {
      return mockResponse({ success: true, sessionToken: 'demo-token', expiresIn: 99999 })
    }
    if (fullUrl === '/api/auth/logout') {
      return mockResponse({ success: true })
    }

    // ============================================================
    // Files
    // ============================================================
    if (fullUrl === '/api/files' && method === 'get') {
      const path = (config.params?.path as string) || ''
      const files = getFilesInDir(path)
      return mockResponse({ path: path || '/', files: cloneFileTree()[path] || files })
    }

    if (fullUrl === '/api/files/dirsize' && method === 'get') {
      const path = (config.params?.path as string) || ''
      const key = path.replace(/^\/+/, '')
      const files = tree[key]
      if (!files) return mockResponse({ size: 0 })
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      return mockResponse({ size: totalSize })
    }

    if (fullUrl === '/api/files' && method === 'delete') {
      const path = String(config.params?.path || '')

      // 从父目录中移除
      const segments = path.replace(/^\/+/, '').split('/')
      segments.pop()
      const parentKey = segments.join('/')

      if (tree[parentKey]) {
        tree[parentKey] = tree[parentKey].filter((f) => f.path !== path)
      }
      // 如果是文件夹，移除其条目
      const dirKey = path.replace(/^\/+/, '')
      delete tree[dirKey]

      return mockResponse({ success: true })
    }

    if (fullUrl === '/api/files/batch-delete' && method === 'post') {
      const data = config.data as Record<string, unknown> | undefined
      const paths = (data?.paths as string[]) || []
      for (const p of paths) {
        const segs = p.replace(/^\/+/, '').split('/')
        segs.pop()
        const parentKey = segs.join('/')
        if (tree[parentKey]) {
          tree[parentKey] = tree[parentKey].filter((f) => f.path !== p)
        }
      }
      return mockResponse({ success: paths.length, failed: [] })
    }

    if (fullUrl === '/api/files/rename' && method === 'put') {
      const data = config.data as Record<string, unknown> | undefined
      const path = String(data?.path || '')
      const newName = String(data?.newName || '')
      const segments = path.replace(/^\/+/, '').split('/')
      const oldName = segments.pop() || ''
      const parentKey = segments.join('/')
      const newPath = parentKey ? `${parentKey}/${newName}` : newName

      if (tree[parentKey]) {
        const file = tree[parentKey].find((f) => f.name === oldName)
        if (file) {
          file.name = newName
          file.path = newPath

          // 如果是文件夹，迁移子树
          const oldDirKey = path.replace(/^\/+/, '')
          const newDirKey = newPath
          if (tree[oldDirKey]) {
            tree[newDirKey] = tree[oldDirKey].map((f) => ({
              ...f,
              path: f.path.replace(path, newPath),
            }))
            delete tree[oldDirKey]
          }
        }
      }
      return mockResponse({ success: true })
    }

    // ============================================================
    // Folders
    // ============================================================
    if (fullUrl === '/api/folders' && method === 'post') {
      const data = config.data as Record<string, unknown> | undefined
      const path = String(data?.path || '')
      const name = String(data?.name || '')
      const key = path.replace(/^\/+/, '')
      const newPath = key ? `${key}/${name}` : name
      if (tree[key]) {
        tree[key].push({
          name,
          path: newPath,
          isDirectory: true,
          size: 0,
          modified: new Date().toISOString(),
        })
      }
      tree[newPath] = []
      return mockResponse({ success: true })
    }

    // ============================================================
    // SSE: Move (模拟 — 旧接口，已废弃)
    // ============================================================
    if (fullUrl === '/api/files/move' && method === 'post') {
      return mockResponse({ success: true })
    }

    // ============================================================
    // Tasks: 后台任务
    // ============================================================
    // POST /api/tasks/move — 创建移动任务
    if (fullUrl === '/api/tasks/move' && method === 'post') {
      const taskId = 'demo-task-' + Date.now()
      return mockResponse({ taskId })
    }

    // POST /api/tasks/compress — 创建压缩任务
    if (fullUrl === '/api/tasks/compress' && method === 'post') {
      const taskId = 'demo-compress-' + Date.now()
      return mockResponse({ taskId })
    }

    // GET /api/tasks — 获取所有任务
    if (fullUrl === '/api/tasks' && method === 'get') {
      return mockResponse({ tasks: [] })
    }

    // GET /api/tasks/:id — 获取单个任务
    if (fullUrl.startsWith('/api/tasks/') && !fullUrl.includes('/cancel') && !fullUrl.includes('/stream') && method === 'get') {
      const taskId = fullUrl.replace('/api/tasks/', '')
      return mockResponse({
        task: {
          id: taskId,
          type: 'move',
          status: 'completed',
          phase: 'delete',
          progress: 100,
          speed: 0,
          totalSize: 0,
          startTime: Date.now() - 5000,
          metadata: { sourcePaths: [], sourceNames: [], targetPath: '/' },
          completedCount: 0,
          totalCount: 0,
          totalItemCount: 0,
          processedItemCount: 0,
        },
      })
    }

    // POST /api/tasks/:id/cancel — 取消任务
    if (fullUrl.startsWith('/api/tasks/') && fullUrl.endsWith('/cancel') && method === 'post') {
      return mockResponse({ success: true })
    }

    // ============================================================
    // SSE: Zip (模拟)
    // ============================================================
    if (fullUrl === '/api/files/zip' && method === 'post') {
      return mockResponse({ success: true, message: '演示模式不支持压缩操作' })
    }

    if (fullUrl === '/api/files/zip/cancel' && method === 'post') {
      return mockResponse({ success: true })
    }

    // ============================================================
    // System
    // ============================================================
    if (fullUrl === '/api/system' && method === 'get') {
      return mockResponse(mockSystemInfo)
    }

    // ============================================================
    // Config
    // ============================================================
    if (fullUrl === '/api/config' && method === 'get') {
      return mockResponse(mockConfig)
    }

    if (fullUrl === '/api/config' && method === 'put') {
      return mockResponse({ success: true, config: mockConfig, sessionsCleared: false })
    }

    if (fullUrl === '/api/config/clean-logs' && method === 'post') {
      return mockResponse({ success: true, deleted: 3 })
    }

    // ============================================================
    // Logs
    // ============================================================
    if (fullUrl === '/api/logs' && method === 'get') {
      const params = config.params || {}
      let filtered = [...mockLogs]

      if (params.level) {
        filtered = filtered.filter((l) => l.level === params.level)
      }
      if (params.action) {
        filtered = filtered.filter((l) => l.action === params.action)
      }
      if (params.keyword) {
        const kw = (params.keyword as string).toLowerCase()
        filtered = filtered.filter((l) => l.detail.toLowerCase().includes(kw))
      }
      if (params.startDate) {
        filtered = filtered.filter((l) => l.time >= `${params.startDate}T00:00:00`)
      }
      if (params.endDate) {
        filtered = filtered.filter((l) => l.time <= `${params.endDate}T23:59:59`)
      }

      const page = params.page || 1
      const pageSize = params.pageSize || 20
      const start = (page - 1) * pageSize
      const paged = filtered.slice(start, start + pageSize)

      return mockResponse({ logs: paged, total: filtered.length })
    }

    if (fullUrl === '/api/logs/dates' && method === 'get') {
      return mockResponse({ dates: getMockLogDates() })
    }

    // 未匹配的 API 请求 — 让请求通过（会失败，但不会崩溃）
    return config
  })
}
