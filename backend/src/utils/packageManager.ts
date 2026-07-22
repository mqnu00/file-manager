import { execSync } from 'child_process'
import fs from 'fs'

export interface InstallInfo {
  manager: string
  command: string
  rawCommand: string
  pkexecAvailable: boolean
  osName: string
}

let cached: InstallInfo | null = null

function detectOS(): string {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf-8')
    const match = content.match(/^PRETTY_NAME="(.+)"$/m)
    if (match) return match[1]
    const idMatch = content.match(/^ID="(.+)"$/m)
    if (idMatch) return idMatch[1]
  } catch {
    // 读取失败
  }
  return 'Linux'
}

function hasCmd(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export function detectPackageManager(): InstallInfo {
  if (cached) return cached

  const osName = detectOS()
  let manager = ''
  let rawCommand = ''

  // Samba install commands removed — handled by file-manager-plugin-smb

  // 统一使用 sudo，终端中由用户自行输入密码
  const command = rawCommand

  cached = { manager, command, rawCommand, pkexecAvailable: false, osName }
  return cached
}
