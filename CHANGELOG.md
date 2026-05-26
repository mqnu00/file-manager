# 变更日志

## v2.2.0 (2026-05-26)

### ✨ 新增功能

#### 批量操作
- 文件表格新增多选功能，支持批量选择文件/文件夹
- 中间栏新增批量操作栏，选中文件时显示操作按钮
- 新增 **批量删除**：选中多个文件后一次性删除，显示成功/失败统计
- 新增 **批量移动**：选中多个文件后逐一移动到目标目录，SSE 实时反馈总进度
- 新增 **下载**按钮（仅选中单个文件时可用）
- 新增 **压缩**按钮（仅选中单个文件夹时可用）

#### 后端新增接口
- 新增 `POST /api/files/batch-delete` 批量删除接口

### 🔄 交互重构

#### 操作入口从行内移至中间栏
- FileTable.vue 移除行内操作列（压缩/移动/删除/下载按钮）
- 所有文件操作统一通过中间栏批量操作栏触发
- 删除/移动支持多选和单选；下载/压缩仅支持单选

#### 组件增强
- Toolbar.vue 新增批量操作栏，根据选中类型动态显示按钮
- MoveFileDialog.vue 新增批量模式支持，显示"已选择 N 个文件/文件夹"
- useFileProgress.ts 新增 `showBatchMoveDialog()` 和 `moveFiles()` 批量移动方法

### 🐛 Bug 修复

- **修复文件移动数据丢失风险**：将源文件删除从 `readStream.on('end')` 移至 `writeStream.on('finish')`，确保目标文件写入完成后再删除源文件，避免数据不完整

### 📊 统计

| 模块 | 新增接口 | 改动文件 |
|------|---------|---------|
| 后端 | 1 (batch-delete) | 3 文件 |
| 前端 | — | 6 文件 |
| 文档 | — | API.md |

---

## v2.1.0 (2026-03-24)

### ✨ 新增功能

#### 文件/文件夹移动改进
- 新增 `PathSelector` 组件，使用树形选择器代替手动输入路径
- 移动对话框支持多级文件夹选择，点击展开子目录
- 移动操作显示实时进度、传输速度和预计剩余时间
- 使用 SSE 流式传输实时反馈移动进度

#### 文件排序功能增强
- 新增大小排序选项
- 默认排序改为按类型排序（文件夹在前）
- 排序逻辑优化：先文件夹后文件 > 按指定字段 > 按名称
- 排序方向图标整合到选择框内，界面更简洁

#### 时间显示优化
- 文件修改时间从 ISO 格式改为 `YYYY-MM-DD HH:MM:SS` 格式
- 更易读的日期时间显示

### 🐛 Bug 修复

- 修复开发模式启动失败问题（使用 npm run dev 启动后端）
- 修复跨设备移动文件失败问题（EXDEV 错误）
- 修复路径处理问题，支持绝对路径和相对路径
- 修复后端路由顺序，确保 `/move` 路由在通配符之前

### 🔄 代码重构

#### 后端模块化重构
- 新增 `types.ts` 全局类型定义
- 新增 `utils/safePath.ts` 路径安全工具
- 新增 `utils/sse.ts` SSE 工具函数
- 新增 `services/fileService.ts` 业务逻辑层
- `files.ts`: 280 行 → 147 行 (精简 47%)
- `folders.ts`: 60 行 → 25 行 (精简 58%)

#### 前端模块化重构
- 新增 `composables/useFileProgress.ts` 进度管理
- 新增 `utils/format.ts` 格式化工具
- 拆分 `Dialogs.vue` 为三个独立对话框组件
- `HomeView.vue`: 230 行 → 210 行
- `FileTable.vue`: 110 行 → 95 行

### 📊 统计

| 模块 | 新增文件 | 删除文件 | 代码变化 |
|------|---------|---------|---------|
| 后端 | 4 | 0 | +597, -729 |
| 前端 | 6 | 1 | +759, -373 |
| **总计** | **10** | **1** | **+1356, -1102** |

### ✅ 兼容性说明

- API 接口保持不变
- 功能完全兼容 v2.0.0
- 无需修改任何使用代码

---

## v2.0.0 (2026-03-20)

详细更改见 https://github.com/mqnu00/file-manager/blob/v2.0.0/backend/REFACTOR.md

### 重大更新

#### 后端 TypeScript 重构
- 🔄 将后端从 JavaScript 迁移到 TypeScript
- 📦 添加完整的类型定义（FileInfo, SSEProgressMessage, ArchiveLocals 等）
- 🔧 使用严格模式确保类型安全
- 📝 添加 REFACTOR.md 详细记录重构过程

#### 技术栈更新
**后端新增开发依赖**:
- `typescript` ^5.9.3
- `ts-node` ^10.9.2
- `@types/node` ^25.5.0
- `@types/express` ^5.0.6
- `@types/cors` ^2.8.19
- `@types/multer` ^2.1.0
- `@types/archiver` ^7.0.0
- `@types/mime-types` ^3.0.1

#### 构建流程改进
- 🏗️ 前端构建输出到 `backend/dist`
- 🏗️ 后端 TypeScript 编译输出到 `backend/dist`
- 📦 前后端统一输出到同一目录，简化部署

#### 脚本更新
```json
{
  "dev": "ts-node src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js"
}
```

#### 文件变更
- `backend/src/app.js` → `backend/src/app.ts`
- `backend/src/routes/files.js` → `backend/src/routes/files.ts`
- `backend/src/routes/folders.js` → `backend/src/routes/folders.ts`
- 新增 `backend/tsconfig.json`
- 新增 `backend/REFACTOR.md`

### 兼容性说明
- ✅ API 接口保持不变
- ✅ 功能完全兼容 v1.0.0
- ⚠️ 生产环境运行命令改为 `node dist/app.js`

---

## v1.0.0 (2026-03-19)

### 第一版目标

- [x] 文件目录查看
- [x] 创建文件夹
- [x] 移动文件
- [x] 压缩文件夹 (zip)
- [x] 面包屑导航（支持点击跳转任意层级）
- [x] 压缩进度显示和取消功能
- [x] 文件排序（名称/类型/修改时间，支持正序/倒序）
