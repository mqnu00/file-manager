<template>
  <div class="file-list">
    <el-table
      ref="tableRef"
      :data="files"
      style="width: 100%"
      @row-contextmenu="handleContextmenu"
      @selection-change="handleSelectionChange"
      v-loading="loading"
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
              @click="row.isDirectory && $emit('open', row.path)"
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
  background: var(--cyber-panel);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--cyber-border);
  box-shadow: var(--cyber-glow-cyan);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  overflow: auto;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cyber-text);
}

.file-name-text {
  cursor: default;
  color: var(--cyber-text);
}

.file-name-text.is-folder {
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  color: var(--cyber-cyan);
  text-shadow: 0 0 4px rgba(0, 240, 255, 0.3);
}

.file-name-text.is-folder:hover {
  color: #5cf0ff;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
  text-decoration: underline;
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(0, 240, 255, 0.06);
  --el-table-row-hover-bg-color: rgba(0, 240, 255, 0.08);
  --el-table-border-color: rgba(0, 240, 255, 0.1);
  --el-table-text-color: var(--cyber-text);
  --el-table-header-text-color: var(--cyber-cyan);
}

:deep(.el-table th) {
  background: rgba(0, 240, 255, 0.06) !important;
  border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;
  font-weight: 600;
  letter-spacing: 0.5px;
}

:deep(.el-table td) {
  border-bottom: 1px solid rgba(0, 240, 255, 0.06) !important;
}

:deep(.el-table tr:hover > td) {
  background: rgba(0, 240, 255, 0.06) !important;
}

:deep(.el-table .el-table__cell) {
  color: var(--cyber-text);
}

:deep(.el-checkbox__inner) {
  background: rgba(0, 240, 255, 0.06) !important;
  border-color: rgba(0, 240, 255, 0.3) !important;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: var(--cyber-cyan) !important;
  border-color: var(--cyber-cyan) !important;
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
}

:deep(.el-loading-mask) {
  background: rgba(6, 11, 26, 0.7) !important;
}
</style>
