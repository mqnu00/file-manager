import electronRenderer from 'electron/renderer'

const { contextBridge } = electronRenderer

// 预留：未来可在此暴露安全的 IPC API 给渲染进程
// 例如：窗口控制（最小化、最大化、关闭）、系统托盘等

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
