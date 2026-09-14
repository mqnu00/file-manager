<template>
  <div class="config-container">
    <div class="config-card">
      <div class="back-bar">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div class="config-body">
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
        </el-form>

        <!-- data-panel-replica：悬浮面板契约。带背景图的主题（如 miku）据此
             用 JS 校准背景，使其透出 body 背景图的对应视口位置 -->
        <div class="form-actions" data-panel-replica>
          <el-button @click="handleReset"> 重置 </el-button>
          <el-button :loading="saving" type="primary" @click="handleSave"> 保存配置 </el-button>
        </div>

        <div class="config-header about-header">
          <h3 class="config-title">关于</h3>
        </div>

        <div class="about-section">
          <div class="about-row">
            <div class="about-label">当前版本</div>
            <div class="about-content">
              <span class="about-version">v{{ systemInfo.version || '---' }}</span>
            </div>
          </div>

          <div class="about-row">
            <div class="about-label">项目地址</div>
            <div class="about-content">
              <a
                v-if="systemInfo.repoUrl"
                :href="systemInfo.repoUrl"
                target="_blank"
                rel="noopener"
                class="about-link"
              >{{ systemInfo.repoUrl }}</a>
              <span v-else class="form-item-tip">---</span>
            </div>
          </div>

          <div class="about-row">
            <div class="about-label">检测更新</div>
            <div class="about-content">
              <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
                <div style="display: flex; align-items: center; gap: 10px">
                  <el-button :loading="checkingUpdate" @click="handleCheckUpdate">检测更新</el-button>
                  <el-tag v-if="updateResult?.hasUpdate" type="warning" effect="dark" size="small">
                    可更新到 v{{ updateResult.latest }}
                  </el-tag>
                </div>
                <div
                  v-if="updateResult"
                  class="form-item-tip"
                  :style="{ color: updateResult.hasUpdate ? '#e6a23c' : '#67c23a' }"
                >
                  <template v-if="updateResult.hasUpdate">
                    发现新版本 v{{ updateResult.latest }}（当前 v{{ updateResult.current }}）
                    <template v-if="updateResult.releaseUrl">
                      · <a :href="updateResult.releaseUrl" target="_blank" rel="noopener" class="about-link">查看更新内容</a>
                    </template>
                    <br />
                    升级命令：<code class="update-cmd">npm i -g @mqn00/file-manager</code>
                  </template>
                  <template v-else>
                    ✓ 已是最新版本（v{{ updateResult.current }}）
                  </template>
                </div>
                <div v-if="updateError" class="form-item-tip" style="color: #f56c6c">
                  ✗ 检测失败：{{ updateError }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getConfig, updateConfig, cleanLogs, testRegistry, type AppConfig } from '@/api/config'
import { getSystemInfo, checkUpdate, type SystemInfo, type UpdateCheckResult } from '@/api/system'
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

const systemInfo = reactive<SystemInfo>({ version: '', repoUrl: '' })
const checkingUpdate = ref(false)
const updateResult = ref<UpdateCheckResult | null>(null)
const updateError = ref('')

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

  // 「关于」信息：获取失败静默，不影响配置页功能
  try {
    Object.assign(systemInfo, await getSystemInfo())
  } catch {
    /* ignore */
  }
})

async function handleCheckUpdate() {
  checkingUpdate.value = true
  updateResult.value = null
  updateError.value = ''
  try {
    updateResult.value = await checkUpdate()
  } catch (err) {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    updateError.value = message || '请求失败'
  }
  checkingUpdate.value = false
}

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
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  overflow: hidden;
}

.config-card {
  width: 560px;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.back-bar {
  flex-shrink: 0;
  padding: 10px 10px 0;
}

.config-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 底部不留 padding：sticky 操作栏的约束盒到卡底，钉住时才能贴合卡底缘；
     内容末尾间距由 about-row 自带 margin 提供 */
  padding: 20px 36px 0;
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

/* 表单级底部操作栏：与各配置分节（认证/存储/插件/日志）区分，作用于整份配置。
   sticky 钉在滚动区底部，滚至自然位置后随内容落位（不再悬浮）。
   背景用「面板复刻」变量：内置主题为卡片面板色，miku 等带背景图的主题
   覆盖为「视口坐标重铺背景 + 暗色叠加」，避免出现一整块纯色黑。 */
/* margin-top 24px 与相邻表单项 18px 下边距折叠后取 24px，对齐 el-divider 分节间距节奏 */
.form-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding: 16px 0;
  background: var(--app-panel-replica, var(--app-panel));
  backdrop-filter: var(--app-blur);
  border-top: 1px solid var(--app-border);
}

.form-item-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-dim);
  line-height: 1.5;
}

.about-header {
  margin-top: 0;
}

.about-row {
  display: flex;
  margin-bottom: 18px;
}

.about-label {
  width: 130px;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 32px;
  color: var(--app-text);
}

.about-content {
  flex: 1;
  min-width: 0;
}

.about-section :deep(.form-item-tip) {
  margin-top: 0;
}

.about-version {
  color: var(--app-text-bright);
  font-weight: 600;
}

.about-link {
  color: var(--app-accent);
  text-decoration: none;
}

.about-link:hover {
  text-decoration: underline;
}

.update-cmd {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--app-accent-bg);
  border: 1px solid var(--app-accent-border);
  color: var(--app-text-bright);
  font-family: monospace;
  font-size: 12px;
}
</style>
