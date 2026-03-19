import { defineStore } from 'pinia'
import { ref } from 'vue'
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
    setError
  }
})
