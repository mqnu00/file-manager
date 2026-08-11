import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileStore } from './file'
import type { FileItem } from '@/types'

function makeFile(name: string, isDirectory: boolean): FileItem {
  return {
    name,
    path: name,
    isDirectory,
    size: 0,
    modified: '2026-08-01T00:00:00Z',
  }
}

describe('file store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setFiles / setCurrentPath / setLoading / setError', () => {
    const store = useFileStore()
    const files = [makeFile('a.txt', false)]
    store.setFiles(files)
    store.setCurrentPath('docs')
    store.setLoading(true)
    store.setError('加载失败')
    // store 返回响应式代理，用深度相等断言
    expect(store.files).toStrictEqual(files)
    expect(store.currentPath).toBe('docs')
    expect(store.loading).toBe(true)
    expect(store.error).toBe('加载失败')
  })

  it('setSelectedFiles 排序：文件夹恒在前', () => {
    const store = useFileStore()
    store.setFiles([
      makeFile('b.txt', false),
      makeFile('docs', true),
      makeFile('a.txt', false),
    ])
    store.setSelectedFiles(['b.txt', 'a.txt', 'docs'])
    // 排序函数只保证文件夹在前（比较器依赖 b 参数，文件间顺序不稳定）
    expect(store.selectedFiles[0]).toBe('docs')
    expect(store.selectedFiles.slice(1).sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('selectedFileInfos 过滤已不存在的路径', () => {
    const store = useFileStore()
    store.setFiles([makeFile('a.txt', false)])
    store.setSelectedFiles(['a.txt', 'ghost.txt'])
    const infos = store.selectedFileInfos
    expect(infos.map((f) => f.path)).toEqual(['a.txt'])
  })

  it('isSingleFileSelected：单选文件为 true，其余组合为 false', () => {
    const store = useFileStore()
    store.setFiles([makeFile('a.txt', false), makeFile('docs', true)])
    expect(store.isSingleFileSelected).toBe(false) // 未选中

    store.setSelectedFiles(['a.txt'])
    expect(store.isSingleFileSelected).toBe(true)
    expect(store.isSingleFolderSelected).toBe(false)

    store.setSelectedFiles(['docs'])
    expect(store.isSingleFileSelected).toBe(false)
    expect(store.isSingleFolderSelected).toBe(true)

    store.setSelectedFiles(['a.txt', 'docs'])
    expect(store.isSingleFileSelected).toBe(false)
    expect(store.isSingleFolderSelected).toBe(false)
  })
})
