<template>
  <div class="system-info-container">
    <div class="system-info-card">
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div style="padding: 20px 36px">
        <div class="config-header">
          <h3 class="config-title">系统信息</h3>
          <el-button size="small" @click="fetchSystemInfo" :loading="loading">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <div v-if="systemInfo" class="info-grid">
          <!-- 操作系统信息 -->
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon><Monitor /></el-icon>
                <span>操作系统</span>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="info-label">类型</span>
                <span class="info-value">{{ systemInfo.os.type }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">平台</span>
                <span class="info-value">{{ systemInfo.os.platform }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">架构</span>
                <span class="info-value">{{ systemInfo.os.arch }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">版本</span>
                <span class="info-value version-text">{{ systemInfo.os.release }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">主机名</span>
                <span class="info-value">{{ systemInfo.os.hostname }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">运行时间</span>
                <span class="info-value">{{ systemInfo.os.uptimeFormatted }}</span>
              </div>
            </div>
          </el-card>

          <!-- CPU 信息 -->
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon><Cpu /></el-icon>
                <span>CPU</span>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="info-label">型号</span>
                <span class="info-value version-text">{{ systemInfo.cpu.model }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">核心数</span>
                <span class="info-value">{{ systemInfo.cpu.cores }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">频率</span>
                <span class="info-value">{{ systemInfo.cpu.speed }} MHz</span>
              </div>
            </div>
          </el-card>

          <!-- 内存信息 -->
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon><Coin /></el-icon>
                <span>内存</span>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="info-label">总量</span>
                <span class="info-value">{{ systemInfo.memory.totalFormatted }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">已用</span>
                <span class="info-value">{{ systemInfo.memory.usedFormatted }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">可用</span>
                <span class="info-value">{{ systemInfo.memory.freeFormatted }}</span>
              </div>
            </div>
          </el-card>

          <!-- 硬盘信息 -->
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon><Box /></el-icon>
                <span>硬盘</span>
                <el-select
                  v-if="systemInfo.disks.length > 1"
                  v-model="selectedDiskIndex"
                  size="small"
                  class="disk-select"
                >
                  <el-option
                    v-for="(disk, index) in systemInfo.disks"
                    :key="index"
                    :label="`${disk.device} (${disk.mountpoint})`"
                    :value="index"
                  />
                </el-select>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="info-label">设备</span>
                <span class="info-value">{{ selectedDisk?.device }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">挂载点</span>
                <span class="info-value version-text">{{ selectedDisk?.mountpoint }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">文件系统</span>
                <span class="info-value">{{ selectedDisk?.fstype }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">总量</span>
                <span class="info-value">{{ selectedDisk?.totalFormatted }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">已用</span>
                <span class="info-value">{{ selectedDisk?.usedFormatted }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">可用</span>
                <span class="info-value">{{ selectedDisk?.freeFormatted }}</span>
              </div>
            </div>
          </el-card>

          <!-- Node.js 信息 -->
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <el-icon><Tickets /></el-icon>
                <span>Node.js</span>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="info-label">版本</span>
                <span class="info-value">{{ systemInfo.node.version }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">进程 ID</span>
                <span class="info-value">{{ systemInfo.node.pid }}</span>
              </div>
            </div>
          </el-card>
        </div>

        <div v-else-if="loading" class="loading-state">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>加载系统信息中...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <el-icon :size="32" color="#f56c6c"><WarningFilled /></el-icon>
          <p>{{ error }}</p>
          <el-button type="primary" @click="fetchSystemInfo">重试</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getSystemInfo } from '@/api/system'
import type { SystemInfo } from '@/types'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Refresh,
  Monitor,
  Cpu,
  Coin,
  Box,
  Tickets,
  Loading,
  WarningFilled,
} from '@element-plus/icons-vue'

const router = useRouter()
const systemInfo = ref<SystemInfo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedDiskIndex = ref(0)

const selectedDisk = computed(() => {
  if (!systemInfo.value) return null
  return systemInfo.value.disks[selectedDiskIndex.value] || systemInfo.value.disk
})

async function fetchSystemInfo() {
  loading.value = true
  error.value = null
  try {
    systemInfo.value = await getSystemInfo()
  } catch (e: any) {
    error.value = e.response?.data?.message || '获取系统信息失败'
    ElMessage.error('获取系统信息失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSystemInfo()
})
</script>

<style scoped>
.system-info-container {
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
  overflow-y: auto;
}

.system-info-card {
  width: 800px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
  margin-bottom: 40px;
}

.config-title {
  margin: 0;
  font-size: 20px;
  color: var(--app-text-bright);
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.back-btn {
  color: var(--app-text-dim);
  padding: 4px 8px;
}

.back-btn:hover {
  color: var(--app-accent);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-card {
  background: var(--app-accent-bg) !important;
  border: 1px solid var(--app-accent-border) !important;
}

:deep(.el-card__header) {
  padding: 12px 16px !important;
  border-bottom: 1px solid var(--app-accent-border) !important;
}

:deep(.el-card__body) {
  padding: 16px !important;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--app-accent);
}

.disk-select {
  margin-left: auto;
  width: 200px;
}

:deep(.disk-select .el-input__wrapper) {
  background: var(--app-accent-bg) !important;
  border: 1px solid var(--app-accent-border) !important;
  box-shadow: none !important;
}

:deep(.disk-select .el-input__inner) {
  color: var(--app-text-bright) !important;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  color: var(--app-text-dim);
  font-size: 13px;
}

.info-value {
  color: var(--app-text-bright);
  font-size: 13px;
  text-align: right;
  word-break: break-all;
}

.version-text {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--app-text-dim);
  gap: 16px;
}

.error-state p {
  margin: 0;
}
</style>
