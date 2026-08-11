import { describe, it, expect, vi, afterEach } from 'vitest'
import { useContextMenu } from './useContextMenu'
import type { FileItem } from '@/types'

function makeRow(name = 'a.txt'): FileItem {
  return { name, path: name, isDirectory: false, size: 0, modified: '' }
}

function makeEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 100,
    clientY: 100,
    ...overrides,
  } as unknown as MouseEvent
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useContextMenu', () => {
  it('onRowContextmenu：阻止默认行为并设置行/坐标/可见', () => {
    const menu = useContextMenu()
    const e = makeEvent({ clientX: 50, clientY: 60 })
    const row = makeRow('docs')
    menu.onRowContextmenu(e, row)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(menu.contextMenuRow.value?.path).toBe('docs')
    expect(menu.contextMenuX.value).toBe(50)
    expect(menu.contextMenuY.value).toBe(60)
    expect(menu.contextMenuVisible.value).toBe(true)
  })

  it('菜单超出视口右侧时钳制 x 坐标', () => {
    vi.stubGlobal('innerWidth', 200)
    const menu = useContextMenu()
    menu.onRowContextmenu(makeEvent({ clientX: 190, clientY: 50 }), makeRow())
    // MENU_WIDTH=160 → x = 200 - 160 - 8 = 32
    expect(menu.contextMenuX.value).toBe(32)
    vi.unstubAllGlobals()
  })

  it('菜单超出视口底部时钳制 y 坐标', () => {
    vi.stubGlobal('innerHeight', 180)
    const menu = useContextMenu()
    menu.onRowContextmenu(makeEvent({ clientX: 50, clientY: 170 }), makeRow())
    // MENU_HEIGHT=130 → y = 180 - 130 - 8 = 42
    expect(menu.contextMenuY.value).toBe(42)
    vi.unstubAllGlobals()
  })

  it('closeContextMenu 复位可见状态与行', () => {
    const menu = useContextMenu()
    menu.onRowContextmenu(makeEvent(), makeRow())
    menu.closeContextMenu()
    expect(menu.contextMenuVisible.value).toBe(false)
    expect(menu.contextMenuRow.value).toBeNull()
  })
})
