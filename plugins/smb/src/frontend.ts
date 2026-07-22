import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'
import { createTerminal } from './terminal'

// ==================== 内联 API ====================

const API_BASE = '/api'
const STORAGE_KEY_SESSION = 'session_token'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(STORAGE_KEY_SESSION)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || (data as any).message || `HTTP ${res.status}`)
  }
  return res.json()
}

interface SmbShare { name: string; path: string; readOnly: boolean; guestOk: boolean }
interface SmbStatus {
  state: 'stopped' | 'running' | 'not_installed' | 'error'
  port: number; workgroup: string; serverString: string; shares: SmbShare[]
  authMode: 'password' | 'guest'; error?: string; startedAt?: number
}
interface SmbUser { username: string; password: string }
interface InstallInfo { manager: string; command: string; rawCommand: string; pkexecAvailable: boolean; osName: string }

const smbApi = {
  getSmbStatus() { return request<SmbStatus>('GET', '/smb/status') },
  startSmb() { return request<{ success: boolean; port: number }>('POST', '/smb/start') },
  stopSmb() { return request<{ success: boolean }>('POST', '/smb/stop') },
  updateSmbSettings(data: { port?: number; workgroup?: string; serverString?: string; enabled?: boolean }) {
    return request<{ success: boolean }>('PUT', '/smb/settings', data)
  },
  getSmbShares() { return request<SmbShare[]>('GET', '/smb/shares') },
  createSmbShare(data: { name: string; path: string; readOnly: boolean; guestOk: boolean }) {
    return request<{ success: boolean; share: SmbShare }>('POST', '/smb/shares', data)
  },
  updateSmbShare(name: string, data: { path?: string; readOnly?: boolean; guestOk?: boolean; newName?: string }) {
    return request<{ success: boolean; share: SmbShare }>('PUT', `/smb/shares/${encodeURIComponent(name)}`, data)
  },
  deleteSmbShare(name: string) { return request<{ success: boolean }>('DELETE', `/smb/shares/${encodeURIComponent(name)}`) },
  getSmbInstallInfo() { return request<InstallInfo>('GET', '/smb/install-info') },
  getSmbUsers() { return request<SmbUser[]>('GET', '/smb/users') },
  createSmbUser(data: { username: string; password: string }) {
    return request<{ success: boolean; user: { username: string } }>('POST', '/smb/users', data)
  },
  updateSmbUser(username: string, data: { password: string }) {
    return request<{ success: boolean; user: { username: string } }>('PUT', `/smb/users/${encodeURIComponent(username)}`, data)
  },
  deleteSmbUser(username: string) { return request<{ success: boolean }>('DELETE', `/smb/users/${encodeURIComponent(username)}`) },
}

// ==================== 样式 ====================

const INJECTED_STYLE_ID = 'smb-plugin-styles'

function injectStyles(): void {
  if (document.getElementById(INJECTED_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = INJECTED_STYLE_ID
  style.textContent = `
.smb-container { height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; overflow-y: auto; }
.smb-card { width: 800px; background: var(--app-panel); border: 1px solid var(--app-border); border-radius: 12px; box-shadow: var(--app-glow), var(--app-shadow); backdrop-filter: var(--app-blur); }
.smb-title { margin: 0; font-size: 20px; color: var(--app-text-bright); }
.smb-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.status-section { background: var(--app-accent-bg); border: 1px solid var(--app-border); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.status-label { font-weight: 600; color: var(--app-text-dim); }
.status-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.status-running { background: rgba(0,200,83,0.15); color: #00c853; }
.status-stopped { background: rgba(255,255,255,0.08); color: var(--app-text-dim); }
.status-not-installed { background: rgba(255,152,0,0.15); color: #ff9800; }
.status-error { background: rgba(244,67,54,0.15); color: #f44336; }
.addr-label { font-size: 12px; color: var(--app-text-dim); margin-left: 4px; }
.addr-value { font-size: 12px; background: var(--app-accent-bg); padding: 1px 6px; border-radius: 4px; color: var(--app-accent); }
.status-actions { display: flex; gap: 8px; }
.error-msg { color: #f44336; font-size: 12px; margin-top: 6px; }
.divider-label { font-size: 14px; font-weight: 600; color: var(--app-text-bright); }
.form-item-tip { font-size: 11px; color: var(--app-text-dim); margin-top: 4px; }
.terminal-wrapper { margin: 12px 0; }
.terminal-box { border-radius: 6px; overflow: hidden; min-height: 300px; }
.terminal-closed { margin-top: 8px; display: flex; align-items: center; gap: 12px; }
.exit-success { color: #00c853; font-size: 12px; }
.exit-error { color: #f44336; font-size: 12px; }
`
  document.head.appendChild(style)
}

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string; message?: string } } }
  return axiosErr.response?.data?.error || axiosErr.response?.data?.message || (err instanceof Error ? err.message : fallback)
}

// ==================== 插件入口 ====================

export const install: FrontendPluginInstallFunction = (ctx) => {
  const { h, ref, reactive, computed, onMounted, onBeforeUnmount, defineComponent, nextTick } = ctx.Vue
  const {
    ElButton, ElTag, ElTable, ElTableColumn, ElForm, ElFormItem,
    ElInput, ElInputNumber, ElSwitch, ElDialog, ElDivider, ElMessage, ElMessageBox,
  } = ctx.ElementPlus

  injectStyles()

  const SmbView = defineComponent({
    name: 'SmbView',
    setup() {
      const status = reactive<SmbStatus>({ state: 'stopped', port: 1445, workgroup: 'WORKGROUP', serverString: 'File Manager', shares: [], authMode: 'guest' })
      const actionLoading = ref<string | null>(null)
      const savingSettings = ref(false)
      const settings = reactive({ port: 1445, workgroup: 'WORKGROUP', serverString: 'File Manager' })
      const showAddDialog = ref(false)
      const savingShare = ref(false)
      const editingShare = ref<SmbShare | null>(null)
      const shareForm = reactive({ name: '', path: '', readOnly: false, guestOk: true })
      const users = ref<SmbUser[]>([])
      const showUserDialog = ref(false)
      const savingUser = ref(false)
      const editingUser = ref<SmbUser | null>(null)
      const userForm = reactive({ username: '', password: '' })

      // Terminal state
      const showTerminal = ref(false)
      const installCommand = ref('')
      const showSmbTerminal = ref(false)
      const terminalClosed = ref(false)
      const terminalExitCode = ref<number | null>(null)
      const smbTerminalClosed = ref(false)
      const smbTerminalExitCode = ref<number | null>(null)
      const termContainerRef = ref<HTMLElement | null>(null)
      const smbTermContainerRef = ref<HTMLElement | null>(null)
      let termCleanup: (() => void) | null = null
      let smbTermCleanup: (() => void) | null = null

      const statusClass = computed(() => ({ running: 'status-running', stopped: 'status-stopped', 'not_installed': 'status-not-installed', error: 'status-error' }[status.state] || ''))
      const statusText = computed(() => ({ running: '运行中', stopped: '已停止', 'not_installed': '未安装', error: '异常' }[status.state] || '未知'))
      const connectionAddr = computed(() => status.state === 'running' && status.port ? `smb://<本机IP>:${status.port}` : '')
      const authModeText = computed(() => status.authMode === 'password' ? '密码认证' : '匿名访问')

      async function refreshStatus() {
        try {
          const data = await smbApi.getSmbStatus()
          Object.assign(status, data)
          settings.port = data.port || 1445; settings.workgroup = data.workgroup || 'WORKGROUP'; settings.serverString = data.serverString || 'File Manager'
        } catch { /* */ }
      }
      async function loadUsers() { try { users.value = await smbApi.getSmbUsers() } catch { /* */ } }

      async function handleStart() {
        actionLoading.value = 'start'
        try { await smbApi.startSmb(); showSmbTerminal.value = true; smbTerminalClosed.value = false; ElMessage.success('SMB 服务已启动'); await refreshStatus() }
        catch (err) { ElMessage.error(getErrorMessage(err, '启动失败')) }
        actionLoading.value = null
      }
      async function handleStop() {
        actionLoading.value = 'stop'
        try { showSmbTerminal.value = false; await smbApi.stopSmb(); ElMessage.success('SMB 服务已停止'); await refreshStatus() }
        catch (err) { ElMessage.error(getErrorMessage(err, '停止失败')) }
        actionLoading.value = null
      }
      async function handleRestart() {
        actionLoading.value = 'restart'
        try { await smbApi.stopSmb(); await smbApi.startSmb(); showSmbTerminal.value = true; smbTerminalClosed.value = false; ElMessage.success('SMB 服务已重启'); await refreshStatus() }
        catch (err) { ElMessage.error(getErrorMessage(err, '重启失败')) }
        actionLoading.value = null
      }
      async function handleSaveSettings() {
        savingSettings.value = true
        try { await smbApi.updateSmbSettings({ port: settings.port, workgroup: settings.workgroup, serverString: settings.serverString }); ElMessage.success('设置已保存'); await refreshStatus() }
        catch { ElMessage.error('保存设置失败') }
        savingSettings.value = false
      }

      function openEditDialog(share: SmbShare) {
        editingShare.value = share; shareForm.name = share.name; shareForm.path = share.path; shareForm.readOnly = share.readOnly; shareForm.guestOk = share.guestOk
        showAddDialog.value = true
      }
      function resetShareForm() { editingShare.value = null; shareForm.name = ''; shareForm.path = ''; shareForm.readOnly = false; shareForm.guestOk = true }
      async function handleSaveShare() {
        if (!shareForm.name.trim() || !shareForm.path.trim()) { ElMessage.warning('名称和路径不能为空'); return }
        savingShare.value = true
        try {
          if (editingShare.value) {
            await smbApi.updateSmbShare(editingShare.value.name, { path: shareForm.path, readOnly: shareForm.readOnly, guestOk: shareForm.guestOk, newName: shareForm.name !== editingShare.value.name ? shareForm.name : undefined })
            ElMessage.success('共享已更新')
          } else {
            await smbApi.createSmbShare({ name: shareForm.name, path: shareForm.path, readOnly: shareForm.readOnly, guestOk: shareForm.guestOk })
            ElMessage.success('共享已创建')
          }
          showAddDialog.value = false; await refreshStatus()
        } catch (err) { ElMessage.error(getErrorMessage(err, '保存共享失败')) }
        savingShare.value = false
      }
      async function handleDeleteShare(share: SmbShare) {
        try {
          await ElMessageBox.confirm(`确定要删除共享 "${share.name}" 吗？`, '确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
          await smbApi.deleteSmbShare(share.name); ElMessage.success(`共享 "${share.name}" 已删除`); await refreshStatus()
        } catch { /* */ }
      }

      function openUserDialog(user?: SmbUser) {
        if (user) { editingUser.value = user; userForm.username = user.username; userForm.password = '' }
        else { editingUser.value = null; userForm.username = ''; userForm.password = '' }
        showUserDialog.value = true
      }
      function resetUserForm() { editingUser.value = null; userForm.username = ''; userForm.password = '' }
      async function handleSaveUser() {
        if (!userForm.username.trim() || !userForm.password) { ElMessage.warning('用户名和密码不能为空'); return }
        savingUser.value = true
        try {
          if (editingUser.value) { await smbApi.updateSmbUser(editingUser.value.username, { password: userForm.password }); ElMessage.success('密码已更新') }
          else { await smbApi.createSmbUser({ username: userForm.username, password: userForm.password }); ElMessage.success('用户已创建') }
          showUserDialog.value = false; await loadUsers(); await refreshStatus()
        } catch (err) { ElMessage.error(getErrorMessage(err, '保存用户失败')) }
        savingUser.value = false
      }
      async function handleDeleteUser(user: SmbUser) {
        try {
          await ElMessageBox.confirm(`确定要删除用户 "${user.username}" 吗？`, '确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
          await smbApi.deleteSmbUser(user.username); ElMessage.success(`用户 "${user.username}" 已删除`); await loadUsers(); await refreshStatus()
        } catch { /* */ }
      }

      async function handleStartInstall() {
        try { await ElMessageBox.confirm('将在终端中执行安装命令，请输入 sudo 密码完成安装。是否继续？', '安装确认', { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }) }
        catch { return }
        actionLoading.value = 'install'
        try { const info = await smbApi.getSmbInstallInfo(); installCommand.value = info.command; showTerminal.value = true; terminalClosed.value = false }
        catch { ElMessage.error('获取安装信息失败') }
        actionLoading.value = null
      }

      function onInstallExit(code: number) {
        if (code === 0) { ElMessage.success('Samba 安装完成') } else { ElMessage.error('安装未成功完成') }
        showTerminal.value = false; refreshStatus()
      }
      function onSmbExit(_code: number) { showSmbTerminal.value = false; refreshStatus() }

      function setupTerminal(el: HTMLElement | null, cmd: string | undefined, isSmb: boolean) {
        if (!el) return
        const c = createTerminal(el, cmd,
          isSmb ? onSmbExit : onInstallExit,
          () => { if (isSmb) showSmbTerminal.value = false; else showTerminal.value = false },
          (v) => { if (isSmb) smbTerminalClosed.value = v; else terminalClosed.value = v },
          (v) => { if (isSmb) smbTerminalExitCode.value = v; else terminalExitCode.value = v },
        )
        if (isSmb) smbTermCleanup = c; else termCleanup = c
      }

      onMounted(async () => { await refreshStatus(); if (status.state === 'running') showSmbTerminal.value = true; await loadUsers() })
      onBeforeUnmount(() => { if (termCleanup) termCleanup(); if (smbTermCleanup) smbTermCleanup() })

      return () => {
        const children: any[] = []
        children.push(h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
          h(ElButton, { text: true, class: 'back-btn', onClick: () => window.history.back() }, () => '← 返回'),
        ]))
        const m: any[] = []
        m.push(h('div', { class: 'smb-header' }, [h('h3', { class: 'smb-title' }, 'SMB 局域网共享')]))

        // Status
        const sc: any[] = []
        sc.push(h('div', { class: 'status-row' }, [
          h('span', { class: 'status-label' }, '服务状态'),
          h('span', { class: ['status-badge', statusClass.value] }, statusText.value),
          status.state === 'running' && connectionAddr.value ? [h('span', { class: 'addr-label' }, '地址：'), h('code', { class: 'addr-value' }, connectionAddr.value)] : null,
          h('span', { class: 'addr-label' }, '认证：'), h('code', { class: 'addr-value' }, authModeText.value),
        ]))
        const acts: any[] = []
        if ((status.state === 'stopped' || status.state === 'error') && !showSmbTerminal.value) acts.push(h(ElButton, { type: 'success', loading: actionLoading.value === 'start', onClick: handleStart }, () => '启动'))
        if (status.state === 'running' || showSmbTerminal.value) acts.push(h(ElButton, { type: 'danger', loading: actionLoading.value === 'stop', onClick: handleStop }, () => '停止'))
        if (status.state === 'running' && !showSmbTerminal.value) acts.push(h(ElButton, { loading: actionLoading.value === 'restart', onClick: handleRestart }, () => '重启'))
        if (status.state === 'not_installed' && !showTerminal.value) acts.push(h(ElButton, { type: 'warning', loading: actionLoading.value === 'install', onClick: handleStartInstall }, () => '⬇ 安装 Samba'))
        sc.push(h('div', { class: 'status-actions' }, acts))
        if (status.error) sc.push(h('div', { class: 'error-msg' }, status.error))
        m.push(h('div', { class: 'status-section' }, sc))

        // Install terminal
        if (showTerminal.value) {
          const tc: any[] = [h('div', { ref: termContainerRef, class: 'terminal-box', onVnodeMounted: () => nextTick(() => setupTerminal(termContainerRef.value, installCommand.value, false)) })]
          if (terminalClosed.value) tc.push(h('div', { class: 'terminal-closed' }, [
            h('span', { class: terminalExitCode.value === 0 ? 'exit-success' : 'exit-error' }, `进程已结束 (退出码: ${terminalExitCode.value})`),
            h(ElButton, { size: 'small', text: true, onClick: () => showTerminal.value = false }, () => '关闭终端'),
          ]))
          m.push(h('div', { class: 'terminal-wrapper' }, tc))
        }

        // SMB running terminal
        if (showSmbTerminal.value) {
          const tc: any[] = [h('div', { ref: smbTermContainerRef, class: 'terminal-box', onVnodeMounted: () => nextTick(() => setupTerminal(smbTermContainerRef.value, undefined, true)) })]
          if (smbTerminalClosed.value) tc.push(h('div', { class: 'terminal-closed' }, [
            h('span', { class: smbTerminalExitCode.value === 0 ? 'exit-success' : 'exit-error' }, `进程已结束 (退出码: ${smbTerminalExitCode.value})`),
            h(ElButton, { size: 'small', text: true, onClick: () => showSmbTerminal.value = false }, () => '关闭终端'),
          ]))
          m.push(h('div', { class: 'terminal-wrapper' }, tc))
        }

        // Settings
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () => h('span', { class: 'divider-label' }, '全局设置')),
          h(ElForm, { labelWidth: '110px', labelPosition: 'left' }, () => [
            h(ElFormItem, { label: '端口' }, () => [h(ElInputNumber, { modelValue: settings.port, 'onUpdate:modelValue': (v: number | undefined) => { if (v !== undefined) settings.port = v }, min: 1, max: 65535, step: 1 }), h('div', { class: 'form-item-tip' }, '默认 1445，无需 root 权限')]),
            h(ElFormItem, { label: '工作组' }, () => h(ElInput, { modelValue: settings.workgroup, 'onUpdate:modelValue': (v: string) => settings.workgroup = v, placeholder: 'WORKGROUP' })),
            h(ElFormItem, { label: '服务器名称' }, () => h(ElInput, { modelValue: settings.serverString, 'onUpdate:modelValue': (v: string) => settings.serverString = v, placeholder: 'File Manager' })),
            h(ElFormItem, {}, () => h(ElButton, { type: 'primary', loading: savingSettings.value, onClick: handleSaveSettings }, () => '保存设置')),
          ]),
        )

        // Shares
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () => h('span', { class: 'divider-label' }, '共享文件夹')),
          h('div', { style: { marginBottom: '12px' } }, [h(ElButton, { type: 'primary', size: 'small', onClick: () => showAddDialog.value = true }, () => '+ 新增共享')]),
        )
        m.push(h(ElTable, { data: status.shares, style: { width: '100%' }, 'empty-text': '暂无共享' }, () => [
          h(ElTableColumn, { prop: 'name', label: '名称' }),
          h(ElTableColumn, { prop: 'path', label: '路径' }),
          h(ElTableColumn, { label: '权限', width: '100' }, { default: ({ row }: any) => h(ElTag, { type: row.readOnly ? 'warning' : 'success', size: 'small' }, () => row.readOnly ? '只读' : '读写') }),
          h(ElTableColumn, { label: '匿名访问', width: '100' }, { default: ({ row }: any) => h(ElTag, { type: row.guestOk ? 'success' : 'info', size: 'small' }, () => row.guestOk ? '允许' : '禁止') }),
          h(ElTableColumn, { label: '操作', width: '140' }, { default: ({ row }: any) => [h(ElButton, { size: 'small', text: true, onClick: () => openEditDialog(row) }, () => '编辑'), h(ElButton, { size: 'small', text: true, type: 'danger', onClick: () => handleDeleteShare(row) }, () => '删除')] }),
        ]))

        // Users
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () => h('span', { class: 'divider-label' }, '用户管理')),
          h('div', { style: { marginBottom: '12px' } }, [h(ElButton, { type: 'primary', size: 'small', onClick: () => openUserDialog() }, () => '+ 新增用户')]),
        )
        m.push(h(ElTable, { data: users.value, style: { width: '100%' }, 'empty-text': '暂无用户（将使用匿名访问）' }, () => [
          h(ElTableColumn, { prop: 'username', label: '用户名' }),
          h(ElTableColumn, { prop: 'password', label: '密码' }, { default: () => h('span', { style: { color: 'var(--app-text-dim)' } }, '****') }),
          h(ElTableColumn, { label: '操作', width: '140' }, { default: ({ row }: any) => [h(ElButton, { size: 'small', text: true, onClick: () => openUserDialog(row) }, () => '编辑'), h(ElButton, { size: 'small', text: true, type: 'danger', onClick: () => handleDeleteUser(row) }, () => '删除')] }),
        ]))
        if (users.value.length === 0) m.push(h('p', { style: { color: 'var(--app-text-dim)', fontSize: '12px', marginTop: '4px' } }, '未配置用户时，将使用匿名访问（Guest）模式'))

        children.push(h('div', { style: { padding: '20px 36px' } }, m))

        // Dialogs
        children.push(h(ElDialog, { modelValue: showAddDialog.value, 'onUpdate:modelValue': (v: boolean) => showAddDialog.value = v, title: editingShare.value ? '编辑共享' : '新增共享', width: '480px', onClosed: resetShareForm }, {
          default: () => h(ElForm, { labelWidth: '90px' }, () => [
            h(ElFormItem, { label: '名称' }, () => h(ElInput, { modelValue: shareForm.name, 'onUpdate:modelValue': (v: string) => shareForm.name = v, placeholder: '共享名称', disabled: !!editingShare.value })),
            h(ElFormItem, { label: '路径' }, () => h(ElInput, { modelValue: shareForm.path, 'onUpdate:modelValue': (v: string) => shareForm.path = v, placeholder: '文件夹路径' })),
            h(ElFormItem, { label: '只读' }, () => h(ElSwitch, { modelValue: shareForm.readOnly, 'onUpdate:modelValue': (v: any) => { shareForm.readOnly = v as boolean } })),
            h(ElFormItem, { label: '匿名访问' }, () => h(ElSwitch, { modelValue: shareForm.guestOk, 'onUpdate:modelValue': (v: any) => { shareForm.guestOk = v as boolean } })),
          ]),
          footer: () => [h(ElButton, { onClick: () => showAddDialog.value = false }, () => '取消'), h(ElButton, { type: 'primary', loading: savingShare.value, onClick: handleSaveShare }, () => '保存')],
        }))
        children.push(h(ElDialog, { modelValue: showUserDialog.value, 'onUpdate:modelValue': (v: boolean) => showUserDialog.value = v, title: editingUser.value ? '编辑用户' : '新增用户', width: '420px', onClosed: resetUserForm }, {
          default: () => h(ElForm, { labelWidth: '80px' }, () => [
            h(ElFormItem, { label: '用户名' }, () => h(ElInput, { modelValue: userForm.username, 'onUpdate:modelValue': (v: string) => userForm.username = v, placeholder: '登录用户名', disabled: !!editingUser.value })),
            h(ElFormItem, { label: '密码' }, () => h(ElInput, { modelValue: userForm.password, 'onUpdate:modelValue': (v: string) => userForm.password = v, type: 'password', placeholder: 'SMB 密码', showPassword: true })),
          ]),
          footer: () => [h(ElButton, { onClick: () => showUserDialog.value = false }, () => '取消'), h(ElButton, { type: 'primary', loading: savingUser.value, onClick: handleSaveUser }, () => '保存')],
        }))

        return h('div', { class: 'smb-container' }, [h('div', { class: 'smb-card' }, children)])
      }
    },
  })

  ctx.router.addRoute({ path: '/plugin/smb', component: SmbView })
  console.log('[SMB Plugin] Frontend loaded — page registered at /plugin/smb')
}
