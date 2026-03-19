<template>
  <div class="file-manager">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="breadcrumb">
        <el-link class="breadcrumb-home" @click="navigateTo(-1)">
          <el-icon><HomeFilled /></el-icon>
        </el-link>
        <template v-for="(part, index) in breadcrumbParts" :key="index">
          <span class="separator">/</span>
          <el-link @click="navigateTo(index)">
            {{ part }}
          </el-link>
        </template>
      </div>
      
      <div class="actions">
        <el-button type="primary" size="small" @click="showCreateFolderDialog">
          <el-icon><FolderAdd /></el-icon>
          新建文件夹
        </el-button>
        <el-button size="small" @click="refresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="file-list">
      <el-table
        :data="fileStore.files"
        style="width: 100%"
        @row-contextmenu="onRowContextmenu"
        v-loading="fileStore.loading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="名称" min-width="200">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon :size="20">
                <Folder v-if="row.isDirectory" />
                <Document v-else />
              </el-icon>
              <span 
                :class="['file-name-text', { 'is-folder': row.isDirectory }]"
                @click="row.isDirectory && navigateInto(row.path)"
              >
                {{ row.name }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">
            {{ row.isDirectory ? '-' : formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="modified" label="修改时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.isDirectory" 
              size="small" 
              @click="zipFolder(row.path)"
            >
              压缩
            </el-button>
            <el-button 
              size="small" 
              @click="showMoveDialog(row.path, row.name)"
            >
              移动
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteFile(row.path)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建文件夹对话框 -->
    <el-dialog
      v-model="createFolderVisible"
      title="新建文件夹"
      width="300px"
    >
      <el-input 
        v-model="newFolderName" 
        placeholder="请输入文件夹名称"
        @keyup.enter="createFolder"
      />
      <template #footer>
        <el-button @click="createFolderVisible = false">取消</el-button>
        <el-button type="primary" @click="createFolder">确定</el-button>
      </template>
    </el-dialog>

    <!-- 移动文件对话框 -->
    <el-dialog
      v-model="moveVisible"
      title="移动到"
      width="400px"
    >
      <el-input
        v-model="moveTargetPath"
        placeholder="请输入目标路径"
      />
      <template #footer>
        <el-button @click="moveVisible = false">取消</el-button>
        <el-button type="primary" @click="moveFile">确定</el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div 
      v-if="contextMenuVisible" 
      class="context-menu"
      :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
    >
      <div class="context-menu-item" @click="showCreateFolderDialog">
        <el-icon><FolderAdd /></el-icon>
        新建文件夹
      </div>
      <div class="context-menu-item" @click="refresh">
        <el-icon><Refresh /></el-icon>
        刷新
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Folder, Document, FolderAdd, Refresh, HomeFilled } from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'
import { getFiles, createFolder as createFolderApi, moveFile, zipFolder as zipFolderApi, deleteFile as deleteFileApi } from '@/api/file'
import { ElMessage } from 'element-plus'

const fileStore = useFileStore()

// 新建文件夹
const createFolderVisible = ref(false)
const newFolderName = ref('')

// 移动文件
const moveVisible = ref(false)
const moveSourcePath = ref('')
const moveTargetPath = ref('')

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
    // 跳转到根目录
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

const onRowContextmenu = (e: MouseEvent, row: any) => {
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
  moveTargetPath.value = ''
  moveVisible.value = true
}

const moveFile = async () => {
  if (!moveTargetPath.value.trim()) {
    ElMessage.warning('请输入目标路径')
    return
  }
  
  try {
    await moveFile(moveSourcePath.value, moveTargetPath.value)
    ElMessage.success('移动成功')
    moveVisible.value = false
    refresh()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '移动失败')
  }
}

const zipFolder = async (path: string) => {
  try {
    await zipFolderApi(path)
    ElMessage.success('压缩成功')
    refresh()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '压缩失败')
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

const formatSize = (size: number) => {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb-home {
  display: flex;
  align-items: center;
  font-size: 18px;
}

.separator {
  color: #909399;
}

.actions {
  display: flex;
  gap: 8px;
}

.file-list {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: auto;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name-text {
  cursor: default;
}

.file-name-text.is-folder {
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.file-name-text.is-folder:hover {
  color: #409eff;
  text-decoration: underline;
}

.context-menu {
  position: fixed;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 8px 0;
  z-index: 9999;
  min-width: 150px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.context-menu-item:hover {
  background: #f5f7fa;
}
</style>
