<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    title="移动到"
    width="500px"
    :close-on-click-modal="false"
  >
    <div class="move-dialog-content">
      <div class="move-dialog-info">
        当前移动：<strong>{{ sourceName }}</strong>
      </div>
      <div class="move-dialog-progress">
        <el-progress
          v-if="loading"
          :percentage="progress"
          :status="status"
          :format="(percent: number) => formatProgress(percent, speed)"
        />
        <div v-if="loading && speed > 0" class="move-dialog-speed">
          速度：{{ formatSpeed(speed) }}
        </div>
      </div>
      <PathSelector
        :model-value="targetPath"
        @update:model-value="$emit('update:target-path', $event)"
        :exclude-path="sourcePath"
        placeholder="选择目标文件夹"
        :disabled="loading"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:model-value', false)" :disabled="loading">取消</el-button>
      <el-button type="primary" @click="$emit('confirm')" :loading="loading">
        {{ loading ? '移动中...' : '确定' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import PathSelector from '../PathSelector.vue'
import { formatProgress, formatSpeed } from '@/utils/format'

defineProps<{
  modelValue: boolean
  sourcePath: string
  sourceName: string
  targetPath: string
  loading: boolean
  progress: number
  status: string
  speed: number
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
}

.move-dialog-info {
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
}

.move-dialog-progress {
  margin-bottom: 16px;
}

.move-dialog-speed {
  text-align: center;
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}
</style>
