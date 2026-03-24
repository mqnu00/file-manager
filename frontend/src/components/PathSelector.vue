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
      width="400px"
      :close-on-click-modal="true"
    >
      <div class="tree-container">
        <el-tree
          ref="treeRef"
          :data="treeData"
          :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
          :load="loadNode"
          lazy
          highlight-current
          :expand-on-click-node="false"
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
import { ref, watch, onMounted } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import { getFolders } from '@/api/file'
import type { ElTree } from 'element-plus'

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
const treeData = ref<TreeNode[]>([])
const selectedPath = ref('')

/**
 * 懒加载节点
 */
const loadNode = async (node: any, resolve: (data: TreeNode[]) => void) => {
  try {
    const parentPath = node.data?.path || ''
    const folders = await getFolders(parentPath)
    const filteredFolders = folders.filter((f: any) => f.path !== props.excludePath)

    const children = filteredFolders.map((f: any) => ({
      label: f.name,
      path: f.path,
      disabled: false
    }))

    resolve(children)
  } catch (e) {
    resolve([])
  }
}

/**
 * 加载根节点
 */
const loadRootNodes = async () => {
  try {
    const folders = await getFolders('')
    const filteredFolders = folders.filter((f: any) => f.path !== props.excludePath)

    treeData.value = filteredFolders.map((f: any) => ({
      label: f.name,
      path: f.path,
      disabled: false
    }))
  } catch (e) {
    treeData.value = []
  }
}

/**
 * 处理节点点击
 */
const handleNodeClick = (data: TreeNode) => {
  selectedPath.value = data.path
}

/**
 * 确认选择
 */
const confirmSelection = () => {
  if (selectedPath.value) {
    emit('update:modelValue', selectedPath.value)
  }
  showTreeDialog.value = false
}

// 监听 excludePath 变化
watch(() => props.excludePath, () => {
  loadRootNodes()
})

// 监听对话框显示状态
watch(() => showTreeDialog.value, (newVal) => {
  if (newVal) {
    loadRootNodes()
    if (props.modelValue) {
      selectedPath.value = props.modelValue
    }
  }
})

onMounted(() => {
  loadRootNodes()
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
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-input__inner) {
  cursor: pointer;
}
</style>
