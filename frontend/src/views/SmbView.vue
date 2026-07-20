<template>
  <div class="smb-container">
    <div class="smb-card">
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div style="padding: 20px 36px">
        <div class="smb-header">
          <h3 class="smb-title">SMB 局域网共享</h3>
        </div>

        <!-- 状态区域 -->
        <div class="status-section">
          <div class="status-row">
            <span class="status-label">服务状态</span>
            <span :class="['status-badge', statusClass]">{{ statusText }}</span>
            <template v-if="status.state === 'running' && connectionAddr">
              <span class="addr-label">地址：</span>
              <code class="addr-value">{{ connectionAddr }}</code>
            </template>
            <span class="addr-label">认证：</span>
            <code class="addr-value">{{ authModeText }}</code>
          </div>
          <div class="status-actions">
            <el-button
              v-if="(status.state === 'stopped' || status.state === 'error') && !showSmbTerminal"
              type="success"
              :loading="actionLoading === 'start'"
              @click="handleStart"
            >
              启动
            </el-button>
            <el-button
              v-if="status.state === 'running' || showSmbTerminal"
              type="danger"
              :loading="actionLoading === 'stop'"
              @click="handleStop"
            >
              停止
            </el-button>
            <el-button
              v-if="status.state === 'running' && !showSmbTerminal"
              :loading="actionLoading === 'restart'"
              @click="handleRestart"
            >
              重启
            </el-button>
            <el-button
              v-if="status.state === 'not_installed' && !showTerminal"
              type="warning"
              :loading="actionLoading === 'install'"
              @click="handleStartInstall"
            >
              <el-icon><Download /></el-icon>
              安装 Samba
            </el-button>
          </div>
          <div v-if="status.error" class="error-msg">{{ status.error }}</div>
        </div>

        <!-- 终端区域 -->
        <Terminal
          v-if="showTerminal"
          :command="installCommand"
          @exit="onInstallExit"
          @close="showTerminal = false"
        />

        <!-- SMB 启动终端（viewer 模式，不传 command） -->
        <Terminal
          v-if="showSmbTerminal"
          @exit="onSmbExit"
          @close="showSmbTerminal = false"
        />

        <!-- 全局设置 -->
        <el-divider content-position="left">
          <span class="divider-label">全局设置</span>
        </el-divider>

        <el-form label-width="110px" label-position="left">
          <el-form-item label="端口">
            <el-input-number v-model="settings.port" :min="1" :max="65535" :step="1" />
            <div class="form-item-tip">默认 1445，无需 root 权限</div>
          </el-form-item>

          <el-form-item label="工作组">
            <el-input v-model="settings.workgroup" placeholder="WORKGROUP" />
          </el-form-item>

          <el-form-item label="服务器名称">
            <el-input v-model="settings.serverString" placeholder="File Manager" />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="savingSettings" @click="handleSaveSettings">
              保存设置
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 共享管理 -->
        <el-divider content-position="left">
          <span class="divider-label">共享文件夹</span>
        </el-divider>

        <div style="margin-bottom: 12px">
          <el-button type="primary" size="small" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            新增共享
          </el-button>
        </div>

        <el-table :data="status.shares" style="width: 100%" empty-text="暂无共享">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="path" label="路径" />
          <el-table-column label="权限" width="100">
            <template #default="{ row }">
              <el-tag :type="row.readOnly ? 'warning' : 'success'" size="small">
                {{ row.readOnly ? '只读' : '读写' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="匿名访问" width="100">
            <template #default="{ row }">
              <el-tag :type="row.guestOk ? 'success' : 'info'" size="small">
                {{ row.guestOk ? '允许' : '禁止' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" text @click="openEditDialog(row)">编辑</el-button>
              <el-button size="small" text type="danger" @click="handleDeleteShare(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 用户管理 -->
        <el-divider content-position="left">
          <span class="divider-label">用户管理</span>
        </el-divider>

        <div style="margin-bottom: 12px">
          <el-button type="primary" size="small" @click="openUserDialog()">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>

        <el-table :data="users" style="width: 100%" empty-text="暂无用户（将使用匿名访问）">
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="password" label="密码">
            <template #default>
              <span style="color: var(--app-text-dim)">****</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" text @click="openUserDialog(row)">编辑</el-button>
              <el-button size="small" text type="danger" @click="handleDeleteUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <p v-if="users.length === 0" style="color: var(--app-text-dim); font-size: 12px; margin-top: 4px;">
          未配置用户时，将使用匿名访问（Guest）模式
        </p>
      </div>
    </div>

    <!-- 新增/编辑共享对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingShare ? '编辑共享' : '新增共享'"
      width="480px"
      @closed="resetShareForm"
    >
      <el-form label-width="90px">
        <el-form-item label="名称">
          <el-input v-model="shareForm.name" placeholder="共享名称" :disabled="!!editingShare" />
        </el-form-item>
        <el-form-item label="路径">
          <el-input v-model="shareForm.path" placeholder="文件夹路径 (基于存储根目录)" />
        </el-form-item>
        <el-form-item label="只读">
          <el-switch v-model="shareForm.readOnly" />
        </el-form-item>
        <el-form-item label="匿名访问">
          <el-switch v-model="shareForm.guestOk" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingShare" @click="handleSaveShare">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑用户对话框 -->
    <el-dialog
      v-model="showUserDialog"
      :title="editingUser ? '编辑用户' : '新增用户'"
      width="420px"
      @closed="resetUserForm"
    >
      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" placeholder="登录用户名" :disabled="!!editingUser" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="userForm.password" type="password" placeholder="SMB 密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingUser" @click="handleSaveUser">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Download } from '@element-plus/icons-vue'
import {
  getSmbStatus,
  startSmb,
  stopSmb,
  updateSmbSettings,
  createSmbShare,
  updateSmbShare,
  deleteSmbShare,
  getSmbInstallInfo,
  getSmbUsers,
  createSmbUser,
  updateSmbUser,
  deleteSmbUser,
  type SmbStatus,
  type SmbShare,
  type SmbUser,
} from '@/api/smb'
import Terminal from '@/components/Terminal.vue'

const router = useRouter()

const status = reactive<SmbStatus>({
  state: 'stopped',
  port: 1445,
  workgroup: 'WORKGROUP',
  serverString: 'File Manager',
  shares: [],
  authMode: 'guest',
})

const actionLoading = ref<string | null>(null)
const savingSettings = ref(false)

const settings = reactive({
  port: 1445,
  workgroup: 'WORKGROUP',
  serverString: 'File Manager',
})

const showAddDialog = ref(false)
const savingShare = ref(false)
const editingShare = ref<SmbShare | null>(null)
const shareForm = reactive({
  name: '',
  path: '',
  readOnly: false,
  guestOk: true,
})

const statusClass = computed(() => {
  switch (status.state) {
    case 'running': return 'status-running'
    case 'stopped': return 'status-stopped'
    case 'not_installed': return 'status-not-installed'
    case 'error': return 'status-error'
    default: return ''
  }
})

const statusText = computed(() => {
  switch (status.state) {
    case 'running': return '运行中'
    case 'stopped': return '已停止'
    case 'not_installed': return '未安装'
    case 'error': return '异常'
    default: return '未知'
  }
})

const connectionAddr = computed(() => {
  if (status.state !== 'running' || !status.port) return ''
  return `smb://<本机IP>:${status.port}`
})

const authModeText = computed(() => {
  return status.authMode === 'password' ? '密码认证' : '匿名访问'
})

async function refreshStatus() {
  try {
    const data = await getSmbStatus()
    Object.assign(status, data)
    settings.port = data.port || 1445
    settings.workgroup = data.workgroup || 'WORKGROUP'
    settings.serverString = data.serverString || 'File Manager'
  } catch {
    ElMessage.error('获取 SMB 状态失败')
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string; message?: string } } }
  return axiosErr.response?.data?.error
    || axiosErr.response?.data?.message
    || (err instanceof Error ? err.message : fallback)
}

async function handleSaveSettings() {
  savingSettings.value = true
  try {
    await updateSmbSettings({
      port: settings.port,
      workgroup: settings.workgroup,
      serverString: settings.serverString,
    })
    ElMessage.success('设置已保存')
    await refreshStatus()
  } catch {
    ElMessage.error('保存设置失败')
  }
  savingSettings.value = false
}

function openEditDialog(share: SmbShare) {
  editingShare.value = share
  shareForm.name = share.name
  shareForm.path = share.path
  shareForm.readOnly = share.readOnly
  shareForm.guestOk = share.guestOk
  showAddDialog.value = true
}

function resetShareForm() {
  editingShare.value = null
  shareForm.name = ''
  shareForm.path = ''
  shareForm.readOnly = false
  shareForm.guestOk = true
}

async function handleSaveShare() {
  if (!shareForm.name.trim() || !shareForm.path.trim()) {
    ElMessage.warning('名称和路径不能为空')
    return
  }

  savingShare.value = true
  try {
    if (editingShare.value) {
      await updateSmbShare(editingShare.value.name, {
        path: shareForm.path,
        readOnly: shareForm.readOnly,
        guestOk: shareForm.guestOk,
        newName: shareForm.name !== editingShare.value.name ? shareForm.name : undefined,
      })
      ElMessage.success('共享已更新')
    } else {
      await createSmbShare({
        name: shareForm.name,
        path: shareForm.path,
        readOnly: shareForm.readOnly,
        guestOk: shareForm.guestOk,
      })
      ElMessage.success('共享已创建')
    }
    showAddDialog.value = false
    await refreshStatus()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '保存共享失败'
    ElMessage.error(msg)
  }
  savingShare.value = false
}

async function handleDeleteShare(share: SmbShare) {
  try {
    await ElMessageBox.confirm(`确定要删除共享 "${share.name}" 吗？`, '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSmbShare(share.name)
    ElMessage.success(`共享 "${share.name}" 已删除`)
    await refreshStatus()
  } catch {
    // 取消删除
  }
}

// ==================== 用户管理 ====================

const users = ref<SmbUser[]>([])
const showUserDialog = ref(false)
const savingUser = ref(false)
const editingUser = ref<SmbUser | null>(null)
const userForm = reactive({
  username: '',
  password: '',
})

async function loadUsers() {
  try {
    users.value = await getSmbUsers()
  } catch {
    // 忽略加载失败
  }
}

function openUserDialog(user?: SmbUser) {
  if (user) {
    editingUser.value = user
    userForm.username = user.username
    userForm.password = ''
  } else {
    editingUser.value = null
    userForm.username = ''
    userForm.password = ''
  }
  showUserDialog.value = true
}

function resetUserForm() {
  editingUser.value = null
  userForm.username = ''
  userForm.password = ''
}

async function handleSaveUser() {
  if (!userForm.username.trim() || !userForm.password) {
    ElMessage.warning('用户名和密码不能为空')
    return
  }

  savingUser.value = true
  try {
    if (editingUser.value) {
      await updateSmbUser(editingUser.value.username, { password: userForm.password })
      ElMessage.success('密码已更新')
    } else {
      await createSmbUser({ username: userForm.username, password: userForm.password })
      ElMessage.success('用户已创建')
    }
    showUserDialog.value = false
    await loadUsers()
    await refreshStatus()
  } catch (err: unknown) {
    ElMessage.error(getErrorMessage(err, '保存用户失败'))
  }
  savingUser.value = false
}

async function handleDeleteUser(user: SmbUser) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 "${user.username}" 吗？`, '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSmbUser(user.username)
    ElMessage.success(`用户 "${user.username}" 已删除`)
    await loadUsers()
    await refreshStatus()
  } catch {
    // 取消删除
  }
}

const showTerminal = ref(false)
const installCommand = ref('')

const showSmbTerminal = ref(false)

// 页面加载时，如果 SMB 正在运行，自动显示终端
async function autoConnectIfRunning() {
  await refreshStatus()
  if (status.state === 'running') {
    showSmbTerminal.value = true
  }
}

async function handleStart() {
  actionLoading.value = 'start'
  try {
    await startSmb()
    showSmbTerminal.value = true
    ElMessage.success('SMB 服务已启动')
    await refreshStatus()
  } catch (err: unknown) {
    ElMessage.error(getErrorMessage(err, '启动失败'))
  }
  actionLoading.value = null
}

async function handleStop() {
  actionLoading.value = 'stop'
  try {
    showSmbTerminal.value = false
    await stopSmb()
    ElMessage.success('SMB 服务已停止')
    await refreshStatus()
  } catch (err: unknown) {
    ElMessage.error(getErrorMessage(err, '停止失败'))
  }
  actionLoading.value = null
}

async function onSmbExit(_code: number) {
  showSmbTerminal.value = false
  await refreshStatus()
}

async function handleRestart() {
  actionLoading.value = 'restart'
  try {
    await stopSmb()
    await startSmb()
    showSmbTerminal.value = true
    ElMessage.success('SMB 服务已重启')
    await refreshStatus()
  } catch (err: unknown) {
    ElMessage.error(getErrorMessage(err, '重启失败'))
  }
  actionLoading.value = null
}

async function handleStartInstall() {
  try {
    await ElMessageBox.confirm(
      '将在下方终端中执行安装命令，请在终端中输入 sudo 密码完成安装。是否继续？',
      '安装确认',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }

  actionLoading.value = 'install'
  try {
    const info = await getSmbInstallInfo()
    installCommand.value = info.command
    showTerminal.value = true
  } catch {
    ElMessage.error('获取安装信息失败')
  }
  actionLoading.value = null
}

async function onInstallExit(code: number) {
  if (code === 0) {
    ElMessage.success('Samba 安装完成')
    showTerminal.value = false
    await refreshStatus()
  } else {
    ElMessage.error('安装未成功完成，请检查终端输出')
  }
}

onMounted(() => {
  autoConnectIfRunning()
  loadUsers()
})
</script>

<style scoped>
.smb-container {
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  overflow-y: auto;
}

.smb-card {
  width: 640px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.smb-title {
  margin: 0;
  font-size: 20px;
  color: var(--app-text-bright);
}

.smb-header {
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

.status-section {
  background: var(--app-accent-bg);
  border: 1px solid var(--app-accent-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.status-label {
  color: var(--app-text-dim);
  font-size: 14px;
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.status-running {
  background: rgb(0 200 83 / 15%);
  color: #00c853;
  border: 1px solid rgb(0 200 83 / 30%);
}

.status-stopped {
  background: rgb(158 158 158 / 15%);
  color: #9e9e9e;
  border: 1px solid rgb(158 158 158 / 30%);
}

.status-not-installed {
  background: rgb(255 152 0 / 15%);
  color: #ff9800;
  border: 1px solid rgb(255 152 0 / 30%);
}

.status-error {
  background: rgb(244 67 54 / 15%);
  color: #f44336;
  border: 1px solid rgb(244 67 54 / 30%);
}

.addr-label {
  color: var(--app-text-dim);
  font-size: 13px;
}

.addr-value {
  background: var(--app-panel);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--app-accent);
}

.status-actions {
  display: flex;
  gap: 8px;
}

.error-msg {
  margin-top: 8px;
  color: #f44336;
  font-size: 13px;
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
