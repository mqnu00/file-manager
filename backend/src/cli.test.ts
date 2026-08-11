import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))

function runCli(args: string[]): string {
  return execSync(`npx tsx src/cli.ts ${args.join(' ')}`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

describe('CLI（子进程）', () => {
  it('--version 输出 package.json 版本号并退出', () => {
    const out = runCli(['--version'])
    expect(out.trim()).toBe(pkg.version)
  })

  it('-v 短参数同样输出版本号', () => {
    const out = runCli(['-v'])
    expect(out.trim()).toBe(pkg.version)
  })

  it('--help 输出用法说明', () => {
    const out = runCli(['--help'])
    expect(out).toContain('用法: file-manager')
    expect(out).toContain('--daemon')
    expect(out).toContain('--version')
  })
})
