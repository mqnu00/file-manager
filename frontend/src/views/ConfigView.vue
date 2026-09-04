<template>
  <div class="config-container">
    <div class="config-card">
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div style="padding: 20px 36px">
        <div class="config-header">
          <h3 class="config-title">系统配置</h3>
        </div>

        <el-form label-width="130px" label-position="left">
          <el-divider content-position="left">
            <span class="divider-label">认证设置</span>
          </el-divider>

          <el-form-item label="访问令牌">
            <el-input v-model="form.token" type="password" show-password placeholder="留空不修改" />
            <div class="form-item-tip">当前令牌：{{ config.auth?.token || '---' }}</div>
          </el-form-item>

          <el-form-item label="登录有效期（时）">
            <el-input-number v-model="form.tokenExpiryHours" :min="1" :max="720" :step="1" />
          </el-form-item>

          <el-divider content-position="left">
            <span class="divider-label">存储设置</span>
          </el-divider>

          <el-form-item label="文件存储根目录">
            <el-input v-model="form.storageRoot" placeholder="留空使用项目根目录" />
            <div class="form-item-tip">修改后需重启服务生效</div>
          </el-form-item>

          <el-divider content-position="left">
            <span class="divider-label">插件设置</span>
          </el-divider>

          <el-form-item label="npm 安装目录">
            <el-input v-model="form.pluginInstallDir" placeholder="~/.file-manager/node_modules" />
            <div class="form-item-tip">npm 插件的统一安装路径，支持 ~ 表示用户目录。修改后新安装的插件将写入新目录。</div>
          </el-form-item>

          <el-form-item label="npm 镜像源">
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
              <div style="display: flex; gap: 8px; align-items: center">
                <el-input
                  v-model="form.npmRegistryUrl"
                  placeholder="https://registry.npmmirror.com"
                  style="flex: 1"
                />
                <el-button :loading="testingRegistry" @click="handleTestRegistry">
                  测试连通
                </el-button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px">
                <el-switch v-model="form.npmRegistryEnabled" />
                <span style="font-size: 13px; color: var(--app-text-dim)">
                  {{ form.npmRegistryEnabled ? '已启用（使用镜像源下载插件）' : '未启用（使用 npm 官方源）' }}
                </span>
              </div>
              <div v-if="registryTestResult" class="form-item-tip" :style="{ color: registryTestResult.ok ? '#67c23a' : '#f56c6c' }">
                <template v-if="registryTestResult.ok">
                  ✓ 连通正常，延迟 {{ registryTestResult.latency }}ms
                </template>
                <template v-else>
                  ✗ 连接失败（{{ registryTestResult.latency }}ms）：{{ registryTestResult.error }}
                </template>
              </div>
              <div class="form-item-tip">下载插件速度慢时启用镜像源加速</div>
            </div>
          </el-form-item>

          <el-divider content-position="left">
            <span class="divider-label">日志清理</span>
          </el-divider>

          <el-form-item label="启动时清理旧日志">
            <el-switch v-model="form.cleanupOnStartup" />
          </el-form-item>

          <el-form-item label="保留天数">
            <el-select v-model="form.retentionDays" style="width: 160px">
              <el-option label="7 天" :value="7" />
              <el-option label="14 天" :value="14" />
              <el-option label="30 天" :value="30" />
              <el-option label="60 天" :value="60" />
              <el-option label="90 天" :value="90" />
            </el-select>
          </el-form-item>

          <el-form-item label="立即清理">
            <div style="display: flex; flex-direction: row; gap: 10px;">
              <el-button :loading="cleaning" @click="handleCleanLogs">执行清理</el-button>
              <div v-if="cleanResult !== null" class="form-item-tip">
                {{ cleanResult > 0 ? `已清理 ${cleanResult} 个过期日志文件` : '没有过期的日志文件' }}
              </div>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="saving" @click="handleSave"> 保存配置 </el-button>
            <el-button @click="handleReset"> 重置 </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getConfig, updateConfig, cleanLogs, testRegistry, type AppConfig } from '@/api/config'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
const auth = useAuthStore()

const config = reactive<Partial<AppConfig>>({})
const saving = ref(false)
const cleaning = ref(false)
const cleanResult = ref<number | null>(null)
const testingRegistry = ref(false)
const registryTestResult = ref<{ ok: boolean; latency: number; error?: string } | null>(null)

const form = reactive({
  token: '',
  tokenExpiryHours: 24,
  storageRoot: '',
  pluginInstallDir: '',
  cleanupOnStartup: true,
  retentionDays: 30,
  npmRegistryUrl: '',
  npmRegistryEnabled: false,
})

onMounted(async () => {
  try {
    const cfg = await getConfig()
    Object.assign(config, cfg)
    form.tokenExpiryHours = cfg.auth.tokenExpiryHours
    form.storageRoot = cfg.storageRoot || ''
    form.pluginInstallDir = cfg.pluginInstallDir || ''
    form.cleanupOnStartup = cfg.log?.cleanupOnStartup ?? true
    form.retentionDays = cfg.log?.retentionDays ?? 30
    form.npmRegistryUrl = cfg.npmRegistry?.url || ''
    form.npmRegistryEnabled = cfg.npmRegistry?.enabled ?? false
  } catch {
    ElMessage.error('获取配置失败')
  }
})

function handleReset() {
  form.token = ''
  form.tokenExpiryHours = config.auth?.tokenExpiryHours || 24
  form.storageRoot = config.storageRoot || ''
  form.pluginInstallDir = config.pluginInstallDir || ''
  form.cleanupOnStartup = config.log?.cleanupOnStartup ?? true
  form.retentionDays = config.log?.retentionDays ?? 30
  form.npmRegistryUrl = config.npmRegistry?.url || ''
  form.npmRegistryEnabled = config.npmRegistry?.enabled ?? false
  registryTestResult.value = null
}

async function handleCleanLogs() {
  cleaning.value = true
  cleanResult.value = null
  try {
    const res = await cleanLogs()
    cleanResult.value = res.deleted
    ElMessage.success(res.deleted > 0 ? `已清理 ${res.deleted} 个过期日志文件` : '没有过期的日志文件')
  } catch {
    ElMessage.error('清理失败')
  }
  cleaning.value = false
}

async function handleTestRegistry() {
  const url = form.npmRegistryUrl.trim()
  if (!url) {
    ElMessage.warning('请输入镜像源地址')
    return
  }
  testingRegistry.value = true
  registryTestResult.value = null
  try {
    registryTestResult.value = await testRegistry(url)
  } catch {
    registryTestResult.value = { ok: false, latency: 0, error: '请求失败' }
  }
  testingRegistry.value = false
}

async function handleSave() {
  saving.value = true
  try {
    const payload: any = { auth: {} }
    let hasChange = false

    if (form.token.trim()) {
      payload.auth.token = form.token.trim()
      hasChange = true
    }
    if (form.tokenExpiryHours !== config.auth?.tokenExpiryHours) {
      payload.auth.tokenExpiryHours = form.tokenExpiryHours
      hasChange = true
    }
    if (form.storageRoot !== (config.storageRoot || '')) {
      payload.storageRoot = form.storageRoot
      hasChange = true
    }
    if (form.cleanupOnStartup !== (config.log?.cleanupOnStartup ?? true)) {
      payload.log = { ...payload.log, cleanupOnStartup: form.cleanupOnStartup }
      hasChange = true
    }
    if (form.retentionDays !== (config.log?.retentionDays ?? 30)) {
      payload.log = { ...payload.log, retentionDays: form.retentionDays }
      hasChange = true
    }
    if (form.pluginInstallDir !== (config.pluginInstallDir || '')) {
      payload.pluginInstallDir = form.pluginInstallDir
      hasChange = true
    }
    if (
      form.npmRegistryUrl !== (config.npmRegistry?.url || '') ||
      form.npmRegistryEnabled !== (config.npmRegistry?.enabled ?? false)
    ) {
      payload.npmRegistry = {
        url: form.npmRegistryUrl,
        enabled: form.npmRegistryEnabled,
      }
      hasChange = true
    }

    if (!hasChange) {
      ElMessage.info('没有修改')
      saving.value = false
      return
    }

    const res = await updateConfig(payload)
    Object.assign(config, res.config)
    ElMessage.success('配置已保存')

    if (res.sessionsCleared) {
      await ElMessageBox.alert('令牌已修改，所有会话已失效，请重新登录', '提示', {
        confirmButtonText: '重新登录',
      })
      auth.clearSession()
      router.replace('/login')
    }

    form.token = ''
  } catch {
    ElMessage.error('保存配置失败')
  }
  saving.value = false
}
</script>

<style scoped>
.config-container {
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  overflow-y: auto;
}

.config-card {
  width: 560px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.config-title {
  margin: 0;
  font-size: 20px;
  color: var(--app-text-bright);
}

.config-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.back-btn {
  color: var(--app-text-dim);
  padding: 4px 8px;
}

.divider-label {
  color: var(--app-text-dim);
  font-size: 13px;
  font-weight: normal;
}

:deep(.el-form-item__label) {
  color: var(--app-text);
}

.form-item-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-dim);
  line-height: 1.5;
}
</style>
