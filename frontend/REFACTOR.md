# 前端代码重构记录

## 重构信息

- **日期**: 2026-03-24
- **目标**: 对前端 HomeView 页面进行模块化重构，提高代码可读性和可维护性

***

## 重构概述

将原本 230+ 行的 `HomeView.vue` 拆分为多个职责单一的模块，采用 Vue 3 Composition API 的最佳实践。

### 重构前后对比

| 文件            | 重构前   | 重构后           |
| ------------- | ----- | ------------- |
| HomeView\.vue | 230 行 | 210 行 (精简 9%) |
| FileTable.vue | 110 行 | 95 行 (精简 14%) |
| Dialogs.vue   | 154 行 | 已删除 (拆分为独立组件) |

***

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

***

## 模块职责

| 模块                               | 职责                | 行数          |
| -------------------------------- | ----------------- | ----------- |
| `HomeView.vue`                   | 页面布局和路由协调         | \~210 行     |
| `composables/useFileProgress.ts` | 文件移动/压缩进度管理 (SSE) | \~200 行     |
| `utils/format.ts`                | 格式化工具函数           | \~50 行      |
| `components/dialogs/*.vue`       | 独立对话框组件           | \~40-50 行/个 |
| `components/FileTable.vue`       | 文件列表展示            | \~95 行      |

***

## 重构优势

1. **职责分离**: 页面组件只负责协调，业务逻辑移至 composables
2. **代码复用**: 格式化工具函数可在多个组件间复用
3. **易于测试**: composables 可独立进行单元测试
4. **易于维护**: 每个组件职责单一，代码阅读更清晰
5. **更好的类型安全**: 所有状态和事件都有明确的类型定义

***

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

***

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

***

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

***

## 重构原则

1. **单一职责**: 每个组件只负责一个功能领域
2. **组合优于继承**: 使用 composables 复用逻辑
3. **工具函数纯净化**: 无副作用，易于测试
4. **类型安全**: 所有 props 和 emits 都有明确类型定义
5. **响应式数据**: 使用 `reactive` 管理复杂状态

***

## 注意事项

1. **SSE 连接管理**: 在组件卸载或操作完成时正确关闭 EventSource
2. **状态重置**: 对话框关闭时重置所有状态
3. **错误处理**: 统一的错误提示机制 (ElMessage)
4. **类型导出**: 确保所有接口和类型正确导出

***

## 下一阶段重构计划 (2026-05-26)

> 基于架构审查报告，按优先级排列的改进计划。

***

### 🔴 高优先级

#### 1. `HomeView.vue` 职责拆分

**问题**: [HomeView.vue](file:///home/lzh/code/vue/file-manager/frontend/src/views/HomeView.vue) 315 行，混杂了排序、右键菜单、批量操作、对话框管理等多种职责。

**方案**: 将独立逻辑抽出为 composables：

| 抽出内容                                                          | 目标 composable                   | 行数估算   |
| ------------------------------------------------------------- | ------------------------------- | ------ |
| 排序逻辑 (sortBy, sortOrder, sortFiles, handleSortChange)         | `composables/useFileSort.ts`    | \~40 行 |
| 右键菜单 (contextMenuVisible, onRowContextmenu, closeContextMenu) | `composables/useContextMenu.ts` | \~30 行 |
| 批量下载/压缩 (handleBatchDownload, handleBatchZip)                 | 合并到 `useBatchOperations.ts`     | \~20 行 |

**目标**: `HomeView.vue` 缩减到 \~150 行，只负责组合调用和模板协调。

**新建文件**: `composables/useFileSort.ts`, `composables/useContextMenu.ts`
**改动文件**: [HomeView.vue](file:///home/lzh/code/vue/file-manager/frontend/src/views/HomeView.vue)

```typescript
// composables/useFileSort.ts 示例
export function useFileSort(fileStore: ReturnType<typeof useFileStore>) {
  const sortBy = ref<'name' | 'type' | 'modified' | 'size'>('type')
  const sortOrder = ref<'asc' | 'desc'>('asc')
  
  const sortFiles = () => { /* ... */ }
  const handleSortChange = (val: any) => { /* ... */ }
  const toggleSortOrder = () => { /* ... */ }
  
  return { sortBy, sortOrder, sortFiles, handleSortChange, toggleSortOrder }
}
```

***

#### 2. `fileStore` 清理冗余字段

**问题**: [stores/file.ts](file:///home/lzh/code/vue/file-manager/frontend/src/stores/file.ts) 中 `selectedFiles` 和 `setSelectedFiles` 从未被任何组件使用。实际选中状态在 `HomeView.vue` 的局部 ref 中管理。

**方案**: 二选一：

| 方案 A | 删除 store 中的 `selectedFiles`、`setSelectedFiles`，选中状态保持组件本地 |
| :--- | :-------------------------------------------------------- |
| 方案 B | 将 HomeView 的 `selectedFiles` 移入 store，统一由 store 管理选中态     |

推荐 **方案 B**，因为批量操作依赖 `selectedFiles` 的地方不止一个（HomeView 传给 Toolbar 的 props 都基于它），移入 store 后无需 prop drilling。

**目标文件**: [stores/file.ts](file:///home/lzh/code/vue/file-manager/frontend/src/stores/file.ts), [HomeView.vue](file:///home/lzh/code/vue/file-manager/frontend/src/views/HomeView.vue), [Toolbar.vue](file:///home/lzh/code/vue/file-manager/frontend/src/components/Toolbar.vue)

***

### 🟡 中优先级

#### 3. `useFileProgress` 业务逻辑分离

**问题**: [useFileProgress.ts](file:///home/lzh/code/vue/file-manager/frontend/src/composables/useFileProgress.ts) 混合了两种不同层级的职责：

| 职责        | 属性                                                                      |
| --------- | ----------------------------------------------------------------------- |
| **状态管理**  | `moveState`, `zipState`, `hideMoveDialog`, `showMoveDialog`             |
| **业务调用**  | `moveOneFile`(EventSource), `moveFiles`(顺序移动), `zipFolder`, `cancelZip` |
| **UI 反馈** | `ElMessage.error`, `ElMessage.success`                                  |

**方案**: 将 EventSource 的创建/关闭/事件解析逻辑抽到 API 层，composable 只保留响应式状态和面向组件的接口。

```typescript
// api/file.ts 新增
export function moveFileSSE(fromPath: string, toPath: string, onProgress: (p: number, s: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/files/move?...`)
    es.onmessage = (e) => { /* 解析并回调 onProgress */ }
    es.onerror = () => { /* reject */ }
  })
}

// composables/useFileProgress.ts 变为纯状态管理
export function useFileProgress() {
  const moveState = reactive<MoveProgressState>({...})
  const zipState = reactive<ZipProgressState>({...})
  
  async function moveFiles(onComplete?: () => void) {
    // 调用 api 层，只更新 moveState
  }
  
  return { moveState, zipState, moveFiles, ... }
}
```

**目标文件**: [useFileProgress.ts](file:///home/lzh/code/vue/file-manager/frontend/src/composables/useFileProgress.ts), [api/file.ts](file:///home/lzh/code/vue/file-manager/frontend/src/api/file.ts)

***

#### 4. 常量集中管理

**问题**: 以下字符串在多个文件中硬编码：

| 常量                     | 出现位置                                        | 建议定义位置               |
| ---------------------- | ------------------------------------------- | -------------------- |
| `'session_token'`      | 3 处 (auth store + api interceptor + logout) | `constants/index.ts` |
| `'file-manager-theme'` | 1 处 (useTheme)                              | `constants/index.ts` |
| `'/api'`               | 1 处 (api/index.ts)                          | `constants/index.ts` |

**方案**: 新建 `constants/index.ts`，集中导出所有常量。

**新建文件**: `constants/index.ts`
**改动文件**: [stores/auth.ts](file:///home/lzh/code/vue/file-manager/frontend/src/stores/auth.ts), [api/index.ts](file:///home/lzh/code/vue/file-manager/frontend/src/api/index.ts), [composables/useTheme.ts](file:///home/lzh/code/vue/file-manager/frontend/src/composables/useTheme.ts)

***

#### 5. 类型去重

**问题**: `FileItem` 类型在两处定义：`api/file.ts#L2` 和 `types/index.ts#L1`，内容完全相同。

**方案**: 删除 `api/file.ts` 中的重复定义，统一从 `types/index.ts` 导入。

**目标文件**: [api/file.ts](file:///home/lzh/code/vue/file-manager/frontend/src/api/file.ts)

***

### 🟢 低优先级

#### 6. `Toolbar.vue` emits 简化

**问题**: [Toolbar.vue](file:///home/lzh/code/vue/file-manager/frontend/src/components/Toolbar.vue) 暴露了 10+ 个 `$emit`，父子组件 prop/event 映射链过长。

**方案**: 考虑以下替代方案之一：

| 方案                 | 适用场景                |
| ------------------ | ------------------- |
| **provide/inject** | 跨层级传递操作函数，避免逐层 emit |
| **事件总线 (mitt)**    | 解耦组件通信              |

当前项目层级不深（HomeView → Toolbar 只有一层），暂不紧急。

***

#### 7. 空 catch 块日志保留

**问题**: [stores/auth.ts#L56](file:///home/lzh/code/vue/file-manager/frontend/src/stores/auth.ts#L56) — `try { await apiLogout() } catch { /* ignore */ }` 丢失调试信息。

**方案**: 使用 `console.debug` 记录，开发环境可见但不干扰用户。

```typescript
try { await apiLogout() } catch (e) {
  console.debug('登出请求失败（已忽略）:', e)
}
```

**目标文件**: [stores/auth.ts](file:///home/lzh/code/vue/file-manager/frontend/src/stores/auth.ts)
