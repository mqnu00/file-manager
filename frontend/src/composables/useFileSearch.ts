import { ref, computed } from 'vue'
import type { FileItem } from '@/types'

export function useFileSearch(getFiles: () => FileItem[]) {
  const searchQuery = ref('')

  const filteredFiles = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    if (!query) return getFiles()

    return getFiles().filter((file) => file.name.toLowerCase().includes(query))
  })

  const matchCount = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    if (!query) return 0
    return filteredFiles.value.length
  })

  return {
    searchQuery,
    filteredFiles,
    matchCount,
  }
}
