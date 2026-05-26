<template>
  <div class="toolbar">
    <div class="toolbar-top">
      <div class="breadcrumb">
        <el-link class="breadcrumb-home" @click="$emit('navigate', -1)">
          <el-icon><HomeFilled /></el-icon>
        </el-link>
        <template v-for="(part, index) in breadcrumbParts" :key="index">
          <span class="separator">/</span>
          <el-link @click="$emit('navigate', index)">
            {{ part }}
          </el-link>
        </template>
      </div>

      <div class="actions">
        <el-select :model-value="sortBy" size="small" @update:model-value="$emit('sort-change', $event)">
          <template #prefix>
            <el-icon @click.stop="$emit('toggle-sort')" style="cursor: pointer; margin-right: 4px;">
              <ArrowUp v-if="sortOrder === 'asc'" /><ArrowDown v-else />
            </el-icon>
          </template>
          <el-option label="名称" value="name" />
          <el-option label="类型" value="type" />
          <el-option label="修改时间" value="modified" />
          <el-option label="大小" value="size" />
        </el-select>
        <el-button type="primary" size="small" @click="$emit('create-folder')">
          <el-icon><FolderAdd /></el-icon>
          新建文件夹
        </el-button>
        <el-button size="small" @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="bulk-actions" v-if="selectedCount > 0">
      <span class="bulk-actions-count">已选择 <strong>{{ selectedCount }}</strong> 项</span>
      <el-button v-if="isSingleFileSelected" size="small" type="success" @click="$emit('batch-download')">
        <el-icon><Download /></el-icon>
        下载
      </el-button>
      <el-button v-if="isSingleFolderSelected" size="small" type="warning" @click="$emit('batch-zip')">
        <el-icon><FolderChecked /></el-icon>
        压缩
      </el-button>
      <el-button size="small" @click="$emit('batch-move')">
        <el-icon><Rank /></el-icon>
        移动
      </el-button>
      <el-button size="small" type="danger" @click="$emit('batch-delete')">
        <el-icon><Delete /></el-icon>
        删除
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderAdd, Refresh, HomeFilled, ArrowUp, ArrowDown, Delete, Rank, Download, FolderChecked } from '@element-plus/icons-vue'

defineProps<{
  breadcrumbParts: string[]
  sortBy: string
  sortOrder: string
  selectedCount: number
  isSingleFileSelected: boolean
  isSingleFolderSelected: boolean
}>()

defineEmits<{
  navigate: [index: number]
  'sort-change': [sortBy: string]
  'toggle-sort': []
  'create-folder': []
  refresh: []
  'batch-delete': []
  'batch-move': []
  'batch-download': []
  'batch-zip': []
}>()
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}

.toolbar-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--cyber-panel);
  border-radius: 8px;
  border: 1px solid var(--cyber-border);
  box-shadow: var(--cyber-glow-cyan);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
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

.breadcrumb :deep(.el-link__inner) {
  color: var(--cyber-cyan) !important;
}

.breadcrumb :deep(.el-link) {
  color: var(--cyber-cyan) !important;
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.4);
}

.separator {
  color: var(--cyber-text-dim);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 20px;
  background: rgba(0, 240, 255, 0.06);
  border-radius: 6px;
  border: 1px solid rgba(0, 240, 255, 0.15);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.08);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.bulk-actions-count {
  color: var(--cyber-cyan);
  font-size: 14px;
  margin-right: 8px;
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.3);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.el-select .el-input__wrapper) {
  background: rgba(0, 240, 255, 0.06) !important;
  border: 1px solid rgba(0, 240, 255, 0.2) !important;
  box-shadow: none !important;
}

:deep(.el-select .el-input__inner) {
  color: var(--cyber-text-bright) !important;
}

:deep(.el-select .el-select__caret) {
  color: var(--cyber-cyan) !important;
}
</style>
