<template>
  <!-- 新建文件夹对话框 -->
  <el-dialog
    :model-value="createFolderVisible"
    @update:model-value="$emit('update:create-folder-visible', $event)"
    title="新建文件夹"
    width="300px"
  >
    <el-input
      :model-value="newFolderName"
      @update:model-value="$emit('update:new-folder-name', $event)"
      placeholder="请输入文件夹名称"
      @keyup.enter="$emit('create-folder')"
    />
    <template #footer>
      <el-button @click="$emit('update:create-folder-visible', false)">取消</el-button>
      <el-button type="primary" @click="$emit('create-folder')">确定</el-button>
    </template>
  </el-dialog>

  <!-- 移动文件对话框 -->
  <el-dialog
    :model-value="moveVisible"
    @update:model-value="$emit('update:move-visible', $event)"
    title="移动到"
    width="500px"
    :close-on-click-modal="false"
  >
    <div style="margin-bottom: 8px; color: #606266; font-size: 14px;">
      当前移动：<strong>{{ moveSourceName }}</strong>
    </div>
    <div style="margin-bottom: 16px;">
      <el-progress
        v-if="moveLoading"
        :percentage="moveProgress"
        :status="moveStatus"
        :format="(percent: number) => formatProgress(percent, moveSpeed)"
      />
      <div v-if="moveLoading && moveSpeed > 0" style="text-align: center; margin-top: 8px; color: #909399; font-size: 13px;">
        速度：{{ formatSpeed(moveSpeed) }}
      </div>
    </div>
    <PathSelector
      :model-value="moveTargetPath"
      @update:model-value="$emit('update:move-target-path', $event)"
      :exclude-path="moveSourcePath"
      placeholder="选择目标文件夹"
      :disabled="moveLoading"
    />
    <template #footer>
      <el-button @click="$emit('update:move-visible', false)" :disabled="moveLoading">取消</el-button>
      <el-button type="primary" @click="$emit('move-file')" :loading="moveLoading">
        {{ moveLoading ? '移动中...' : '确定' }}
      </el-button>
    </template>
  </el-dialog>

  <!-- 压缩进度对话框 -->
  <el-dialog
    :model-value="zipProgressVisible"
    @update:model-value="$emit('update:zip-progress-visible', $event)"
    title="压缩进度"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :lock-scroll="true"
  >
    <div class="zip-progress">
      <el-progress
        :percentage="zipProgress"
        :status="zipStatus"
      />
      <div class="zip-progress-text">
        {{ zipStatus === 'exception' ? zipError : zipStatus === 'success' ? '压缩完成' : `正在压缩：${zipFolderPath}` }}
      </div>
    </div>
    <template #footer>
      <el-button
        v-if="zipStatus === ''"
        type="danger"
        @click="$emit('cancel-zip')"
      >
        取消
      </el-button>
      <el-button
        v-else-if="zipStatus === 'exception'"
        @click="$emit('update:zip-progress-visible', false)"
      >
        关闭
      </el-button>
      <el-button
        v-else-if="zipStatus === 'success'"
        type="primary"
        @click="$emit('update:zip-progress-visible', false)"
      >
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import PathSelector from './PathSelector.vue'

defineProps<{
  createFolderVisible: boolean
  newFolderName: string
  moveVisible: boolean
  moveTargetPath: string
  moveSourcePath: string
  moveSourceName: string
  moveLoading: boolean
  moveProgress: number
  moveStatus: string
  moveSpeed: number
  zipProgressVisible: boolean
  zipProgress: number
  zipStatus: string
  zipFolderPath: string
  zipError: string
}>()

defineEmits<{
  'update:create-folder-visible': [value: boolean]
  'update:new-folder-name': [value: string]
  'update:move-visible': [value: boolean]
  'update:move-target-path': [value: string]
  'update:zip-progress-visible': [value: boolean]
  'create-folder': []
  'move-file': []
  'cancel-zip': []
}>()

// 格式化速度显示
const formatSpeed = (speed: number): string => {
  if (speed < 1) {
    return `${(speed * 1024).toFixed(2)} KB/s`
  } else if (speed < 1024) {
    return `${speed.toFixed(2)} MB/s`
  } else {
    return `${(speed / 1024).toFixed(2)} GB/s`
  }
}

// 格式化进度显示
const formatProgress = (percent: number, speed: number): string => {
  if (speed > 0 && percent < 100) {
    const remainingMB = (100 - percent) / 100 * 100 // 估算
    const eta = remainingMB / speed
    return `${percent}% (${eta < 60 ? `${eta.toFixed(0)}s` : `${(eta / 60).toFixed(1)}m`} 剩余)`
  }
  return `${percent}%`
}
</script>

<style scoped>
.zip-progress {
  padding: 20px 0;
}

.zip-progress-text {
  margin-top: 16px;
  text-align: center;
  color: #606266;
  font-size: 14px;
}
</style>
