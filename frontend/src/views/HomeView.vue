<template>
  <div class="file-manager">
    <Toolbar
      :breadcrumb-parts="breadcrumbParts"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @navigate="navigateTo"
      @sort-change="handleSortChange"
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

    <!-- 新建文件夹对话框 -->
    <CreateFolderDialog
      :model-value="createFolderVisible"
      :folder-name="newFolderName"
      @update:model-value="createFolderVisible = $event"
      @update:folder-name="newFolderName = $event"
      @confirm="createFolder"
    />

    <!-- 移动文件对话框 -->
    <MoveFileDialog
      :model-value="progress.moveState.visible"
      :source-path="progress.moveState.sourcePath"
      :source-name="progress.moveState.sourceName"
      :target-path="progress.moveState.targetPath"
      :loading="progress.moveState.loading"
      :progress="progress.moveState.progress"
      :status="progress.moveState.status"
      :speed="progress.moveState.speed"
      @update:model-value="progress.moveState.visible = $event"
      @update:target-path="progress.moveState.targetPath = $event"
      @confirm="() => progress.moveFile(refresh)"
    />

    <!-- 压缩进度对话框 -->
    <ZipProgressDialog
      :model-value="progress.zipState.visible"
      :progress="progress.zipState.progress"
      :status="progress.zipState.status"
      :folder-path="progress.zipState.folderPath"
      :error="progress.zipState.error"
      @update:model-value="progress.zipState.visible = $event"
      @cancel="() => progress.cancelZip()"
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
import { getFiles, createFolder as createFolderApi, deleteFile as deleteFileApi } from '@/api/file'
import { ElMessage } from 'element-plus'
import { useFileProgress } from '@/composables/useFileProgress'
import Toolbar from '../components/Toolbar.vue'
import FileTable from '../components/FileTable.vue'
import CreateFolderDialog from '../components/dialogs/CreateFolderDialog.vue'
import MoveFileDialog from '../components/dialogs/MoveFileDialog.vue'
import ZipProgressDialog from '../components/dialogs/ZipProgressDialog.vue'
import ContextMenu from '../components/ContextMenu.vue'

const fileStore = useFileStore()
const progress = useFileProgress()

// 排序
const sortBy = ref<'name' | 'type' | 'modified' | 'size'>('type')
const sortOrder = ref<'asc' | 'desc'>('asc')

// 新建文件夹对话框
const createFolderVisible = ref(false)
const newFolderName = ref('')

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

const handleSortChange = (val: any) => {
  sortBy.value = val as 'name' | 'type' | 'modified'
  sortFiles()
}

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  sortFiles()
}

const sortFiles = () => {
  const files = [...fileStore.files]
  files.sort((a, b) => {
    // 第一优先级：文件夹在前，文件在后
    const typeComparison = (a.isDirectory ? 0 : 1) - (b.isDirectory ? 0 : 1)
    if (typeComparison !== 0) return sortOrder.value === 'asc' ? typeComparison : -typeComparison

    // 第二优先级：按指定字段排序
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

    // 如果指定字段相同，按名称排序
    if (comparison === 0) {
      comparison = a.name.localeCompare(b.name)
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
  progress.showMoveDialog(path, name)
}

const zipFolder = (path: string) => {
  progress.zipFolder(path, refresh)
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
