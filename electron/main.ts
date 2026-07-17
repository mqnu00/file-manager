import electronMain from 'electron'
import electronCommon from 'electron/common'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const { app, BrowserWindow, Menu } = electronMain
const { shell } = electronCommon
const nodeRequire = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 开发模式下前端由 Vite 提供，设置环境变量即可跳过启动后端
const isDev = !!process.env.VITE_DEV_SERVER_URL

function createWindow(loadUrl: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'File Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 在默认浏览器中打开外部链接
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(loadUrl)

  // 开发模式下自动打开 DevTools
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

async function startApp(): Promise<void> {
  Menu.setApplicationMenu(null)

  if (isDev) {
    // 开发模式：直接加载 Vite 开发服务器
    const url = process.env.VITE_DEV_SERVER_URL!
    console.log(`[Electron] 开发模式，加载 ${url}`)
    app.whenReady().then(() => createWindow(url))
    return
  }

  // === 生产模式：启动 Express 后端 ===

  // 将配置和日志写入 Electron 用户数据目录
  const userDataPath = app.getPath('userData')
  process.env.CONFIG_PATH = path.join(userDataPath, 'config.yml')
  process.env.LOG_DIR = path.join(userDataPath, 'logs')
  process.env.ELECTRON = 'true'

  // 确保目录存在
  fs.mkdirSync(path.join(userDataPath, 'logs'), { recursive: true })

  // 导入后端（此时会读取上面设置的环境变量）
  const { createServer } = nodeRequire('../backend/dist/app')

  await app.whenReady()

  try {
    const port = await createServer(3000)
    const url = `http://127.0.0.1:${port}`
    console.log(`[Electron] 生产模式，服务已启动: ${url}`)
    createWindow(url)
  } catch (err) {
    console.error('[Electron] 启动服务器失败:', err)
    app.quit()
  }
}

// 生命周期
app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApp()
  }
})

startApp()
