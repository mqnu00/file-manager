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
  background: var(--cyber-panel);
  border-radius: 8px;
  border: 1px solid var(--cyber-border);
  box-shadow: var(--cyber-glow-cyan), 0 4px 24px rgba(0, 0, 0, 0.4);
  padding: 8px 0;
  z-index: 9999;
  min-width: 150px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--cyber-text);
}

.context-menu-item:hover {
  background: rgba(0, 240, 255, 0.08);
  color: var(--cyber-cyan);
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.3);
}
</style>
