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

function waitForNodeLoaded(tree: InstanceType<typeof ElTree>, path: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const n = tree.getNode(path)
      if (n && !n.loading && n.loaded) {
        resolve()
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

  // 优先通过高亮类找到当前选中节点
  const treeEl = treeRef.value.$el as HTMLElement
  let nodeEl = treeEl.querySelector('.is-current .el-tree-node__content')
    || treeEl.querySelector(`[data-key="${CSS.escape(path)}"]`)
  const parts = path.split('/')
  while (nodeEl?.textContent !== parts[parts.length - 1]) {
    await new Promise(resolve => setTimeout(resolve, 50))
    nodeEl = treeEl.querySelector('.is-current .el-tree-node__content')
    || treeEl.querySelector(`[data-key="${CSS.escape(path)}"]`)
  }
  if (!nodeEl) return

  const containerRect = container.getBoundingClientRect()
  const nodeRect = nodeEl.getBoundingClientRect()
  const offset = nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2
  let count = 0
  while (Math.abs(container.scrollTop - offset) > 50 || count > 10) {
    count++
    if (offset < 0) {
      break
    }
    container.scrollTop = offset
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
}

async function expandTreeNode() {
  const targetPath = props.modelValue
  if (!targetPath || !treeRef.value) return

  // 重置所有已加载节点的状态
  const store = treeRef.value.store
  Object.values(store.nodesMap).forEach((node: { expanded: boolean; loaded: boolean; childNodes: unknown[] }) => {
    node.expanded = false
    node.loaded = false
    node.childNodes = []
  })

  const parts = targetPath.split('/').filter(Boolean)
  let currentPath = ''

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const node = treeRef.value.getNode(currentPath)
    if (node && !node.expanded) {
      node.expand()
      await waitForNodeLoaded(treeRef.value, currentPath)
    }
    treeRef.value.setCurrentKey(currentPath, true)
  }

  scrollNodeToCenter(targetPath)
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
