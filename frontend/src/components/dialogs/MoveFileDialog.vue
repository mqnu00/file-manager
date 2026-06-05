<template>
  <el-dialog
    :model-value="modelValue"
    :title="batchMode ? `批量移动 (${sourceNames.length} 项)` : '移动到'"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <div class="move-dialog-content">
      <div class="move-dialog-info">
        <template v-if="batchMode">
          已选择 <strong>{{ sourceNames.length }}</strong> 个文件/文件夹
        </template>
        <template v-else>
          当前移动：<strong>{{ sourceName }}</strong>
        </template>
      </div>
      <div class="move-dialog-progress">
        <el-progress
          v-if="loading"
          :percentage="progress"
          :status="status"
          :format="formatProgressFn"
        />
        <div v-if="loading && speed > 0" class="move-dialog-speed">
          速度：{{ formatSpeed(speed) }}
        </div>
      </div>
      <PathSelector
        :model-value="targetPath"
        :exclude-path="batchMode ? undefined : sourcePath"
        placeholder="选择目标文件夹"
        :disabled="loading"
        @update:model-value="$emit('update:target-path', $event)"
      />
    </div>
    <template #footer>
      <el-button :disabled="loading" @click="$emit('update:model-value', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="$emit('confirm')">
        {{ loading ? '移动中...' : '确定' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import PathSelector from '../PathSelector.vue'
import { formatProgress, formatSpeed } from '@/utils/format'
import { ProgressProps } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  sourcePath: string
  sourceName: string
  sourceNames: string[]
  targetPath: string
  loading: boolean
  progress: number
  status: ProgressProps['status']
  speed: number
  batchMode: boolean
}>()

defineEmits<{
  'update:model-value': [value: boolean]
  'update:target-path': [value: string]
  confirm: []
}>()

const formatProgressFn = (percent: number) => {
  if (props.batchMode) {
    return `${percent}%`
  }
  return formatProgress(percent, props.speed)
}
</script>

<style scoped>
.move-dialog-content {
  padding: 8px 0;
  max-height: 70vh;
  overflow-y: auto;
}

.move-dialog-info {
  margin-bottom: 8px;
  color: var(--app-text);
  font-size: 14px;
}

.move-dialog-info strong {
  color: var(--app-accent);
}

.move-dialog-progress {
  margin-bottom: 16px;
}

.move-dialog-speed {
  text-align: center;
  margin-top: 8px;
  color: var(--app-text-dim);
  font-size: 13px;
}

:deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
