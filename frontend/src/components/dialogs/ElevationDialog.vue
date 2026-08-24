<template>
  <el-dialog
    :model-value="visible"
    title="提权以继续操作"
    width="360px"
    :close-on-click-modal="false"
    @update:model-value="onVisibleChange"
  >
    <div class="elevate-form">
      <el-input v-model="usernameInput" placeholder="用户名（如 ubuntu）" />
      <el-input
        v-model="passwordInput"
        type="password"
        show-password
        placeholder="密码"
        @keyup.enter="onConfirm"
      />
      <el-checkbox v-model="chownBack">提权后归还属主给当前用户</el-checkbox>
      <div class="elevate-hint">不勾选则新建/重命名的文件保持 root 属主</div>
      <div v-if="error" class="elevate-error">{{ error }}</div>
    </div>
    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" :loading="loading" @click="onConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useElevation } from '@/composables/useElevation'
import { elevate } from '@/api/elevation'

const { visible, error, username, chownBack, resolveSuccess, cancel } = useElevation()

const usernameInput = ref('')
const passwordInput = ref('')
const loading = ref(false)

// 对话框打开时同步默认用户名并清空密码
watch(visible, (v) => {
  if (v) {
    usernameInput.value = username.value
    passwordInput.value = ''
    loading.value = false
  }
})

async function onConfirm(): Promise<void> {
  if (!usernameInput.value.trim()) {
    error.value = '请输入用户名'
    return
  }
  if (!passwordInput.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  try {
    await elevate(usernameInput.value.trim(), passwordInput.value, chownBack.value)
    resolveSuccess(usernameInput.value.trim(), passwordInput.value, chownBack.value)
  } catch (e: any) {
    error.value = e?.response?.data?.error || '提权失败'
  } finally {
    loading.value = false
  }
}

function onCancel(): void {
  cancel()
}

function onVisibleChange(v: boolean): void {
  if (!v) cancel()
}
</script>

<style scoped>
.elevate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.elevate-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: -6px;
}

.elevate-error {
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
