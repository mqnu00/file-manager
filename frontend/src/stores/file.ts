import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileItem } from '@/types'

export const useFileStore = defineStore('file', () => {
  const currentPath = ref<string>('')
  const files = ref<FileItem[]>([])
  const selectedFiles = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const setFiles = (fileList: FileItem[]) => {
    files.value = fileList
  }

  const setCurrentPath = (path: string) => {
    currentPath.value = path
  }

  const setSelectedFiles = (paths: string[]) => {
    selectedFiles.value = paths
  }

  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (msg: string | null) => {
    error.value = msg
  }

  const selectedFileInfos = computed<FileItem[]>(() => {
    return selectedFiles.value
      .map(path => files.value.find(f => f.path === path))
      .filter(Boolean) as FileItem[]
  })

  const isSingleFileSelected = computed(() => {
    return selectedFiles.value.length === 1 && selectedFileInfos.value.length === 1 && !selectedFileInfos.value[0].isDirectory
  })

  const isSingleFolderSelected = computed(() => {
    return selectedFiles.value.length === 1 && selectedFileInfos.value.length === 1 && selectedFileInfos.value[0].isDirectory
  })

  return {
    currentPath,
    files,
    selectedFiles,
    loading,
    error,
    setFiles,
    setCurrentPath,
    setSelectedFiles,
    setLoading,
    setError,
    selectedFileInfos,
    isSingleFileSelected,
    isSingleFolderSelected
  }
})
