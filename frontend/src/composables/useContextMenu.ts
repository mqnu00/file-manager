import { ref } from 'vue'

export function useContextMenu() {
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)

  const onRowContextmenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    contextMenuX.value = e.clientX
    contextMenuY.value = e.clientY
    contextMenuVisible.value = true
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true })
    }, 0)
  }

  const closeContextMenu = () => {
    contextMenuVisible.value = false
  }

  return {
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    onRowContextmenu,
    closeContextMenu
  }
}