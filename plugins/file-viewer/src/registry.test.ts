import { describe, it, expect, beforeEach } from 'vitest'
import { createRegistry, initRegistry, getRegistry, type FileViewerModule } from './registry'

function module(partial: Partial<FileViewerModule> & Pick<FileViewerModule, 'id' | 'label'>): FileViewerModule {
  return {
    extensions: [],
    editable: false,
    component: {},
    ...partial,
  }
}

describe('file-viewer registry', () => {
  let reg: ReturnType<typeof createRegistry>

  beforeEach(() => {
    reg = createRegistry()
  })

  it('按注册顺序保存模块，重复 id 覆盖', () => {
    const a = module({ id: 'code', label: '编辑器', extensions: ['ts', 'js'] })
    const b = module({ id: 'music', label: '音乐', extensions: ['mp3'] })
    reg.register(a)
    reg.register(b)
    expect(reg.modules()).toHaveLength(2)

    reg.register(module({ id: 'music', label: '音乐2', extensions: ['mp3'] }))
    expect(reg.modules()).toHaveLength(2)
    expect(reg.get('music')?.label).toBe('音乐2')
  })

  it('register 返回可取消注册的函数', () => {
    const unreg = reg.register(module({ id: 'hex', label: '二进制' }))
    expect(reg.get('hex')).not.toBeNull()
    unreg()
    expect(reg.get('hex')).toBeNull()
  })

  it('getApplicable 返回扩展名命中 + 兜底模块', () => {
    reg.register(module({ id: 'code', label: '代码', extensions: ['ts', 'md'] }))
    reg.register(module({ id: 'hex', label: '二进制', extensions: [] }))
    const names = reg.getApplicable('TS').map((m) => m.id)
    expect(names).toContain('code')
    expect(names).toContain('hex')
    expect(reg.getApplicable('mp3').map((m) => m.id)).toEqual(['hex'])
  })

  it('getDefault 优先扩展名命中，其次兜底模块', () => {
    reg.register(module({ id: 'code', label: '代码', extensions: ['ts'] }))
    reg.register(module({ id: 'music', label: '音乐', extensions: ['mp3'] }))
    expect(reg.getDefault('ts')?.id).toBe('code')
    expect(reg.getDefault('mp3')?.id).toBe('music')
    // 未知扩展名：无兜底时 null
    expect(reg.getDefault('xyz')).toBeNull()
  })

  it('getDefault 无命中时回退兜底模块', () => {
    reg.register(module({ id: 'code', label: '代码', extensions: ['ts'] }))
    reg.register(module({ id: 'hex', label: '二进制', extensions: [] }))
    expect(reg.getDefault('xyz')?.id).toBe('hex')
    expect(reg.getDefault('ts')?.id).toBe('code')
  })

  it('扩展名归一化：忽略大小写与前置点', () => {
    reg.register(module({ id: 'code', label: '代码', extensions: ['ts', 'Md'] }))
    expect(reg.getDefault('.TS')?.id).toBe('code')
    expect(reg.getDefault('md')?.id).toBe('code')
  })

  it('initRegistry/getRegistry 在 globalThis 上幂等共享', () => {
    // 重置全局
    delete (globalThis as Record<string, unknown>)['__fm_file_viewer_registry__']
    const r1 = initRegistry()
    const r2 = initRegistry()
    expect(r1).toBe(r2)
    expect(getRegistry()).toBe(r1)
    delete (globalThis as Record<string, unknown>)['__fm_file_viewer_registry__']
  })
})