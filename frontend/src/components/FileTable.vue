<template>
  <div class="file-list">
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="files"
      style="width: 100%"
      @row-contextmenu="handleContextmenu"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" :selectable="(row: FileItem) => !row.broken" />
      <el-table-column prop="name" label="名称" min-width="200">
        <template #default="{ row }">
          <div class="file-name">
            <el-icon :size="20">
              <Folder v-if="row.isDirectory" />
              <Document v-else />
            </el-icon>
            <span
              :class="['file-name-text', { 'is-folder': row.isDirectory && !row.broken }]"
              @click="(row.isDirectory && !row.broken) && $emit('open', row.path)"
            >
              {{ row.name }}
            </span>
            <el-tag v-if="row.broken" type="danger" size="small" effect="dark">符号链接，目标不存在</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          <span v-if="row.broken" class="broken-text">—</span>
          <span v-else>{{ row.isDirectory ? '-' : formatSize(row.size) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="modified" label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.modified) }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Folder, Document } from '@element-plus/icons-vue'
import type { FileItem } from '@/types'
import { formatSize, formatTime } from '@/utils/format'
import type { ElTable } from 'element-plus'

defineProps<{
  files: FileItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  open: [path: string]
  contextmenu: [event: MouseEvent, row: FileItem]
  selectionChange: [paths: string[]]
}>()

const tableRef = ref<InstanceType<typeof ElTable>>()

const handleContextmenu = (row: FileItem, _index: number, e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', e, row)
}

const handleSelectionChange = (rows: FileItem[]) => {
  emit('selectionChange', rows.map(r => r.path))
}

defineExpose({ tableRef })
</script>

<style scoped>
.file-list {
  flex: 1;
  background: var(--app-panel);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
  overflow: auto;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text);
}

.file-name-text {
  cursor: default;
  color: var(--app-text);
}

.file-name-text.is-folder {
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  color: var(--app-accent);
  text-shadow: var(--app-text-glow);
}

.file-name-text.is-folder:hover {
  color: var(--app-accent);
  text-shadow: var(--app-text-glow-hover);
  text-decoration: underline;
}

.broken-text {
  color: var(--app-text-dim);
  font-style: italic;
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--app-table-header-bg);
  --el-table-row-hover-bg-color: var(--app-table-row-hover);
  --el-table-border-color: var(--app-table-cell-border);
  --el-table-text-color: var(--app-text);
  --el-table-header-text-color: var(--app-accent);
}

:deep(.el-table th) {
  background: var(--app-table-header-bg) !important;
  border-bottom: 1px solid var(--app-table-header-border) !important;
  font-weight: 600;
  letter-spacing: 0.5px;
}

:deep(.el-table td) {
  border-bottom: 1px solid var(--app-table-cell-border) !important;
}

:deep(.el-table tr:hover > td) {
  background: var(--app-table-row-hover) !important;
}

:deep(.el-table .el-table__cell) {
  color: var(--app-text);
}

:deep(.el-checkbox__inner) {
  background: var(--app-accent-bg) !important;
  border-color: var(--app-checkbox-border) !important;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: var(--app-accent) !important;
  border-color: var(--app-accent) !important;
  box-shadow: var(--app-checkbox-shadow);
}

:deep(.el-loading-mask) {
  background: var(--app-mask-bg) !important;
}
</style>