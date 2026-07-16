<template>
  <div class="task-panel" :class="{ 'task-panel--collapsed': collapsed }">
    <!-- 折叠态：始终显示徽章 -->
    <div v-if="collapsed" class="task-badge" @click="collapsed = false">
      <el-badge :value="runningCount" :max="99" :hidden="runningCount === 0" class="task-badge__item">
        <el-button circle size="small" class="task-badge__btn">
          <el-icon :size="16"><List /></el-icon>
        </el-button>
      </el-badge>
      <span class="task-badge__label">后台任务</span>
    </div>

    <!-- 展开态：完整任务列表 -->
    <template v-else>
      <div class="task-panel__header">
        <span class="task-panel__title">后台任务</span>
        <el-button circle size="small" text @click="collapsed = true">
          <el-icon :size="14"><ArrowDown /></el-icon>
        </el-button>
      </div>

      <div v-if="visibleTasks.length === 0" class="task-panel__empty">
        暂无后台任务
      </div>

      <TransitionGroup name="task-item">
        <div
          v-for="task in visibleTasks"
          :key="task.id"
          class="task-card"
        >
          <div class="task-card__header">
            <el-icon class="task-card__icon" :size="16"><FolderOpened /></el-icon>
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
              :percentage="task.progress"
              :stroke-width="6"
              :show-text="false"
            />

            <div v-if="task.speed > 0 && task.phase === 'copy'" class="task-card__speed">
              {{ formatSpeed(task.speed) }}
            </div>

            <div v-if="task.currentFile" class="task-card__file">
              {{ task.currentFile }}
            </div>
          </div>

          <div class="task-card__footer">
            <template v-if="task.phase === 'copy' && task.status !== 'cancelling'">
              <el-button size="small" type="danger" text @click="handleCancel(task.id)">
                取消
              </el-button>
            </template>
            <template v-else-if="task.phase === 'delete'">
              <span class="task-card__deleting">正在清理源文件...</span>
            </template>
          </div>
        </div>
      </TransitionGroup>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderOpened, List, ArrowDown } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import type { TaskInfo } from '@/types'
import { formatSpeed } from '@/utils/format'

const taskStore = useTaskStore()

const collapsed = ref(false)

// 仅显示运行中 / 取消中的任务
const visibleTasks = computed(() =>
  taskStore.tasks.filter((t) => t.status === 'running' || t.status === 'cancelling')
)

const runningCount = computed(() => visibleTasks.value.length)

function phaseTagType(task: TaskInfo): 'primary' | 'warning' | 'info' {
  if (task.status === 'cancelling') return 'warning'
  return task.phase === 'copy' ? 'primary' : 'info'
}

function phaseLabel(task: TaskInfo): string {
  if (task.status === 'cancelling') return '取消中...'
  return task.phase === 'copy' ? '复制中...' : '删除中...'
}

function handleCancel(taskId: string): void {
  taskStore.cancelTask(taskId)
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

.task-panel--collapsed {
  max-width: none;
  width: auto;
}

.task-badge {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  background: var(--app-panel-solid, #fff);
  border: 1px solid var(--app-border, #e4e7ed);
  border-radius: 20px;
  padding: 4px 12px 4px 4px;
  box-shadow: var(--app-shadow, 0 2px 8px rgba(0,0,0,0.06));
  transition: all 0.2s ease;
}

.task-badge:hover {
  border-color: var(--app-accent, #409eff);
  box-shadow: var(--app-glow, 0 0 12px rgba(0,240,255,0.2));
}

.task-badge__btn {
  width: 28px;
  height: 28px;
}

.task-badge__label {
  font-size: 12px;
  color: var(--app-text-dim, #909399);
  white-space: nowrap;
}

.task-panel__header {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--app-panel-solid, #fff);
  border: 1px solid var(--app-border, #e4e7ed);
  border-radius: 10px;
  box-shadow: var(--app-shadow, 0 2px 8px rgba(0,0,0,0.06));
}

.task-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-bright, #303133);
}

.task-card {
  pointer-events: auto;
  background: var(--app-panel-solid, #fff);
  border: 1px solid var(--app-border, #e4e7ed);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: var(--app-shadow, 0 2px 8px rgba(0,0,0,0.06));
  backdrop-filter: blur(6px);
}

.task-panel__empty {
  pointer-events: auto;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--app-text-dim, #909399);
  background: var(--app-panel-solid, #fff);
  border: 1px solid var(--app-border, #e4e7ed);
  border-radius: 10px;
  box-shadow: var(--app-shadow, 0 2px 8px rgba(0,0,0,0.06));
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
