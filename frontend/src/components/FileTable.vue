<template>
  <div class="file-list">
    <el-table
      :data="files"
      style="width: 100%"
      @row-contextmenu="handleContextmenu"
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
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.isDirectory"
            size="small"
            @click="$emit('zip', row.path)"
          >
            压缩
          </el-button>
          <el-button
            size="small"
            @click="$emit('move', row.path, row.name)"
          >
            移动
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="$emit('delete', row.path)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Folder, Document } from '@element-plus/icons-vue'
import type { FileItem } from '@/types'
import { formatSize, formatTime } from '@/utils/format'

defineProps<{
  files: FileItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  open: [path: string]
  zip: [path: string]
  move: [path: string, name: string]
  delete: [path: string]
  contextmenu: [event: MouseEvent, row: FileItem]
}>()

const handleContextmenu = (row: FileItem, _index: number, e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', e, row)
}
</script>

<style scoped>
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
</style>
