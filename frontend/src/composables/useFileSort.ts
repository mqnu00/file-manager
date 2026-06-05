import { ref } from 'vue'
import type { FileItem } from '@/types'

export function useFileSort(getFiles: () => FileItem[], setFiles: (files: FileItem[]) => void) {
  const sortBy = ref<'name' | 'type' | 'modified' | 'size'>('type')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  const handleSortChange = (val: any) => {
    sortBy.value = val as 'name' | 'type' | 'modified'
    sortFiles()
  }

  const toggleSortOrder = () => {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    sortFiles()
  }

  const sortFiles = () => {
    const files = [...getFiles()]
    files.sort((a, b) => {
      const typeComparison = (a.isDirectory ? 0 : 1) - (b.isDirectory ? 0 : 1)
      if (typeComparison !== 0) return sortOrder.value === 'asc' ? typeComparison : -typeComparison

      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'type') {
        const aExt = a.name.includes('.') ? a.name.split('.').pop()!.toLowerCase() : ''
        const bExt = b.name.includes('.') ? b.name.split('.').pop()!.toLowerCase() : ''
        comparison = aExt.localeCompare(bExt) || a.name.localeCompare(b.name)
      } else if (sortBy.value === 'modified') {
        comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime()
      } else if (sortBy.value === 'size') {
        comparison = a.size - b.size
      }

      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name)
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
    setFiles(files)
  }

  return {
    sortBy,
    sortOrder,
    handleSortChange,
    toggleSortOrder,
    sortFiles,
  }
}
