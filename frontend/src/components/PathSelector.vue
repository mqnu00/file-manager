<template>
  <div class="path-selector">
    <el-input
      :model-value="modelValue"
      readonly
      :placeholder="placeholder"
      :disabled="disabled"
      @click="showTreeDialog = true"
    >
      <template #prefix>
        <el-icon><Folder /></el-icon>
      </template>
    </el-input>

    <el-dialog
      v-model="showTreeDialog"
      title="选择目标文件夹"
      width="420px"
      top="5vh"
      :close-on-click-modal="true"
      :append-to-body="true"
      @opened="expandTreeNode"
    >
      <div class="tree-container">
        <el-tree
          ref="treeRef"
          node-key="path"
          :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
          :load="loadNode"
          lazy
          highlight-current
          :expand-on-click-node="true"
          @node-click="handleNodeClick"
        >
          <template #default="{ node }">
            <span class="tree-node">
              <el-icon><Folder /></el-icon>
              <span>{{ node.label }}</span>
            </span>
          </template>
        </el-tree>
      </div>
      <template #footer>
        <el-button @click="showTreeDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSelection">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import { getFolders } from '@/api/file'
import type { ElTree } from 'element-plus'
import type { FileItem } from '@/types'

interface TreeNode {
  label: string
  path: string
  children?: TreeNode[]
  disabled?: boolean
}

const props = defineProps<{
  modelValue: string
  excludePath?: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showTreeDialog = ref(false)
const treeRef = ref<InstanceType<typeof ElTree>>()
const selectedPath = ref('')

interface LoadNode {
  data?: { path?: string }
}

const loadNode = async (node: LoadNode, resolve: (data: TreeNode[]) => void) => {
  try {
    const parentPath = node.data?.path || ''
    const folders = await getFolders(parentPath)
    const children = folders
      .filter((f: FileItem) => {
        if (!props.excludePath) return true
        // 排除源路径自身及其所有子目录
        return f.path !== props.excludePath && !f.path.startsWith(props.excludePath + '/')
      })
      .map((f: FileItem) => ({ label: f.name, path: f.path }))
    resolve(children)
  } catch {
    resolve([])
  }
}

// 等待节点被注册到树中（父层加载完成后才会注册子节点）
function waitForNodePresent(tree: InstanceType<typeof ElTree>, path: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout
    const check = () => {
      if (tree.getNode(path)) {
        resolve(true)
      } else if (Date.now() > deadline) {
        resolve(false)
      } else {
        setTimeout(check, 50)
      }
    }
    nextTick(check)
  })
}

// 等待节点完成懒加载（expand 后 loaded 置为 true）
function waitForNodeLoaded(tree: InstanceType<typeof ElTree>, path: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout
    const check = () => {
      const n = tree.getNode(path)
      if (n && !n.loading && n.loaded) {
        resolve(true)
      } else if (Date.now() > deadline) {
        resolve(false)
      } else {
        setTimeout(check, 50)
      }
    }
    nextTick(check)
  })
}

const handleNodeClick = (data: TreeNode) => {
  selectedPath.value = data.path
}

const confirmSelection = () => {
  if (selectedPath.value) {
    emit('update:modelValue', selectedPath.value)
  }
  showTreeDialog.value = false
}

async function scrollNodeToCenter(path: string) {
  const container = document.querySelector('.tree-container')
  if (!container || !treeRef.value) return

  // 规范化路径，与 node-key 的相对路径格式（无前导斜杠）保持一致
  const normalized = path.split('/').filter(Boolean).join('/')
  if (!normalized) return

  const treeEl = treeRef.value.$el as HTMLElement
  const deadline = Date.now() + 3000

  // 等待目标节点渲染（最多 3 秒，避免找不到节点时死循环）
  let nodeEl: HTMLElement | null = null
  while (Date.now() < deadline) {
    nodeEl = treeEl.querySelector(`[data-key="${CSS.escape(normalized)}"]`) as HTMLElement | null
    if (nodeEl) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!nodeEl) return

  const containerRect = container.getBoundingClientRect()
  const nodeRect = nodeEl.getBoundingClientRect()
  const offset = nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2
  container.scrollTop = Math.max(0, container.scrollTop + offset)
}

async function expandTreeNode() {
  const targetPath = props.modelValue
  if (!targetPath || !treeRef.value) return

  const tree = treeRef.value

  // 根目录：树默认从根展示，滚动到顶部即可，无需逐级展开
  if (targetPath === '/') {
    const container = document.querySelector('.tree-container')
    if (container) container.scrollTop = 0
    return
  }

  const parts = targetPath.split('/').filter(Boolean)
  let currentPath = ''

  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]

    // 等待当前层节点注册（父层懒加载完成后才会注册子节点）
    const present = await waitForNodePresent(tree, currentPath)
    if (!present) break

    const node = tree.getNode(currentPath)
    // 中间层级需要展开以加载下一层；最后一级只定位不展开
    const isLast = i === parts.length - 1
    if (node && !node.expanded && !isLast) {
      node.expand()
      await waitForNodeLoaded(tree, currentPath)
    }
    tree.setCurrentKey(currentPath, true)
  }

  scrollNodeToCenter(currentPath)
}

onMounted(() => {
  if (props.modelValue) {
    selectedPath.value = props.modelValue
  }
})
</script>

<style scoped>
.path-selector {
  width: 100%;
}

.tree-container {
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 8px;
  background: var(--app-accent-bg);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text);
}

:deep(.el-input__inner) {
  cursor: pointer;
}
</style>
