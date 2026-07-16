<template>
  <div v-if="visibleTasks.length > 0" class="task-panel">
    <TransitionGroup name="task-item">
      <div
        v-for="task in visibleTasks"
        :key="task.id"
        class="task-card"
        :class="{ 'task-card--completed': task.status === 'completed' }"
      >
        <div class="task-card__header">
          <el-icon class="task-card__icon" :size="18"><FolderOpened /></el-icon>
          <span class="task-card__title">
            移动 {{ task.metadata.sourceNames.length }} 项到 {{ task.metadata.targetPath }}
          </span>
        </div>

        <div class="task-card__body">
          <div class="task-card__phase">
            <el-tag
              :type="phaseTagType(task)"
              size="small"
              effect="plain"
            >
              {{ phaseLabel(task) }}
            </el-tag>
          </div>

          <el-progress
            v-if="task.status === 'running'"
            :percentage="task.progress"
            :stroke-width="6"
            :show-text="false"
          />

          <div v-if="task.status === 'running' && task.speed > 0 && task.phase === 'copy'" class="task-card__speed">
            {{ formatSpeed(task.speed) }}
          </div>

          <div v-if="task.currentFile" class="task-card__file">
            {{ task.currentFile }}
          </div>

          <div v-if="task.status === 'failed' && task.error" class="task-card__error">
            {{ task.error }}
          </div>
        </div>

        <div class="task-card__footer">
          <template v-if="task.status === 'running' && task.phase === 'copy'">
            <el-button size="small" type="danger" text @click="handleCancel(task.id)">
              取消
            </el-button>
          </template>
          <template v-else-if="task.status === 'running' && task.phase === 'delete'">
            <span class="task-card__deleting">正在清理源文件...</span>
          </template>
          <template v-else>
            <el-button size="small" text @click="handleDismiss(task.id)">
              {{ task.status === 'completed' ? '关闭' : '关闭' }}
            </el-button>
          </template>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpened } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import type { TaskInfo } from '@/types'
import { formatSpeed } from '@/utils/format'

const taskStore = useTaskStore()

// 只显示最近的任务（running + 最近 5 个已结束的）
const visibleTasks = computed(() => {
  const all = taskStore.tasks
  const running = all.filter((t) => t.status === 'running' || t.status === 'cancelling')
  const finished = all.filter((t) => t.status !== 'running' && t.status !== 'cancelling')
  return [...running, ...finished].slice(0, 10)
})

function phaseTagType(task: TaskInfo): 'primary' | 'warning' | 'success' | 'danger' | 'info' {
  if (task.status === 'completed') return 'success'
  if (task.status === 'cancelled') return 'warning'
  if (task.status === 'failed') return 'danger'
  if (task.phase === 'copy') return 'primary'
  return 'info'
}

function phaseLabel(task: TaskInfo): string {
  switch (task.status) {
    case 'completed':
      return '已完成'
    case 'cancelled':
      return '已取消'
    case 'failed':
      return '失败'
    case 'cancelling':
      return '取消中...'
    default:
      return task.phase === 'copy' ? '复制中...' : '删除中...'
  }
}

function handleCancel(taskId: string): void {
  taskStore.cancelTask(taskId)
}

function handleDismiss(taskId: string): void {
  taskStore.dismissTask(taskId)
}
</script>

<style scoped>
.task-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  max-width: 360px;
  width: 100%;
  pointer-events: none;
}

.task-card {
  pointer-events: auto;
  background: var(--app-panel-solid, #fff);
  border: 1px solid var(--app-border, #e4e7ed);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: var(--app-shadow, 0 2px 8px rgba(0,0,0,0.06));
  backdrop-filter: blur(6px);
  transition: all 0.3s ease;
}

.task-card--completed {
  opacity: 0.85;
}

.task-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.task-card__icon {
  color: var(--app-accent, #409eff);
  flex-shrink: 0;
}

.task-card__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-bright, #303133);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.task-card__body {
  margin-bottom: 8px;
}

.task-card__phase {
  margin-bottom: 6px;
}

.task-card__speed {
  text-align: right;
  font-size: 12px;
  color: var(--app-text-dim, #909399);
  margin-top: 2px;
}

.task-card__file {
  font-size: 12px;
  color: var(--app-text-dim, #909399);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-card__error {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 4px;
}

.task-card__deleting {
  font-size: 12px;
  color: var(--app-text-dim, #909399);
}

.task-card__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

/* 过渡动画 */
.task-item-enter-active {
  transition: all 0.3s ease;
}
.task-item-leave-active {
  transition: all 0.25s ease;
}
.task-item-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.task-item-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
