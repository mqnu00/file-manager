import { describe, it, expect } from 'vitest'
import { buildImageList, sortByName, currentIndex, parentOf, makeViewerUrl } from './navigation'
import type { FileItem } from '@mqn00/file-manager/plugin/frontend'

function item(name: string, path: string, isDirectory = false): FileItem {
  return { name, path, isDirectory, size: 0, modified: '' }
}

const EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

describe('parentOf', () => {
  it('根目录内文件返回空串', () => {
    expect(parentOf('a.png')).toBe('')
    expect(parentOf('photo.jpg')).toBe('')
  })
  it('多级路径取父目录', () => {
    expect(parentOf('a/b/c.png')).toBe('a/b')
    expect(parentOf('b.png')).toBe('')
  })
})

describe('buildImageList', () => {
  it('过滤目录与非图片，保留图片', () => {
    const files = [
      item('a.png', 'a.png'),
      item('B.JPG', 'B.JPG'),
      item('dir1', 'dir1', true),
      item('note.txt', 'note.txt'),
      item('c.svg', 'c.svg'),
      item('.hidden', '.hidden'), // 无扩展名
    ]
    const list = buildImageList(files, EXTS)
    expect(list.map((f) => f.name).sort()).toEqual(['B.JPG', 'a.png', 'c.svg'])
  })
  it('扩展名大小写与去点不敏感', () => {
    const files = [item('x.Png', 'x.Png'), item('y.jpg', 'y.jpg')]
    expect(buildImageList(files, ['PNG', '.jpg']).length).toBe(2)
  })
  it('过滤不在 exts 内的后缀', () => {
    const files = [item('tiff.tiff', 'tiff.tiff'), item('ok.png', 'ok.png')]
    const list = buildImageList(files, EXTS)
    expect(list.map((f) => f.name)).toEqual(['ok.png'])
  })
})

describe('sortByName', () => {
  it('按名称升序（localeCompare：数字<字母，小写在同字母前）且不改原数组', () => {
    const files = [item('b.png', 'b.png'), item('A.png', 'A.png'), item('10.png', '10.png'), item('a.png', 'a.png')]
    const sorted = sortByName(files)
    expect(sorted.map((f) => f.name)).toEqual(['10.png', 'a.png', 'A.png', 'b.png'])
    expect(files.map((f) => f.name)).toEqual(['b.png', 'A.png', '10.png', 'a.png'])
  })
  it('中文按 localeCompare 排序', () => {
    const files = [item('图片2.png', '图片2.png'), item('图片1.png', '图片1.png'), item('图a.png', '图a.png')]
    const sorted = sortByName(files)
    expect(sorted.map((f) => f.name)).toEqual(['图a.png', '图片1.png', '图片2.png'])
  })
})

describe('currentIndex', () => {
  it('命中返回下标，未命中返回 -1', () => {
    const files = [item('a.png', 'a.png'), item('b.png', 'b.png')]
    expect(currentIndex(files, 'b.png')).toBe(1)
    expect(currentIndex(files, 'c.png')).toBe(-1)
  })
})

describe('makeViewerUrl', () => {
  it('编码路径并保留 mode', () => {
    expect(makeViewerUrl('a b/汉.png', 'image')).toBe(
      '/plugin/file-viewer/view?path=a+b%2F%E6%B1%89.png&mode=image'
    )
  })
  it('无 mode 时不带 mode 参数', () => {
    expect(makeViewerUrl('a.png')).toBe('/plugin/file-viewer/view?path=a.png')
  })
})
