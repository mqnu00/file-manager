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
          <el-tag size="small" type="info" round>{{ plugins.length }} 个已配置</el-tag>
        </div>

        <el-table
          v-if="plugins.length > 0"
          :data="plugins"
          stripe
          style="width: 100%; margin-top: 16px"
          empty-text="没有已配置的插件"
        >
          <el-table-column prop="name" label="插件名称" min-width="140" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.enabled" size="small" type="success">已启用</el-tag>
              <el-tag v-else size="small" type="info">已禁用</el-tag>
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
          <el-table-column label="操作" width="240" align="center">
            <template #default="{ row }">
              <template v-if="row.enabled">
                <el-button size="small" @click="testPlugin(row)">测试接口</el-button>
                <el-button size="small" @click="reloadPlugin(row)">重载</el-button>
                <el-button size="small" type="danger" @click="confirmUnload(row)">卸载</el-button>
              </template>
              <el-button v-else size="small" type="primary" @click="handleLoad(row)">加载</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="没有已配置的插件" :image-size="120" />

        <el-divider />

        <div class="plugins-footer">
          <p class="hint">
            插件通过 <code>config.yml</code> 的 <code>plugins</code> 段配置。<br />
            开发目录：<code>/plugins/{name}</code>，生产环境安装到 <code>node_modules</code>。
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
import { getPlugins, loadPlugin, unloadPlugin, type PluginInfo } from '@/api/plugins'
import { loadPluginFrontend } from '@/pluginLoader'

const router = useRouter()
const plugins = ref<PluginInfo[]>([])

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
    const msg = err instanceof Error ? err.message : String(err)
    ElMessage.error(`加载失败: ${msg}`)
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

function openPluginPage(plugin: PluginInfo) {
  router.push(`/plugin/${plugin.name}`)
}

async function testPlugin(plugin: PluginInfo) {
  try {
    const res = await fetch(`/api/plugin/${plugin.name}`)
    const data = await res.json()
    ElMessage.success({
      message: `${plugin.name}: ${JSON.stringify(data)}`,
      duration: 5000,
    })
  } catch {
    ElMessage.warning(`${plugin.name} 没有测试接口或接口不可用`)
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
  width: 800px;
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
  margin-bottom: 8px;
}

.back-btn {
  color: var(--app-text-dim);
  padding: 4px 8px;
}

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
