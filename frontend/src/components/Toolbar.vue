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
        <el-select
          :model-value="sortBy"
          size="small"
          @update:model-value="$emit('sort-change', $event)"
        >
          <template #prefix>
            <el-icon style="cursor: pointer; margin-right: 4px" @click.stop="$emit('toggle-sort')">
              <ArrowUp v-if="sortOrder === 'asc'" /><ArrowDown v-else />
            </el-icon>
          </template>
          <el-option label="名称" value="name" />
          <el-option label="类型" value="type" />
          <el-option label="修改时间" value="modified" />
          <el-option label="大小" value="size" />
        </el-select>
        <el-dropdown trigger="click" @command="handleCreateCommand">
          <el-button type="primary" size="small">
            <el-icon><Plus /></el-icon>
            新增
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="file">
                <el-icon><DocumentAdd /></el-icon>
                新增文件
              </el-dropdown-item>
              <el-dropdown-item command="folder">
                <el-icon><FolderAdd /></el-icon>
                新增文件夹
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-select
          :model-value="activeTheme.name"
          size="small"
          style="width: 50px"
          class="theme-toggle"
          @update:model-value="setTheme"
        >
          <template #prefix>
            <el-icon>
              <Sunny v-if="activeTheme.name === 'light'" />
              <Moon v-else-if="activeTheme.name === 'cyber'" />
              <Brush v-else />
            </el-icon>
          </template>
          <el-option v-for="t in themes" :key="t.name" :label="t.label" :value="t.name" />
        </el-select>
        <el-button
          v-for="nav in navActions"
          :key="nav.id"
          size="small"
          :title="nav.label"
          @click="router.push(nav.path)"
        >
          <el-icon><component :is="nav.icon || Monitor" /></el-icon>
        </el-button>
        <el-button size="small" @click="router.push('/logs')">
          <el-icon><Document /></el-icon>
        </el-button>
        <el-button size="small" @click="router.push('/config')">
          <el-icon><Setting /></el-icon>
        </el-button>
        <el-button size="small" @click="router.push('/plugins')">
          <el-icon><Operation /></el-icon>
        </el-button>
      </div>
    </div>

    <div v-if="selectedCount > 0" class="bulk-actions">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>
          <span class="bulk-actions-count"
            >已选择 <strong>{{ selectedCount }}</strong> 项</span
          >
          <el-button
            v-if="isSingleFileSelected"
            size="small"
            type="success"
            @click="$emit('batch-download')"
          >
            <el-icon><Download /></el-icon>
            下载
          </el-button>
          <el-button
            v-for="action in visibleBulkActions"
            :key="action.id"
            size="small"
            @click="action.onClick()"
          >
            {{ action.label }}
          </el-button>
          <el-button
            v-if="selectedCount === 1"
            size="small"
            @click="$emit('batch-rename')"
          >
            <el-icon><Edit /></el-icon>
            重命名
          </el-button>
          <el-button size="small" @click="$emit('batch-move')">
            <el-icon><Rank /></el-icon>
            移动
          </el-button>
          <el-button size="small" type="danger" @click="$emit('batch-delete')">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
          <el-button size="small" @click="$emit('cancel-selection')">
            <el-icon><CircleClose /></el-icon>
            取消
          </el-button>
        </div>
        <div>
          <slot name="extra"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  FolderAdd,
  Refresh,
  HomeFilled,
  ArrowUp,
  ArrowDown,
  Delete,
  Rank,
  Download,
  CircleClose,
  Moon,
  Sunny,
  Brush,
  Setting,
  Monitor,
  Edit,
  Document,
  Operation,
  Plus,
  DocumentAdd,
} from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import type { BulkActionView } from '@/pluginActions'
import { useNavActions } from '@/pluginNav'

const router = useRouter()
const { themes, activeTheme, setTheme } = useTheme()
// 插件注册的页面导航入口（顶栏图标按钮），响应式更新
const { actions: navActions } = useNavActions()

const props = defineProps<{
  breadcrumbParts: string[]
  sortBy: string
  sortOrder: string
  selectedCount: number
  isSingleFileSelected: boolean
  selectedHasFolder: boolean
  bulkActions: BulkActionView[]
}>()

// 渲染当前选择下可见的插件注册操作
const visibleBulkActions = computed(() =>
  props.bulkActions.filter((a) =>
    a.visible({ count: props.selectedCount, hasFolder: props.selectedHasFolder })
  )
)

const emit = defineEmits<{
  navigate: [index: number]
  'sort-change': [sortBy: string]
  'toggle-sort': []
  'create-folder': []
  'create-file': []
  refresh: []
  'batch-delete': []
  'batch-move': []
  'batch-download': []
  'batch-rename': []
  'cancel-selection': []
}>()

const handleCreateCommand = (command: string) => {
  if (command === 'file') {
    emit('create-file')
  } else if (command === 'folder') {
    emit('create-folder')
  }
}
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
