<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>文件管理器</h2>
        <p>请输入访问令牌以继续</p>
      </div>
      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-form-item>
          <el-input
            v-model="token"
            type="password"
            placeholder="输入令牌"
            show-password
            size="large"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
        <p v-if="error" class="login-error">{{ error }}</p>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const auth = useAuthStore()
const token = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function handleLogin() {
  if (!token.value.trim()) {
    error.value = '请输入令牌'
    return
  }
  loading.value = true
  error.value = null
  const success = await auth.login(token.value.trim())
  loading.value = false
  if (success) {
    ElMessage.success('登录成功')
    router.replace('/')
  } else {
    error.value = auth.loginError || '令牌错误'
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 380px;
  padding: 40px 36px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  margin: 0 0 8px;
  font-size: 24px;
  color: var(--app-text-bright);
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-dim);
}

.login-form {
  max-width: 100%;
}

.login-btn {
  width: 100%;
}

.login-error {
  margin: 0;
  text-align: center;
  color: #f56c6c;
  font-size: 13px;
}
</style>