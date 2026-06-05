<template>
  <div class="context-menu" :style="{ top: y + 'px', left: x + 'px' }">
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
  background: var(--app-panel);
  border-radius: 8px;
  border: 1px solid var(--app-border);
  box-shadow:
    var(--app-glow),
    0 4px 24px rgb(0 0 0 / 40%);
  padding: 8px 0;
  z-index: 9999;
  min-width: 150px;
  backdrop-filter: var(--app-blur);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--app-text);
}

.context-menu-item:hover {
  background: var(--app-accent-bg-hover);
  color: var(--app-accent);
  text-shadow: var(--app-text-shadow);
}
</style>
