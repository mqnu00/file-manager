<template>
  <el-dialog
    :model-value="modelValue"
    :title="`移动 (${sourceNames.length} 项)`"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <div class="move-dialog-content">
      <div class="move-dialog-info">
        已选择 <strong>{{ sourceNames.length }}</strong> 个文件/文件夹，选择目标路径后点击确定即可启动后台移动任务
      </div>
      <PathSelector
        :model-value="targetPath"
        :exclude-path="undefined"
        placeholder="选择目标文件夹"
        @update:model-value="$emit('update:target-path', $event)"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:model-value', false)">取消</el-button>
      <el-button type="primary" @click="$emit('confirm')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import PathSelector from '../PathSelector.vue'

defineProps<{
  modelValue: boolean
  sourceNames: string[]
  targetPath: string
}>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:target-path': [value: string]
  confirm: []
}>()
</script>

<style scoped>
.move-dialog-content {
  padding: 8px 0;
  max-height: 70vh;
  overflow-y: auto;
}

.move-dialog-info {
  margin-bottom: 12px;
  color: var(--app-text);
  font-size: 14px;
}

.move-dialog-info strong {
  color: var(--app-accent);
}

:deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
