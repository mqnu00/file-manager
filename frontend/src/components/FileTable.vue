<template>
  <div class="file-list">
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="files"
      style="width: 100%"
      height="100%"
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
              :class="[
                'file-name-text',
                { 'is-folder': row.isDirectory && !row.broken, 'is-openable': isOpenable(row) },
              ]"
              @click="onFileNameClick(row)"
            >
              <template v-if="searchQuery">
                <span v-html="highlightMatch(row.name, searchQuery)"></span>
              </template>
              <template v-else>
                {{ row.name }}
              </template>
            </span>
            <el-tag v-if="row.broken" type="danger" size="small" effect="dark"
              >符号链接，目标不存在</el-tag
            >
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          <span v-if="row.broken" class="broken-text">—</span>
          <span v-else-if="!row.isDirectory">{{ formatSize(row.size) }}</span>
          <span v-else-if="dirSizeTimeout[row.path]" class="timeout-text">计算超时</span>
          <el-button
            v-else-if="!(row.path in dirSizeCache) && !dirSizeLoading[row.path]"
            size="small"
            type="primary"
            link
            @click="$emit('load-dir-size', row.path)"
          >
            计算
          </el-button>
          <el-button v-else-if="dirSizeLoading[row.path]" size="small" link loading />
          <span v-else>{{ formatSize(dirSizeCache[row.path]) }}</span>
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
import { getFileOpenApi } from '@/platform/fileOpen'
import type { ElTable } from 'element-plus'

/** 高亮搜索匹配的文本 */
const highlightMatch = (text: string, query: string): string => {
  if (!query) return text
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  return text.replace(regex, '<span class="search-highlight">$1</span>')
}

defineProps<{
  files: FileItem[]
  loading: boolean
  dirSizeCache: Record<string, number>
  dirSizeLoading: Record<string, boolean>
  dirSizeTimeout: Record<string, boolean>
  searchQuery?: string
}>()

const emit = defineEmits<{
  open: [path: string]
  contextmenu: [event: MouseEvent, row: FileItem]
  selectionChange: [paths: string[]]
  'load-dir-size': [path: string]
}>()

const tableRef = ref<InstanceType<typeof ElTable>>()

// 文件打开注册表（平台挂载点）：插件注册 handler 声明"能打开哪些文件"。
// 渲染期 isOpenable 依赖 handlers ref，插件注册/注销时自动重算 is-openable 标记；
// 单击分发调用首个 canOpen 命中的 handler，插件不再劫持 DOM 点击。
const fileOpenApi = getFileOpenApi()

/** 文件名单击：文件夹进入目录（原有行为）；文件分发给平台注册的打开 handler */
const onFileNameClick = (row: FileItem) => {
  if (row.isDirectory && !row.broken) {
    emit('open', row.path)
    return
  }
  if (row.broken) return
  const handler = fileOpenApi.resolve(row)
  if (handler) {
    void handler.open(row)
  }
}

/** 是否有插件声明可打开该文件（渲染期打 is-openable 标记，样式由插件注入）；
 *  优先使用 handler.isOpenable（可将「能打开」与「应标记」分离），
 *  缺省时回退到 canOpen。 */
const isOpenable = (row: FileItem): boolean => {
  if (row.isDirectory || row.broken) return false
  const handler = fileOpenApi.resolve(row)
  if (!handler) return false
  return handler.isOpenable ? handler.isOpenable(row) : handler.canOpen(row)
}

const handleContextmenu = (row: FileItem, _index: number, e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', e, row)
}

const handleSelectionChange = (rows: FileItem[]) => {
  emit(
    'selectionChange',
    rows.map((r) => r.path)
  )
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

.timeout-text {
  color: #f56c6c;
  font-size: 12px;
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

:deep(.search-highlight) {
  background-color: rgba(255, 215, 0, 0.3);
  color: var(--app-text-bright);
  font-weight: 600;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
