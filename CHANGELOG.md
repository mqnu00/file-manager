# 变更日志

## v2.3.0 (2026-05-26)

### ✨ 新增功能

#### 认证系统
- 新增令牌登录页面，首次访问需输入配置的访问令牌
- 基于内存 Session 的认证机制，支持登录有效期控制
- 令牌修改后所有已登录会话立即失效，需重新登录
- 路由守卫拦截未认证请求，自动跳转登录页
- 所有 API 请求自动注入 `Authorization: Bearer` 头部

#### 系统配置
- 新增配置页面（`/config`），支持在线修改系统配置
- **访问令牌**：修改后所有会话立即失效
- **登录有效期**：1~720 小时可配置，新登录生效
- **文件存储根目录**：支持自定义文件操作范围，修改后实时生效

#### 后端配置系统
- 新增 `config.yml` YAML 配置文件，统一管理系统参数
- 配置文件热加载：`fs.watchFile` 监听文件变更，1 秒内自动生效无需重启
- 配置读写 API + 脱敏输出（令牌仅显示首尾 2 位）

#### GitHub Actions 自动发布
- 新增 `.github/workflows/release.yml`
- push master 时自动读取 `package.json` 版本号创建 Git Tag
- 从 CHANGELOG.md 提取对应版本段落作为 Release 描述
- 构建并打包 `file-manager.tar.gz` 附加到 Release
- 已存在的 Tag 自动跳过，防止重复发布

### 🔄 改进

#### storageRoot 接入实际文件逻辑
- `safePath.ts` 从静态 `BASE_DIR` 改为动态读取 `config.yml` 配置
- 配置页修改存储根目录后所有文件操作立即受限，无需重启

#### 配置页返回按钮
- 配置页新增返回按钮，方便回到文件列表主页

### 🐳 Docker 支持

- 新增 `Dockerfile`：基于 `node:22-alpine3.20`，通过 tar.gz 分发包部署，暴露 10000 / 3000 端口
- 新增 `docker.sh`：预配置的运行脚本，含宿主机目录挂载、UID 映射和端口映射
- 新增 `.dockerignore`：排除 `node_modules`、`config.yml`、构建产物等

### 🔧 工程修复

- 新增 `env.d.ts`，修复 `.vue` 模块 TypeScript 类型声明缺失导致的 lint 报错
- `tsconfig.json` 添加 `jsxImportSource: "vue"`，修复 Vue 模板中 JSX 元素类型报错
- 修复 `config.yml` 路径：`../../config.yml` 更正为 `../config.yml`

### 🐛 Bug 修复

#### 损坏的符号链接导致列表加载失败
- `GET /api/files` 遇到目标不存在的符号链接时不再抛出 `ENOENT` 错误
- 改用 `lstat` + `stat` 双检测：`stat` 失败时回退到 `lstat` 的元数据，标记 `broken: true` 正常返回
- `calculateDirSize` 同样跳过损坏的符号链接，避免压缩功能中断
- 前端损坏文件显示为红色「符号链接，目标不存在」标签，禁止勾选和点击进入

### 🔧 代码重构

基于架构审查报告，对前后端进行全面重构。

#### 后端
- `GET /*` 重命名为 `GET /download/*`，添加醒目警示注释防止路由顺序隐患
- 新增 `middleware/asyncHandler.ts`：包装器消除路由 handler 重复的 `try/catch` 模式
- 新增 `middleware/errorHandler.ts`：统一错误处理中间件，集中日志输出和 500 响应
- `routes/files.ts` 和 `routes/folders.ts` 非 SSE 路由全部改用 `asyncHandler`，减少 ~40 行样板代码
- `app.ts` 注册统一错误处理中间件

#### 前端
- `HomeView.vue` 排序逻辑抽出为 `composables/useFileSort.ts`（-50 行）
- `HomeView.vue` 右键菜单逻辑抽出为 `composables/useContextMenu.ts`（-20 行）
- `fileStore` 选中态从局部 ref 移入 store，新增 `selectedFileInfos` / `isSingleFileSelected` / `isSingleFolderSelected` 计算属性
- 去重 `FileItem` 类型定义，统一从 `types/index.ts` 导入
- 新建 `constants/index.ts` 集中管理 `session_token` / `file-manager-theme` 等魔法字符串
- `composables/useFileProgress.ts` 中 EventSource 创建/解析逻辑移至 `api/file.ts`（新增 `moveFileAsync` / `zipFolderAsync`），composable 只保留状态管理
- `auth.ts` store 空 catch 块改为 `console.debug` 保留调试信息

### 📊 统计

| 模块 | 新增文件 | 改动文件 | 新增接口 |
|------|---------|---------|---------|
| 后端 | 5 | 4 | 4 |
| 前端 | 7 | 3 | — |
| CI/CD | 1 | — | — |

---

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
- **修复移动对话框文件夹选择器被裁剪**：PathSelector 内嵌对话框改为 `append-to-body`，`top="5vh"` 置顶打开；移动对话框 body 添加 `max-height: 70vh` 可滚动

### 🎨 科幻主题改造

#### Three.js 动态背景
- 新增 `SciFiBackground.vue` 组件，引入 Three.js 渲染全屏动态背景
- **星空**：1200 颗四色粒子（青/品红/蓝/白）缓慢旋转漂移
- **极坐标网格**：青色半透明网格持续旋转
- **浮动光球**：5 个发光球体正弦波浮动
- **光束**：3 条旋转细光束脉动
- 相机视角对准文件列表区域

#### 赛博朋克全局主题
- App.vue 定义 CSS 变量（`--cyber-cyan`、`--cyber-panel` 等暗色配色）
- 覆盖 Element Plus 全部组件样式：Dialog / Button / Input / Message / MessageBox / Progress / Tree / Select / Scrollbar
- 所有面板采用毛玻璃效果（`backdrop-filter: blur`），低不透明度让 3D 背景透出
- 文字色提升亮度保证可读性

#### 组件风格统一
- Toolbar / FileTable / 所有 Dialog / ContextMenu / PathSelector 统一采用赛博朋克暗色主题
- 主色调青 `#00f0ff`，辅色调品红 `#ff00ff`，面板背景 `rgba(10,18,40,0.35)`
- 复选框、按钮、选中态、悬停态均改为青色发光风格

#### 主题切换
- 新增 `useTheme.ts` 组合函数，实现一键切换赛博/亮色双主题
- 基于 CSS 自定义属性方案：`:root` 定义亮色默认值，`html.cyber` 覆盖为赛博值
- 工具栏新增主题切换按钮（Moon/Sunny 图标），当前模式标签动态显示
- SciFiBackground 随主题切换自动显隐（亮色主题下隐藏 Three.js 背景）
- 主题偏好持久化到 `localStorage`，刷新保持选择，首次默认赛博主题
- 全部组件样式由硬编码 `--cyber-*` 迁移为双主题 `--app-*` CSS 变量，自动适配

### 📊 统计

| 模块 | 新增接口 | 改动文件 |
|------|---------|---------|
| 后端 | 1 (batch-delete) | 3 文件 |
| 前端 | — | 10 文件 |
| 文档 | — | API.md, CHANGELOG.md |

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
