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
        <el-button size="small" class="theme-toggle" @click="toggle">
          <el-icon><Moon v-if="isCyber" /><Sunny v-else /></el-icon>
          {{ isCyber ? '赛博' : '亮色' }}
        </el-button>
        <el-button size="small" @click="router.push('/config')">
          <el-icon><Setting /></el-icon>
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
import { useRouter } from 'vue-router'
import { FolderAdd, Refresh, HomeFilled, ArrowUp, ArrowDown, Delete, Rank, Download, FolderChecked, Moon, Sunny, Setting } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { isCyber, toggle } = useTheme()

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
  background: var(--app-panel);
  border-radius: 8px;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
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
  color: var(--app-accent) !important;
}

.breadcrumb :deep(.el-link) {
  color: var(--app-accent) !important;
  text-shadow: var(--app-text-shadow);
}

.separator {
  color: var(--app-text-dim);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 20px;
  background: var(--app-accent-bg-subtle);
  border-radius: 6px;
  border: 1px solid var(--app-accent-border-light);
  box-shadow: var(--app-shadow);
  backdrop-filter: var(--app-blur);
  -webkit-backdrop-filter: var(--app-blur);
}

.bulk-actions-count {
  color: var(--app-accent);
  font-size: 14px;
  margin-right: 8px;
  text-shadow: var(--app-text-shadow);
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.theme-toggle {
  margin-left: 4px;
}

:deep(.el-select .el-input__wrapper) {
  background: var(--app-accent-bg) !important;
  border: 1px solid var(--app-accent-border) !important;
  box-shadow: none !important;
}

:deep(.el-select .el-input__inner) {
  color: var(--app-text-bright) !important;
}

:deep(.el-select .el-select__caret) {
  color: var(--app-select-caret) !important;
}
</style>