<template>
  <div
    class="context-menu"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <div class="context-menu-item" @click="$emit('create-folder')">
      <el-icon><FolderAdd /></el-icon>
      新建文件夹
    </div>
    <div class="context-menu-item" @click="$emit('refresh')">
      <el-icon><Refresh /></el-icon>
      刷新
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderAdd, Refresh } from '@element-plus/icons-vue'

defineProps<{
  x: number
  y: number
}>()

defineEmits<{
  'create-folder': []
  refresh: []
}>()
</script>

<style scoped>
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
