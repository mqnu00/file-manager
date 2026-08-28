<template>
  <div class="plugins-container">
    <div
      class="plugins-card"
      v-loading="busyAction !== null"
      :element-loading-text="
        busyAction ? `正在${busyAction.verb}插件「${busyAction.name}」，请勿进行其他操作…` : ''
      "
    >
      <div style="padding-top: 10px; padding-left: 10px">
        <el-button text class="back-btn" :disabled="busyAction !== null" @click="router.push('/')">
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
                  <el-tooltip
                    v-if="row.compatible === false"
                    :content="compatReason(row) || '不兼容当前环境'"
                    placement="top"
                  >
                    <el-tag size="small" type="danger">不兼容</el-tag>
                  </el-tooltip>
                  <el-tooltip
                    v-else-if="row.compatibilityWarning"
                    :content="row.compatibilityWarning"
                    placement="top"
                  >
                    <el-tag size="small" type="warning">兼容警告</el-tag>
                  </el-tooltip>
                  <el-tag v-else-if="row.enabled" size="small" type="success">已启用</el-tag>
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
                    v-if="row.frontendPage"
                    size="small"
                    text
                    type="primary"
                    @click="openPluginPage(row)"
                  >
                    进入前端
                  </el-button>
                  <el-tag v-else size="small" type="warning">无配置页</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="280" align="center">
                <template #default="{ row }">
                  <template v-if="row.enabled">
                    <el-button
                      size="small"
                      :disabled="busyAction !== null"
                      @click="reloadPlugin(row)"
                    >重载</el-button>
                    <el-button
                      size="small"
                      type="danger"
                      :disabled="busyAction !== null"
                      @click="confirmUnload(row)"
                    >卸载</el-button>
                  </template>
                  <el-button
                    v-else
                    size="small"
                    type="primary"
                    :disabled="busyAction !== null || row.compatible === false"
                    @click="handleLoad(row)"
                  >加载</el-button>
                  <el-button
                    v-if="!row.local"
                    size="small"
                    type="danger"
                    plain
                    :disabled="busyAction !== null"
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
                    <PluginVersionSelect
                      v-model="installVersions[item.name]"
                      :package-name="item.name"
                      :installed-version="installedVersionOf(item.name)"
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
                    <PluginVersionSelect
                      v-model="installVersions[item.name]"
                      :package-name="item.name"
                      :installed-version="installedVersionOf(item.name)"
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
                    <PluginVersionSelect
                      v-model="installVersions[item.name]"
                      :package-name="item.name"
                      :installed-version="installedVersionOf(item.name)"
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

            <div v-if="searchTotal > pageSize" class="pagination-wrapper">
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :total="searchTotal"
                :page-sizes="[20, 50, 100]"
                layout="total, sizes, prev, pager, next"
                @current-change="fetchSearch"
                @size-change="handleSizeChange"
              />
            </div>
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
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElCheckbox } from 'element-plus'
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
import { loadPluginFrontend, unloadPluginFrontend } from '@/pluginLoader'
import { emitPluginsChanged } from '@/platform/fileOpen'
import PluginVersionSelect from '@/components/PluginVersionSelect.vue'

/** 聚合插件的兼容性原因（宿主版本 + 依赖问题），用于不兼容标签的 tooltip */
function compatReason(row: PluginInfo): string {
  const parts: string[] = []
  if (row.minHostVersion) {
    parts.push(`需主项目 ${row.minHostVersion}`)
  }
  for (const issue of row.dependencyIssues ?? []) {
    switch (issue.status) {
      case 'missing':
        parts.push(`依赖 ${issue.name} 缺失`)
        break
      case 'disabled':
        parts.push(`依赖 ${issue.name} 已安装但未启用`)
        break
      case 'mismatch':
        parts.push(`依赖 ${issue.name} 要求 ${issue.required}，当前 ${issue.current}`)
        break
    }
  }
  return parts.join('；')
}

const router = useRouter()
const plugins = ref<PluginInfo[]>([])
const activeTab = ref('installed')

// ---- 发现插件状态 ----
const searchQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref<NpmSearchResult[]>([])
const searchTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
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

/**
 * 卸载/重载异步操作标记：非 null 表示插件管理操作进行中。
 * 期间整卡加载遮罩 + 操作按钮禁用，阻止用户的其他操作；结束（含异常）后复位。
 */
const busyAction = ref<{ name: string; verb: string } | null>(null)

/** 在「进行中 → 完成/失败」时间段内执行 fn：置忙 → await → 复位 */
async function runWithBusy<T>(name: string, verb: string, fn: () => Promise<T>): Promise<T> {
  busyAction.value = { name, verb }
  try {
    return await fn()
  } finally {
    busyAction.value = null
  }
}

async function handleLoad(plugin: PluginInfo) {
  try {
    const result = await loadPlugin(plugin.name)
    if (result.compatibilityWarning) {
      ElMessage.warning(`插件 "${plugin.name}" 已加载（兼容性警告：${result.compatibilityWarning}）`)
    } else {
      ElMessage.success(`插件 "${plugin.name}" 已加载`)
    }
    await refreshList()
    // 加载后广播：查看器核心等据此重算可打开集合（后端注册表已就绪）
    emitPluginsChanged()

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
  if (busyAction.value) return
  try {
    await ElMessageBox.confirm(
      `确定要卸载插件 "${plugin.name}" 吗？其前端模块（路由/监听/注册项）将一并清理，无需刷新页面。`,
      '确认卸载',
      { confirmButtonText: '卸载', cancelButtonText: '取消', type: 'warning' }
    )
    // 整个卸载流程（前端清理 + 后端卸载）期间阻止页面其他操作
    await runWithBusy(plugin.name, '卸载', async () => {
      // 先清理前端实例（平台收集的路由/主题 + 插件 teardown），再卸载后端
      await unloadPluginFrontend(plugin.name)
      await unloadPlugin(plugin.name)
    })
    ElMessage.success(`插件 "${plugin.name}" 已卸载`)
    await refreshList()
    // 卸载后广播：后端注册表已由子插件 teardown 注销，查看器核心据此重算可打开集合
    emitPluginsChanged()
  } catch {
    // 用户取消
  }
}

async function reloadPlugin(plugin: PluginInfo) {
  if (busyAction.value) return
  try {
    await ElMessageBox.confirm(
      `确定要重载插件 "${plugin.name}" 吗？`,
      '确认重载',
      { confirmButtonText: '重载', cancelButtonText: '取消', type: 'info' }
    )
    // 整个重载流程（前端清理 → 后端卸载/加载 → 前端重装）期间阻止页面其他操作
    await runWithBusy(plugin.name, '重载', async () => {
      // 前端先行卸载（清理旧实例副作用），后端重载后重新安装前端
      await unloadPluginFrontend(plugin.name)
      await unloadPlugin(plugin.name)
      const reloaded = await loadPlugin(plugin.name)
      if (reloaded.frontendPath) {
        try {
          await loadPluginFrontend(reloaded)
        } catch {
          // loadPluginFrontend 内部已处理日志
        }
      }
    })
    ElMessage.success(`插件 "${plugin.name}" 已重载`)
    await refreshList()
    // 重载后广播：重算可打开集合
    emitPluginsChanged()
  } catch {
    // 用户取消
  }
}

async function confirmDelete(plugin: PluginInfo) {
  // 数据目录是否一并删除（默认保留，由用户勾选）
  let clearData = false
  try {
    await ElMessageBox({
      title: '确认删除',
      type: 'warning',
      message: h('div', [
        h(
          'p',
          `确定要删除插件 "${plugin.name}" 吗？这将执行 npm uninstall 并从 config.yml 中移除配置。`,
        ),
        h(ElCheckbox, {
          modelValue: clearData,
          'onUpdate:modelValue': (v: string | number | boolean) => {
            clearData = Boolean(v)
          },
          label: '同时删除该插件的本地数据目录',
        }),
      ]),
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await deletePlugin(plugin.name, clearData)
    ElMessage.success(`插件 "${plugin.name}" 已删除，即将刷新页面...`)
    setTimeout(() => {
      window.location.reload()
    }, 800)
  } catch (err: unknown) {
    ElMessage.error(`删除失败: ${extractError(err)}`)
  }
}

function openPluginPage(plugin: PluginInfo) {
  // frontendPage 由插件声明，非空才显示按钮
  if (plugin.frontendPage) router.push(plugin.frontendPage)
}

// ---- 发现插件操作 ----

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searched.value = false
    searchTotal.value = 0
    return
  }
  currentPage.value = 1
  await fetchSearch()
}

function handleSizeChange() {
  currentPage.value = 1
  fetchSearch()
}

async function fetchSearch() {
  searching.value = true
  searched.value = false
  try {
    const res = await searchPlugins(searchQuery.value.trim(), currentPage.value, pageSize.value)
    searchResults.value = res.results
    searchTotal.value = res.total
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

/** 同名插件（npm 或本地）当前安装的版本，未安装返回 null */
function installedVersionOf(packageName: string): string | null {
  const shortName = deriveShortName(packageName)
  return plugins.value.find((p) => p.name === shortName)?.version ?? null
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

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
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
