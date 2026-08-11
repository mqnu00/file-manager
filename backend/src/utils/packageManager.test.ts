import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

const realReadFileSync = fs.readFileSync.bind(fs)

let osReleaseContent = ''
let osReleaseThrows = false

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  osReleaseContent = ''
  osReleaseThrows = false
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: fs.PathLike, ...args: unknown[]) => {
    if (String(p) === '/etc/os-release') {
      if (osReleaseThrows) throw new Error('ENOENT')
      return osReleaseContent
    }
    return realReadFileSync(p, ...(args as [BufferEncoding]))
  }) as typeof fs.readFileSync)
})

async function detectPackageManager() {
  const mod = await import('./packageManager')
  return mod.detectPackageManager()
}

describe('packageManager（系统包管理器探测）', () => {
  it('从 PRETTY_NAME 解析发行版名', async () => {
    osReleaseContent = 'PRETTY_NAME="Ubuntu 22.04 LTS"\nID=ubuntu\n'
    const info = await detectPackageManager()
    expect(info.osName).toBe('Ubuntu 22.04 LTS')
    expect(info.manager).toBe('')
    expect(info.command).toBe('')
    expect(info.pkexecAvailable).toBe(false)
  })

  it('无 PRETTY_NAME 时回退到 ID', async () => {
    osReleaseContent = 'ID="debian"\n'
    expect((await detectPackageManager()).osName).toBe('debian')
  })

  it('os-release 读取失败回退 "Linux"', async () => {
    osReleaseThrows = true
    expect((await detectPackageManager()).osName).toBe('Linux')
  })

  it('结果缓存：同一模块实例重复调用返回同一对象', async () => {
    osReleaseContent = 'PRETTY_NAME="Arch Linux"\n'
    const mod = await import('./packageManager')
    const a = mod.detectPackageManager()
    const b = mod.detectPackageManager()
    expect(a).toBe(b)
    expect(a.osName).toBe('Arch Linux')
  })
})
