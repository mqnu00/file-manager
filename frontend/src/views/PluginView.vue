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
          <el-tag size="small" type="info" round>{{ plugins.length }} 个已加载</el-tag>
        </div>

        <el-table
          v-if="plugins.length > 0"
          :data="plugins"
          stripe
          style="width: 100%; margin-top: 16px"
          empty-text="没有已启用的插件"
        >
          <el-table-column prop="name" label="插件名称" min-width="160" />
          <el-table-column label="状态" width="100">
            <template #default>
              <el-tag size="small" type="success">已加载</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="前端入口" min-width="200">
            <template #default="{ row }">
              <span v-if="row.frontendPath" class="frontend-path">{{ row.frontendPath }}</span>
              <el-tag v-else size="small" type="warning">无前端</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button size="small" @click="testPlugin(row)">测试接口</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="没有已启用的插件" :image-size="120" />

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
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getPlugins, type PluginInfo } from '@/api/plugins'

const router = useRouter()
const plugins = ref<PluginInfo[]>([])

onMounted(async () => {
  try {
    plugins.value = await getPlugins()
  } catch {
    ElMessage.error('获取插件列表失败')
  }
})

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
  width: 680px;
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

.frontend-path {
  font-family: monospace;
  font-size: 12px;
  color: var(--app-text-dim);
  word-break: break-all;
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
