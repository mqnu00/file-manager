<template>
  <div class="file-manager">
    <Toolbar
      :breadcrumb-parts="breadcrumbParts"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @navigate="navigateTo"
      @sort-change="(val: any) => { sortBy = val as 'name' | 'type' | 'modified'; sortFiles() }"
      @toggle-sort="toggleSortOrder"
      @create-folder="showCreateFolderDialog"
      @refresh="refresh"
    />
    
    <FileTable
      :files="fileStore.files"
      :loading="fileStore.loading"
      @open="navigateInto"
      @zip="zipFolder"
      @move="showMoveDialog"
      @delete="deleteFile"
      @contextmenu="onRowContextmenu"
    />
    
    <Dialogs
      :create-folder-visible="createFolderVisible"
      :new-folder-name="newFolderName"
      :move-visible="moveVisible"
      :move-target-path="moveTargetPath"
      :move-source-path="moveSourcePath"
      :move-source-name="moveSourceName"
      :move-loading="moveLoading"
      :move-progress="moveProgress"
      :move-status="moveStatus"
      :move-speed="moveSpeed"
      :zip-progress-visible="zipProgressVisible"
      :zip-progress="zipProgress"
      :zip-status="zipStatus"
      :zip-folder-path="zipFolderPath"
      :zip-error="zipError"
      @update:create-folder-visible="createFolderVisible = $event"
      @update:new-folder-name="newFolderName = $event"
      @update:move-visible="handleMoveVisibleChange"
      @update:move-target-path="moveTargetPath = $event"
      @update:zip-progress-visible="zipProgressVisible = $event"
      @create-folder="createFolder"
      @move-file="moveFile"
      @cancel-zip="cancelZip"
    />
    
    <ContextMenu
      v-if="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @create-folder="showCreateFolderDialog"
      @refresh="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFileStore } from '@/stores/file'
import { getFiles, createFolder as createFolderApi, moveFile as moveFileApi, zipFolder as zipFolderApi, cancelZip as cancelZipApi, deleteFile as deleteFileApi } from '@/api/file'
import { ElMessage } from 'element-plus'
import Toolbar from '../components/Toolbar.vue'
import FileTable from '../components/FileTable.vue'
import Dialogs from '../components/Dialogs.vue'
import ContextMenu from '../components/ContextMenu.vue'

const fileStore = useFileStore()

// 排序
const sortBy = ref<'name' | 'type' | 'modified'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 对话框
const createFolderVisible = ref(false)
const newFolderName = ref('')
const moveVisible = ref(false)
const moveSourcePath = ref('')
const moveSourceName = ref('')
const moveTargetPath = ref('')
const moveLoading = ref(false)
const moveProgress = ref(0)
const moveStatus = ref<'success' | 'exception' | ''>('')
const moveSpeed = ref(0)
let moveEventSource: EventSource | null = null

// 压缩
const zipProgressVisible = ref(false)
const zipProgress = ref(0)
const zipStatus = ref<'success' | 'exception' | ''>('')
const zipFolderPath = ref('')
const zipError = ref('')
let zipEventSource: EventSource | null = null

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

const breadcrumbParts = computed(() => {
  const path = fileStore.currentPath
  if (!path) return ['']
  return path.split('/').filter(p => p !== '')
})

const navigateTo = (index: number) => {
  if (index === -1) {
    loadFiles('')
    return
  }
  const parts = breadcrumbParts.value
  const newPath = parts.slice(0, index + 1).join('/')
  loadFiles(newPath)
}

const loadFiles = async (path: string = '') => {
  fileStore.setLoading(true)
  try {
    const res = await getFiles(path)
    fileStore.setFiles(res.files)
    fileStore.setCurrentPath(res.path)
    sortFiles()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '加载失败')
  } finally {
    fileStore.setLoading(false)
  }
}

const refresh = () => {
  loadFiles(fileStore.currentPath)
}

const navigateInto = (path: string) => {
  loadFiles(path)
}

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  sortFiles()
}

const sortFiles = () => {
  const files = [...fileStore.files]
  files.sort((a, b) => {
    let comparison = 0
    if (sortBy.value === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else if (sortBy.value === 'type') {
      const aType = a.isDirectory ? 'folder' : 'file'
      const bType = b.isDirectory ? 'folder' : 'file'
      comparison = aType.localeCompare(bType) || a.name.localeCompare(b.name)
    } else if (sortBy.value === 'modified') {
      comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime()
    }
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
  fileStore.setFiles(files)
}

const onRowContextmenu = (e: MouseEvent, _row: any) => {
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

const showCreateFolderDialog = () => {
  newFolderName.value = ''
  createFolderVisible.value = true
  closeContextMenu()
}

const createFolder = async () => {
  if (!newFolderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  try {
    await createFolderApi(fileStore.currentPath, newFolderName.value)
    ElMessage.success('创建成功')
    createFolderVisible.value = false
    refresh()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '创建失败')
  }
}

const showMoveDialog = (path: string, name: string) => {
  moveSourcePath.value = path
  moveSourceName.value = name
  moveTargetPath.value = ''
  moveVisible.value = true
}

const handleMoveVisibleChange = (value: boolean) => {
  moveVisible.value = value
  // 对话框关闭时重置所有状态
  if (!value) {
    moveSourcePath.value = ''
    moveSourceName.value = ''
    moveTargetPath.value = ''
  }
}

const moveFile = async () => {
  if (!moveTargetPath.value.trim()) {
    ElMessage.warning('请选择目标路径')
    return
  }

  moveLoading.value = true
  moveProgress.value = 0
  moveStatus.value = ''
  moveSpeed.value = 0

  // 构建完整目标路径：目标文件夹路径 + 源文件/文件夹名称
  // 确保路径以 / 开头
  const normalizedSourcePath = moveSourcePath.value.startsWith('/') 
    ? moveSourcePath.value 
    : '/' + moveSourcePath.value
  const normalizedTargetPath = moveTargetPath.value.startsWith('/')
    ? moveTargetPath.value
    : '/' + moveTargetPath.value
  const fullPath = normalizedTargetPath + '/' + moveSourceName.value

  console.log('移动文件 - fromPath:', normalizedSourcePath)
  console.log('移动文件 - fullPath:', fullPath)

  // 关闭之前可能存在的连接
  if (moveEventSource) {
    moveEventSource.close()
  }

  moveEventSource = moveFileApi(normalizedSourcePath, fullPath)

  console.log('移动文件 - EventSource URL:', moveEventSource.url)
  
  moveEventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'progress') {
      moveProgress.value = data.progress
      moveSpeed.value = data.speed || 0
    } else if (data.type === 'complete') {
      moveProgress.value = 100
      moveStatus.value = 'success'
      moveEventSource?.close()
      moveEventSource = null
      ElMessage.success('移动成功')
      setTimeout(() => {
        handleMoveVisibleChange(false)
        moveStatus.value = ''
        moveSpeed.value = 0
      }, 500)
      refresh()
    } else if (data.type === 'error') {
      moveStatus.value = 'exception'
      moveEventSource?.close()
      moveEventSource = null
      ElMessage.error(data.message || '移动失败')
      setTimeout(() => {
        handleMoveVisibleChange(false)
        moveStatus.value = ''
        moveSpeed.value = 0
      }, 500)
    }
  }
  
  moveEventSource.onerror = () => {
    moveStatus.value = 'exception'
    moveEventSource?.close()
    moveEventSource = null
    ElMessage.error('移动失败，请重试')
    setTimeout(() => {
      handleMoveVisibleChange(false)
      moveStatus.value = ''
      moveSpeed.value = 0
    }, 500)
  }
}

const zipFolder = async (path: string) => {
  zipProgress.value = 0
  zipStatus.value = ''
  zipError.value = ''
  zipFolderPath.value = path
  if (zipEventSource) zipEventSource.close()
  zipEventSource = zipFolderApi(path)
  zipProgressVisible.value = true
  zipEventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'progress') {
      zipProgress.value = data.progress
    } else if (data.type === 'complete') {
      zipStatus.value = 'success'
      zipProgress.value = 100
      zipEventSource?.close()
      zipEventSource = null
      ElMessage.success('压缩完成')
      refresh()
    } else if (data.type === 'error') {
      zipStatus.value = 'exception'
      zipError.value = data.message
      zipEventSource?.close()
      zipEventSource = null
    }
  }
  zipEventSource.onerror = () => {
    zipStatus.value = 'exception'
    zipError.value = '压缩失败，请重试'
    zipEventSource?.close()
    zipEventSource = null
  }
}

const cancelZip = async () => {
  try {
    await cancelZipApi(zipFolderPath.value)
    zipEventSource?.close()
    zipEventSource = null
    zipProgressVisible.value = false
    ElMessage.info('已取消压缩')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '取消失败')
  }
}

const deleteFile = async (path: string) => {
  try {
    await deleteFileApi(path)
    ElMessage.success('删除成功')
    refresh()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(() => {
  loadFiles()
})
</script>

<style scoped>
.file-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #f5f7fa;
}
</style>
