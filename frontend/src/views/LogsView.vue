<template>
  <div class="logs-container">
    <div class="logs-card">
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div style="padding: 20px 36px">
        <div class="card-header">
          <el-icon><Document /></el-icon>
          <span>操作日志</span>
        </div>

        <div class="filter-bar">
          <div>
            <div style=" display: flex; gap: 10px;">
              <el-date-picker
            v-model="filterDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
            size="default"
            style="max-width: 260px"
          />
          <el-select v-model="filterLevel" placeholder="级别" clearable size="default" style="width: 100px">
            <el-option label="INFO" value="INFO" />
            <el-option label="WARNING" value="WARNING" />
            <el-option label="ERROR" value="ERROR" />
          </el-select>
          <el-select v-model="filterAction" placeholder="操作" clearable size="default" style="width: 120px">
            <el-option label="移动" value="move" />
            <el-option label="复制" value="copy" />
            <el-option label="删除" value="delete" />
            <el-option label="重命名" value="rename" />
            <el-option label="创建文件夹" value="createFolder" />
            <el-option label="登录" value="login" />
            <el-option label="认证" value="auth" />
          </el-select>
          <el-input
            v-model="filterKeyword"
            placeholder="关键词搜索"
            clearable
            size="default"
            style="width: 200px"
            @keyup.enter="fetchLogs"
          />
            </div>
          </div>
          <div>
            <el-button type="primary" @click="fetchLogs">搜索</el-button>
          </div>
        </div>

        <el-table v-loading="loading" :data="logs" stripe style="width: 100%" max-height="calc(100vh - 280px)">
          <el-table-column prop="time" label="时间" width="180" />
          <el-table-column prop="level" label="级别" width="100">
            <template #default="{ row }">
              <el-tag :type="levelTagType(row.level)" size="small">{{ row.level }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="action" label="操作" width="120" />
          <el-table-column prop="detail" label="详情" min-width="300" show-overflow-tooltip />
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="fetchLogs"
            @size-change="fetchLogs"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Document, ArrowLeft } from '@element-plus/icons-vue'
import { getLogs, getAvailableLogDates } from '@/api/file'

const router = useRouter()

interface LogItem {
  time: string
  level: string
  action: string
  detail: string
}

const loading = ref(false)
const logs = ref<LogItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)

const filterDateRange = ref<[string, string]>([
  new Date().toISOString().split('T')[0],
  new Date().toISOString().split('T')[0],
])
const filterLevel = ref('')
const filterAction = ref('')
const filterKeyword = ref('')

const availableDates = ref<Set<string>>(new Set())

const disabledDate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  return !availableDates.value.has(dateStr)
}

const fetchAvailableDates = async () => {
  try {
    const res = await getAvailableLogDates()
    availableDates.value = new Set(res.dates)
  } catch {
    availableDates.value = new Set()
  }
}

const parseLogLine = (line: string): LogItem => {
  // [2026-07-08 06:30:22 UTC] [INFO] [move] detail
  const match = line.match(/^\[(.+?)\]\s\[(.+?)\]\s\[(.+?)\]\s(.+)$/)
  if (match) {
    const utcTime = match[1].replace(' UTC', 'Z').replace(' ', 'T')
    const localTime = new Date(utcTime).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    return { time: localTime, level: match[2], action: match[3], detail: match[4] }
  }
  return { time: '', level: '', action: '', detail: line }
}

const levelTagType = (level: string) => {
  if (level === 'ERROR') return 'danger'
  if (level === 'WARNING') return 'warning'
  return 'info'
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const [startDate, endDate] = filterDateRange.value
    const res = await getLogs({
      startDate,
      endDate,
      level: filterLevel.value || undefined,
      action: filterAction.value || undefined,
      keyword: filterKeyword.value || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    logs.value = res.logs.map(parseLogLine)
    total.value = res.total
  } catch {
    logs.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAvailableDates()
  fetchLogs()
})
</script>

<style scoped>
.logs-container {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px;
  min-height: calc(100vh - 60px);
}

.logs-card {
  width: 100%;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.back-btn {
  color: var(--app-text-dim);
  padding: 4px 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--app-text);
  margin-bottom: 20px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
