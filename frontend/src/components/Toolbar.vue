<template>
  <div class="toolbar">
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
        <el-option label="名称" value="name" />
        <el-option label="类型" value="type" />
        <el-option label="修改时间" value="modified" />
      </el-select>
      <el-button size="small" @click="$emit('toggle-sort')">
        <el-icon><ArrowUp v-if="sortOrder === 'asc'" /><ArrowDown v-else /></el-icon>
      </el-button>
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
</template>

<script setup lang="ts">
import { FolderAdd, Refresh, HomeFilled, ArrowUp, ArrowDown } from '@element-plus/icons-vue'

defineProps<{
  breadcrumbParts: string[]
  sortBy: string
  sortOrder: string
}>()

defineEmits<{
  navigate: [index: number]
  'sort-change': [sortBy: string]
  'toggle-sort': []
  'create-folder': []
  refresh: []
}>()
</script>

<style scoped>
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
  align-items: center;
  flex-wrap: wrap;
}
</style>
