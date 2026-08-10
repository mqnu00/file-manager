import { describe, it, expect } from 'vitest'
import { useFileSort } from './useFileSort'
import type { FileItem } from '@/types'

function makeFile(name: string, overrides: Partial<FileItem> = {}): FileItem {
  return {
    name,
    path: name,
    isDirectory: false,
    size: 0,
    modified: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

/** 创建排序上下文：getFiles/setFiles 围绕外部数组 */
function createCtx(files: FileItem[]) {
  const sort = useFileSort(
    () => files,
    (next) => {
      files.length = 0
      files.push(...next)
    }
  )
  return { sort, files }
}

function names(files: FileItem[]): string[] {
  return files.map((f) => f.name)
}

describe('useFileSort', () => {
  it('默认按 type 排序：文件夹恒在前', () => {
    const { sort, files } = createCtx([
      makeFile('a.txt', { size: 10 }),
      makeFile('docs', { isDirectory: true }),
      makeFile('b.txt'),
    ])
    sort.sortFiles()
    expect(names(files)).toEqual(['docs', 'a.txt', 'b.txt'])
  })

  it('toggleSortOrder 后文件夹排后', () => {
    const { sort, files } = createCtx([
      makeFile('a.txt', { size: 10 }),
      makeFile('docs', { isDirectory: true }),
    ])
    sort.toggleSortOrder()
    expect(names(files)).toEqual(['a.txt', 'docs'])
  })

  it('按名称排序 asc / desc（文件名兜底）', () => {
    const { sort, files } = createCtx([
      makeFile('banana.txt'),
      makeFile('apple.txt'),
      makeFile('cherry.txt'),
    ])
    sort.handleSortChange('name')
    expect(names(files)).toEqual(['apple.txt', 'banana.txt', 'cherry.txt'])

    sort.toggleSortOrder()
    expect(names(files)).toEqual(['cherry.txt', 'banana.txt', 'apple.txt'])
  })

  it('按大小排序', () => {
    const { sort, files } = createCtx([
      makeFile('big.txt', { size: 300 }),
      makeFile('small.txt', { size: 10 }),
      makeFile('mid.txt', { size: 100 }),
    ])
    sort.handleSortChange('size')
    expect(names(files)).toEqual(['small.txt', 'mid.txt', 'big.txt'])
  })

  it('按修改时间排序', () => {
    const { sort, files } = createCtx([
      makeFile('old.txt', { modified: '2026-01-01T00:00:00Z' }),
      makeFile('new.txt', { modified: '2026-12-01T00:00:00Z' }),
      makeFile('mid.txt', { modified: '2026-06-01T00:00:00Z' }),
    ])
    sort.handleSortChange('modified')
    expect(names(files)).toEqual(['old.txt', 'mid.txt', 'new.txt'])
  })

  it('type 排序按扩展名（无扩展名在前，扩展名相同时按名称）', () => {
    const { sort, files } = createCtx([
      makeFile('b.png'),
      makeFile('a.jpg'),
      makeFile('noext'),
      makeFile('c.png'),
    ])
    sort.handleSortChange('type')
    expect(names(files)).toEqual(['noext', 'a.jpg', 'b.png', 'c.png'])
  })

  it('排序稳定：相同键值时按名称兜底', () => {
    const { sort, files } = createCtx([
      makeFile('z.txt', { size: 1 }),
      makeFile('a.txt', { size: 1 }),
    ])
    sort.handleSortChange('size')
    expect(names(files)).toEqual(['a.txt', 'z.txt'])
  })

  it('sortOrder 初始为 asc，toggle 切换', () => {
    const { sort } = createCtx([])
    expect(sort.sortOrder.value).toBe('asc')
    sort.toggleSortOrder()
    expect(sort.sortOrder.value).toBe('desc')
  })
})
