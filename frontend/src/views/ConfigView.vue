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
import { getConfig, updateConfig, type AppConfig } from '@/api/config'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
const auth = useAuthStore()

const config = reactive<Partial<AppConfig>>({})
const saving = ref(false)

const form = reactive({
  token: '',
  tokenExpiryHours: 24,
  storageRoot: '',
})

onMounted(async () => {
  try {
    const cfg = await getConfig()
    Object.assign(config, cfg)
    form.tokenExpiryHours = cfg.auth.tokenExpiryHours
    form.storageRoot = cfg.storageRoot || ''
  } catch {
    ElMessage.error('获取配置失败')
  }
})

function handleReset() {
  form.token = ''
  form.tokenExpiryHours = config.auth?.tokenExpiryHours || 24
  form.storageRoot = config.storageRoot || ''
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

.back-btn:hover {
  color: var(--app-accent);
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
