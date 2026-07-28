<template>
  <div class="plugins-container">
    <div class="plugins-card">
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>
      <div style="padding: 20px 36px">
        <div class="plugins-header">
          <h3 class="plugins-title">插件管理</h3>
        </div>

        <el-tabs v-model="activeTab" class="plugins-tabs">
          <!-- Tab 1: 已安装 -->
          <el-tab-pane label="已安装" name="installed">
            <div class="tab-header">
              <el-tag size="small" type="info" round>{{ plugins.length }} 个已配置</el-tag>
            </div>

            <el-table
              v-if="plugins.length > 0"
              :data="plugins"
              stripe
              style="width: 100%; margin-top: 12px"
              empty-text="没有已配置的插件"
            >
              <el-table-column prop="name" label="插件名称" min-width="140" />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.enabled" size="small" type="success">已启用</el-tag>
                  <el-tag v-else size="small" type="info">已禁用</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="来源" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.local" size="small">本地开发</el-tag>
                  <el-tag v-else size="small" type="info">npm 包</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="前端入口" min-width="160">
                <template #default="{ row }">
                  <el-button
                    v-if="row.frontendPath"
                    size="small"
                    text
                    type="primary"
                    @click="openPluginPage(row)"
                  >
                    打开页面
                  </el-button>
                  <el-tag v-else size="small" type="warning">无前端</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="280" align="center">
                <template #default="{ row }">
                  <template v-if="row.enabled">
                    <el-button size="small" @click="reloadPlugin(row)">重载</el-button>
                    <el-button size="small" type="danger" @click="confirmUnload(row)">卸载</el-button>
                  </template>
                  <el-button v-else size="small" type="primary" @click="handleLoad(row)">加载</el-button>
                  <el-button
                    v-if="!row.local"
                    size="small"
                    type="danger"
                    plain
                    @click="confirmDelete(row)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-empty v-else description="没有已配置的插件" :image-size="120" />
          </el-tab-pane>

          <!-- Tab 2: 发现插件 -->
          <el-tab-pane label="发现插件" name="discover">
            <div class="discover-search">
              <el-input
                v-model="searchQuery"
                placeholder="搜索 npm registry 中的插件…"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              >
                <template #append>
                  <el-button @click="handleSearch" :loading="searching">搜索</el-button>
                </template>
              </el-input>
              <div class="discover-options">
                <el-switch v-model="forceInstall" size="small" />
                <span class="force-label">强制安装（忽略 peer dependency）</span>
              </div>
            </div>

            <!-- 搜索结果 -->
            <div v-if="searchResults.length > 0" class="search-results">
              <div
                v-for="item in searchResults"
                :key="item.name"
                class="search-result-item"
              >
                <div class="result-info">
                  <div class="result-name">
                    {{ item.name }}
                    <el-tag size="small" type="info" class="result-version">v{{ item.version }}</el-tag>
                  </div>
                  <div class="result-desc">{{ item.description }}</div>
                  <div class="result-meta">
                    <span v-if="item.publisher">by {{ item.publisher }}</span>
                    <span v-if="item.date"> · {{ formatDate(item.date) }}</span>
                  </div>
                </div>
                <div class="result-action">
                  <!-- 已安装的 npm 插件：切换版本 -->
                  <template v-if="isInstalled(item.name)">
                    <el-input
                      v-model="installVersions[item.name]"
                      size="small"
                      class="version-input"
                      placeholder="版本"
                    />
                    <el-button
                      size="small"
                      type="warning"
                      :loading="installing === item.name"
                      @click="handleInstall(item)"
                    >切换版本</el-button>
                  </template>
                  <!-- 同名本地插件存在：允许安装但会覆盖 -->
                  <template v-else-if="hasLocalConflict(item.name)">
                    <el-input
                      v-model="installVersions[item.name]"
                      size="small"
                      class="version-input"
                      placeholder="版本"
                    />
                    <el-button
                      size="small"
                      type="primary"
                      :loading="installing === item.name"
                      @click="handleInstall(item)"
                    >安装</el-button>
                    <el-tag size="small" type="warning" class="local-warn">本地同名</el-tag>
                  </template>
                  <!-- 未安装 -->
                  <template v-else>
                    <el-input
                      v-model="installVersions[item.name]"
                      size="small"
                      class="version-input"
                      placeholder="版本"
                    />
                    <el-button
                      size="small"
                      type="primary"
                      :loading="installing === item.name"
                      @click="handleInstall(item)"
                    >安装</el-button>
                  </template>
                </div>
              </div>
            </div>

            <el-empty
              v-else-if="searched && !searching"
              description="未找到匹配的插件"
              :image-size="100"
            />
          </el-tab-pane>
        </el-tabs>

        <el-divider />
        <div class="plugins-footer">
          <p class="hint">
            在"发现插件"中搜索 npm registry 上标记了 <code>file-manager-plugin</code> 关键词的包。<br />
            安装后插件配置自动写入 <code>config.yml</code>，默认启用。本地插件从 <code>plugins/</code> 目录加载。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  getPlugins,
  loadPlugin,
  unloadPlugin,
  searchPlugins,
  installPlugin,
  deletePlugin,
  type PluginInfo,
  type NpmSearchResult,
} from '@/api/plugins'
import { loadPluginFrontend } from '@/pluginLoader'

const router = useRouter()
const plugins = ref<PluginInfo[]>([])
const activeTab = ref('installed')

// ---- 发现插件状态 ----
const searchQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref<NpmSearchResult[]>([])
const installing = ref<string | null>(null)
const installVersions = ref<Record<string, string>>({})
const forceInstall = ref(false)

onMounted(async () => {
  await refreshList()
})

async function refreshList() {
  try {
    plugins.value = await getPlugins()
  } catch {
    ElMessage.error('获取插件列表失败')
  }
}

// ---- 已安装操作 ----

async function handleLoad(plugin: PluginInfo) {
  try {
    const result = await loadPlugin(plugin.name)
    ElMessage.success(`插件 "${plugin.name}" 已加载`)
    await refreshList()

    if (result.frontendPath) {
      try {
        await loadPluginFrontend(result)
      } catch {
        // loadPluginFrontend 内部已处理日志
      }
    }
  } catch (err: unknown) {
    ElMessage.error(`加载失败: ${extractError(err)}`)
  }
}

async function confirmUnload(plugin: PluginInfo) {
  try {
    await ElMessageBox.confirm(
      `确定要卸载插件 "${plugin.name}" 吗？卸载后建议刷新页面以清理前端状态。`,
      '确认卸载',
      { confirmButtonText: '卸载', cancelButtonText: '取消', type: 'warning' }
    )
    await unloadPlugin(plugin.name)
    ElMessage.success(`插件 "${plugin.name}" 已卸载，请刷新页面清理前端状态`)
    await refreshList()
  } catch {
    // 用户取消
  }
}

async function reloadPlugin(plugin: PluginInfo) {
  try {
    await ElMessageBox.confirm(
      `确定要重载插件 "${plugin.name}" 吗？`,
      '确认重载',
      { confirmButtonText: '重载', cancelButtonText: '取消', type: 'info' }
    )
    await unloadPlugin(plugin.name)
    const reloaded = await loadPlugin(plugin.name)
    ElMessage.success(`插件 "${plugin.name}" 已重载`)
    await refreshList()

    if (reloaded.frontendPath) {
      try {
        await loadPluginFrontend(reloaded)
      } catch {
        // loadPluginFrontend 内部已处理日志
      }
    }
  } catch {
    // 用户取消
  }
}

async function confirmDelete(plugin: PluginInfo) {
  try {
    await ElMessageBox.confirm(
      `确定要删除插件 "${plugin.name}" 吗？这将执行 npm uninstall 并从 config.yml 中移除配置。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }
  try {
    await deletePlugin(plugin.name)
    ElMessage.success(`插件 "${plugin.name}" 已删除，即将刷新页面...`)
    setTimeout(() => { window.location.reload() }, 800)
  } catch (err: unknown) {
    ElMessage.error(`删除失败: ${extractError(err)}`)
  }
}

function openPluginPage(plugin: PluginInfo) {
  router.push(`/plugin/${plugin.name}`)
}

// ---- 发现插件操作 ----

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searched.value = false
    return
  }
  searching.value = true
  searched.value = false
  try {
    searchResults.value = await searchPlugins(searchQuery.value.trim())
    // 初始化版本号
    const versions: Record<string, string> = {}
    for (const item of searchResults.value) {
      versions[item.name] = item.version
    }
    installVersions.value = versions
    searched.value = true
  } catch (err: unknown) {
    ElMessage.error(`搜索失败: ${extractError(err)}`)
  } finally {
    searching.value = false
  }
}

function isInstalled(packageName: string): boolean {
  const shortName = deriveShortName(packageName)
  return plugins.value.some((p) => p.name === shortName && p.source === 'npm')
}

/** 是否存在同名本地插件（阻止将 npm 包标记为"已安装"） */
function hasLocalConflict(packageName: string): boolean {
  const shortName = deriveShortName(packageName)
  return plugins.value.some((p) => p.name === shortName && p.source === 'local')
}

function deriveShortName(packageName: string): string {
  const unscoped = packageName.includes('/') ? packageName.split('/')[1] : packageName
  const prefix = 'file-manager-plugin-'
  return unscoped.startsWith(prefix) ? unscoped.slice(prefix.length) : unscoped
}

async function handleInstall(item: NpmSearchResult) {
  const ver = installVersions.value[item.name] || undefined
  const verLabel = ver ? `v${ver}` : '最新版'

  // 本地同名插件警告
  if (hasLocalConflict(item.name)) {
    try {
      await ElMessageBox.confirm(
        `已存在同名本地插件，安装 npm 包将覆盖本地插件配置。确定安装 "${item.name}" (${verLabel}) 吗？`,
        '本地插件冲突',
        { confirmButtonText: '覆盖安装', cancelButtonText: '取消', type: 'warning' }
      )
    } catch { return }
  } else if (isInstalled(item.name)) {
    // 版本切换确认
    try {
      await ElMessageBox.confirm(
        `确定要将 "${item.name}" 切换到 ${verLabel} 吗？`,
        '切换版本',
        { confirmButtonText: '切换', cancelButtonText: '取消', type: 'info' }
      )
    } catch { return }
  } else {
    try {
      await ElMessageBox.confirm(
        `确定要安装插件 "${item.name}" (${verLabel}) 吗？`,
        '确认安装',
        { confirmButtonText: '安装', cancelButtonText: '取消', type: 'info' }
      )
    } catch { return }
  }

  installing.value = item.name
  try {
    await installPlugin(item.name, ver, forceInstall.value)
    ElMessage.success(`插件 "${item.name}" 安装成功，即将刷新页面...`)
    setTimeout(() => { window.location.reload() }, 800)
  } catch (err: unknown) {
    const msg = extractError(err)
    ElMessage.error(`安装失败: ${msg}`)
  } finally {
    installing.value = null
  }
}

/** 从 axios 错误中提取服务器返回的 error 消息 */
function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { error?: string } } }).response
    if (resp?.data?.error) return resp.data.error
  }
  return err instanceof Error ? err.message : String(err)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.plugins-container {
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  overflow-y: auto;
}

.plugins-card {
  width: 1000px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
}

.plugins-title {
  margin: 0;
  font-size: 20px;
  color: var(--app-text-bright);
}

.plugins-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.back-btn {
  color: var(--app-text-dim);
  padding: 4px 8px;
}

.plugins-tabs {
  margin-top: 4px;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

/* ---- 发现插件 ---- */

.discover-search {
  margin: 12px 0 16px;
}

.discover-options {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.force-label {
  font-size: 12px;
  color: var(--app-text-dim);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg);
  transition: border-color 0.2s;
}

.search-result-item:hover {
  border-color: var(--app-accent);
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-bright);
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-version {
  font-weight: 400;
}

.result-desc {
  font-size: 13px;
  color: var(--app-text-dim);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta {
  font-size: 12px;
  color: var(--app-text-dim);
  margin-top: 4px;
}

.result-action {
  flex-shrink: 0;
  margin-left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-input {
  width: 90px;
}

.local-warn {
  flex-shrink: 0;
}

/* ---- footer ---- */

.plugins-footer {
  margin-top: 8px;
}

.hint {
  font-size: 13px;
  color: var(--app-text-dim);
  line-height: 1.8;
}

.hint code {
  background: var(--app-accent-bg);
  color: var(--app-accent);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
