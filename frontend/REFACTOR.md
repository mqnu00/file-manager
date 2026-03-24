# 前端代码重构记录

## 重构信息

- **日期**: 2026-03-24
- **目标**: 对前端 HomeView 页面进行模块化重构，提高代码可读性和可维护性

---

## 重构概述

将原本 230+ 行的 `HomeView.vue` 拆分为多个职责单一的模块，采用 Vue 3 Composition API 的最佳实践。

### 重构前后对比

| 文件 | 重构前 | 重构后 |
|------|--------|--------|
| HomeView.vue | 230 行 | 210 行 (精简 9%) |
| FileTable.vue | 110 行 | 95 行 (精简 14%) |
| Dialogs.vue | 154 行 | 已删除 (拆分为独立组件) |

---

## 新的文件结构

```
frontend/src/
├── views/
│   └── HomeView.vue              # 主页面 (精简版)
├── components/
│   ├── dialogs/
│   │   ├── CreateFolderDialog.vue    # 新建文件夹对话框
│   │   ├── MoveFileDialog.vue        # 移动文件对话框
│   │   └── ZipProgressDialog.vue     # 压缩进度对话框
│   ├── FileTable.vue             # 文件表格组件
│   ├── Toolbar.vue               # 工具栏组件
│   ├── PathSelector.vue          # 路径选择器
│   └── ContextMenu.vue           # 右键菜单
├── composables/
│   └── useFileProgress.ts        # 文件操作进度管理
├── utils/
│   └── format.ts                 # 格式化工具函数
├── api/
│   └── file.ts                   # API 调用
├── stores/
│   └── file.ts                   # Pinia 状态管理
└── types/
    └── index.ts                  # 类型定义
```

---

## 模块职责

| 模块 | 职责 | 行数 |
|------|------|------|
| `HomeView.vue` | 页面布局和路由协调 | ~210 行 |
| `composables/useFileProgress.ts` | 文件移动/压缩进度管理 (SSE) | ~200 行 |
| `utils/format.ts` | 格式化工具函数 | ~50 行 |
| `components/dialogs/*.vue` | 独立对话框组件 | ~40-50 行/个 |
| `components/FileTable.vue` | 文件列表展示 | ~95 行 |

---

## 重构优势

1. **职责分离**: 页面组件只负责协调，业务逻辑移至 composables
2. **代码复用**: 格式化工具函数可在多个组件间复用
3. **易于测试**: composables 可独立进行单元测试
4. **易于维护**: 每个组件职责单一，代码阅读更清晰
5. **更好的类型安全**: 所有状态和事件都有明确的类型定义

---

## Composables 设计

### useFileProgress

文件移动和压缩进度管理的可组合函数。

```typescript
// composables/useFileProgress.ts
export interface MoveProgressState {
  visible: boolean
  sourcePath: string
  sourceName: string
  targetPath: string
  loading: boolean
  progress: number
  status: 'success' | 'exception' | ''
  speed: number
}

export interface ZipProgressState {
  visible: boolean
  folderPath: string
  progress: number
  status: 'success' | 'exception' | ''
  error: string
}

export const useFileProgress = () => {
  const moveState = reactive<MoveProgressState>(...)
  const zipState = reactive<ZipProgressState>(...)
  
  const showMoveDialog = (path: string, name: string) => {...}
  const moveFile = (onComplete?: () => void) => {...}
  const zipFolder = (path: string, onRefresh?: () => void) => {...}
  const cancelZip = async (onSuccess?: () => void) => {...}
  
  return { moveState, zipState, showMoveDialog, moveFile, zipFolder, cancelZip }
}
```

### 使用示例

```vue
<script setup lang="ts">
import { useFileProgress } from '@/composables/useFileProgress'

const progress = useFileProgress()

// 显示移动对话框
progress.showMoveDialog(path, name)

// 执行移动
progress.moveFile(() => refresh())

// 压缩文件夹
progress.zipFolder(path, () => refresh())
</script>
```

---

## 工具函数

### format.ts

```typescript
// utils/format.ts
export const formatSize = (size: number): string
export const formatTime = (time: string): string
export const formatSpeed = (speed: number): string
export const formatProgress = (percent: number, speed: number): string
```

### 使用示例

```vue
<script setup lang="ts">
import { formatSize, formatTime } from '@/utils/format'
</script>

<template>
  <div>{{ formatSize(row.size) }}</div>
  <div>{{ formatTime(row.modified) }}</div>
</template>
```

---

## 对话框组件

### CreateFolderDialog

新建文件夹对话框，简单的输入框 + 确认/取消按钮。

```vue
<CreateFolderDialog
  :model-value="createFolderVisible"
  :folder-name="newFolderName"
  @update:model-value="createFolderVisible = $event"
  @update:folder-name="newFolderName = $event"
  @confirm="createFolder"
/>
```

### MoveFileDialog

移动文件对话框，包含进度显示和路径选择器。

```vue
<MoveFileDialog
  :model-value="progress.moveState.visible"
  :source-path="progress.moveState.sourcePath"
  :source-name="progress.moveState.sourceName"
  :target-path="progress.moveState.targetPath"
  :loading="progress.moveState.loading"
  :progress="progress.moveState.progress"
  :status="progress.moveState.status"
  :speed="progress.moveState.speed"
  @update:model-value="progress.moveState.visible = $event"
  @update:target-path="progress.moveState.targetPath = $event"
  @confirm="() => progress.moveFile(refresh)"
/>
```

### ZipProgressDialog

压缩进度对话框，显示压缩进度和状态。

```vue
<ZipProgressDialog
  :model-value="progress.zipState.visible"
  :progress="progress.zipState.progress"
  :status="progress.zipState.status"
  :folder-path="progress.zipState.folderPath"
  :error="progress.zipState.error"
  @update:model-value="progress.zipState.visible = $event"
  @cancel="() => progress.cancelZip()"
/>
```

---

## 重构原则

1. **单一职责**: 每个组件只负责一个功能领域
2. **组合优于继承**: 使用 composables 复用逻辑
3. **工具函数纯净化**: 无副作用，易于测试
4. **类型安全**: 所有 props 和 emits 都有明确类型定义
5. **响应式数据**: 使用 `reactive` 管理复杂状态

---

## 注意事项

1. **SSE 连接管理**: 在组件卸载或操作完成时正确关闭 EventSource
2. **状态重置**: 对话框关闭时重置所有状态
3. **错误处理**: 统一的错误提示机制 (ElMessage)
4. **类型导出**: 确保所有接口和类型正确导出
