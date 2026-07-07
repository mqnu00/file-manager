import { ref } from 'vue'
import type { FileItem } from '@/types'

export function useContextMenu() {
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuRow = ref<FileItem | null>(null)

  const onRowContextmenu = (e: MouseEvent, row: FileItem) => {
    e.preventDefault()
    e.stopPropagation()
    contextMenuRow.value = row
    contextMenuX.value = e.clientX
    contextMenuY.value = e.clientY
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
