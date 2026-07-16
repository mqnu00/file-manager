import { ref } from 'vue'
import type { FileItem } from '@/types'

export function useContextMenu() {
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuRow = ref<FileItem | null>(null)

  // 菜单预估尺寸
  const MENU_WIDTH = 160
  const MENU_HEIGHT = 130

  const onRowContextmenu = (e: MouseEvent, row: FileItem) => {
    e.preventDefault()
    e.stopPropagation()
    contextMenuRow.value = row

    let x = e.clientX
    let y = e.clientY

    // 防止菜单超出视口右侧
    if (x + MENU_WIDTH > window.innerWidth) {
      x = window.innerWidth - MENU_WIDTH - 8
    }
    // 防止菜单超出视口底部
    if (y + MENU_HEIGHT > window.innerHeight) {
      y = window.innerHeight - MENU_HEIGHT - 8
    }

    contextMenuX.value = x
    contextMenuY.value = y
    contextMenuVisible.value = true
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true })
    }, 0)
  }

  const closeContextMenu = () => {
    contextMenuVisible.value = false
    contextMenuRow.value = null
  }

  return {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuRow,
    onRowContextmenu,
    closeContextMenu,
  }
}
