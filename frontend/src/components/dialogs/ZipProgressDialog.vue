<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    title="压缩进度"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :lock-scroll="true"
  >
    <div class="zip-progress-dialog">
      <el-progress :percentage="progress" :status="status" />
      <div class="zip-progress-dialog-text">
        {{ status === 'exception' ? error : status === 'success' ? '压缩完成' : `正在压缩：${folderPath}` }}
      </div>
    </div>
    <template #footer>
      <el-button v-if="status === ''" type="danger" @click="$emit('cancel')">
        取消
      </el-button>
      <el-button v-else-if="status === 'exception'" @click="$emit('update:model-value', false)">
        关闭
      </el-button>
      <el-button v-else-if="status === 'success'" type="primary" @click="$emit('update:model-value', false)">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  progress: number
  status: string
  folderPath: string
  error: string
}>()

defineEmits<{
  'update:model-value': [value: boolean]
  cancel: []
}>()
</script>

<style scoped>
.zip-progress-dialog {
  padding: 20px 0;
}

.zip-progress-dialog-text {
  margin-top: 16px;
  text-align: center;
  color: #606266;
  font-size: 14px;
}
</style>
