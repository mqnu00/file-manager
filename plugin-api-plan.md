# 插件对主项目可能需要的 API 接口清单（v3.0.0 平台规划）

> 目的：为 v3.0.0 正式发布前的「平台 API 冻结」提供依据。
> 结构：A. 已提供能力全览（现状基线） → B. 缺口与需求分类（按插件诉求维度） → C. 接口草案（签名级） → D. 优先级与发布边界。
> 现状基线版本：v3.0.0（root/backend package.json 已对齐为 3.0.0 正式版，2026-08-31 发布）。

> **更新说明（2026-08-31）**：本清单的「现状基线」为 beta9 快照。其中 B1（push/replace）、B2（文件打开契约）、
> B7 前端 teardown、B8（注册表类型/兼容性校验）、C2/C8/C10 已由 8-25 ~ 8-31 的平台化提交落地
> （`ctx.router.push/replace`、`ctx.platform.fileOpen`、卸载无需刷新、查看器服务化架构、`minHostVersion`
> 双轴校验、`ctx.storage`/`ctx.pluginData`）；B3/B4/B6/B7 其余项与 C3-C7/C9 仍为 roadmap，随生态演进。

---

## A. 已提供能力全览（现状基线）

### A1. 后端 ctx（`@mqn00/file-manager/plugin`）

| 命名空间 | API | 说明 |
|---|---|---|
| 路由 | `ctx.app`（Express Router） | 插件路由挂载点：`ctx.app.use('/api/plugin/<name>', router)` |
| | `ctx.express.Router` | 子路由工厂（express 类型由主包 re-export，插件零依赖） |
| 中间件 | `ctx.middleware.auth` | Bearer 会话校验，敏感路由应挂载 |
| | `ctx.middleware.errorHandler` / `asyncHandler` / `session.{create,validate,destroy,clearAll,getTokenFromHeader}` | 通用中间件与会话管理 |
| 配置 | `ctx.config.{get,reload,update,updatePlugin,getSanitized,isDefaultToken}` | config.yml 读取/热更新（`updatePlugin` 只合并插件自己的键） |
| 共享服务 | `ctx.registerService(name, impl)` / `ctx.getService(name)` | 插件间服务共享，卸载自动清理，重名抛错 |
| 托管服务 | `ctx.manageService(name, spec)` / `startService` / `stopService` / `waitForService` / `isServiceRunning` | 可启停服务：config 持久化、重启自动恢复、拓扑依赖、canAutoStart 预检（smb 的 sudo 探测即用此） |
| 文件服务 | `ctx.services.file` | 文件列表/移动/大小计算等 |
| 文件 I/O | `ctx.services.fileIO` | 文本读/写、字节分页读/定位写、流令牌 + Range（查看器体系使用） |
| 任务系统 | `ctx.services.task.{createExternal, signal, updateProgress, finalize, get, getAll, cancel, subscribe, createMove}` | 插件后台任务：建条目不执行 + 取消信号 + 进度广播 + 终态收尾（compress 使用） |
| 终端 | `ctx.services.terminal.*` | node-pty 会话管理 |
| 工具 | `ctx.utils.logger.log` / `path.{safe,getStorageRoot,isVirtualFs,calculateDirSize}` / `sse.*` / `AppError` / `packageManager.detect` | 日志、安全路径、SSE 助手、错误类型、包管理器探测 |

### A2. 前端 ctx（`@mqn00/file-manager/plugin/frontend`）

| 命名空间 | API | 说明 |
|---|---|---|
| 渲染 | `ctx.Vue`（h/ref/defineComponent/…） | 插件零外部依赖，全部经 ctx 取 |
| UI 库 | `ctx.ElementPlus` | 完整命名空间 |
| 状态 | `ctx.stores.{auth,file,task}` | 认证/文件列表/任务 store |
| API | `ctx.api.instance` + `auth/file/fileIO/config/task/system` | axios 实例（已带认证拦截器）+ 平台 API 模块 |
| 组合式 | `ctx.composables.{useTheme,useContextMenu,useFileProgress,useFileSort}` | 主题/右键菜单/进度/排序 |
| 工具 | `ctx.utils.{formatSize,formatTime,formatSpeed,formatProgress}` | 格式化 |
| 常量 | `ctx.constants.*` | 存储键、主题常量、API_BASE_URL |
| 路由 | `ctx.router.{createRouter,createWebHistory,createWebHashHistory,addRoute,currentRoute}` | ⚠️ 缺 push/replace（见 B1） |

### A3. 平台注册表（window 全局，非 ctx）

| 全局键 | 类型 | 属主 | 说明 |
|---|---|---|---|
| `window.__fm_bulk_actions` | `BulkActionsApi` | **主项目**（platform） | 批量操作栏注册：`register({id,label,visible,run})`，幂等覆盖，`useBulkActions` 响应式读取（compress 使用） |
| `window.__fm_file_viewer_registry__` | `FileViewerRegistry` | file-viewer **核心插件**（plugin-owned） | 查看器模块注册：`register({id,label,extensions,editable,component})`，7 个子插件依赖 |
| `window.__fm_file_viewer_installed__` | teardown 函数 | file-viewer 核心插件 | 自管理幂等安装（热重载去重） |

### A4. 平台 HTTP API（插件经 `ctx.api.instance` 全部可用）

`/api/auth` · `/api/config` · `/api/files`（列表/创建/重命名/删除/移动/搜索/dirsize）· `/api/folders` · `/api/fileIO`（二进制读写+流令牌）· `/api/files/stream`（Range 流）· `/api/logs` · `/api/tasks` · `/api/system` · `/api/plugins`（管理+市场）· `/plugins-assets/<插件名>/...`（静态资源，含路径穿越防护）

### A5. 生命周期与清单

- 后端：启动加载 → 拓扑排序 → 运行时 load/unload/reload（API 触发）→ 本地插件 dist/ 热重载（500ms 防抖）→ 托管服务重启恢复
- 前端：**只有 load，无 unload/reload**（卸载后需手动刷新页面；见 B7）
- 清单：`fileManagerPlugin.{dependsOn, config(schema), frontendPage}`；插件安装时默认值自动补写 config.yml
- 查找策略 4 级（node_modules 精确 → 前缀 → scope 扫描 → plugins/ 本地）；npm 安装/搜索/版本切换/删除全有

---

## B. 缺口与需求分类（第三方插件可能需要的 API）

### B1. 导航与页面能力（P0）

| 需求 | 现状 | 影响 |
|---|---|---|
| `ctx.router.push/replace` | **无** | file-viewer 被迫用 `history.pushState + 合成 PopStateEvent` hack（`spaNavigate`），与 hash 路由模式（gh-pages demo）兼容性未验证 |
| 新标签页打开 / 站外跳转 | 无 | 插件页面间联动只能靠 window 全局状态或地址栏手工拼 URL |

### B2. 文件交互钩子（P0）

| 需求 | 现状 | 影响 |
|---|---|---|
| 文件单击/双击事件钩子 | **无**，需劫持 document click + 匹配主应用类名 `.file-name-text`/`.is-folder` | 主应用 DOM 重构即坏（file-viewer 源码注释自认）；平台应提供 `data-fm-*` 属性或事件钩子 |
| 「打开文件」平台 API | 无（各查看器自建路径约定 `/plugin/file-viewer/view?path=...&mode=...`） | 打开方式各自为政，无统一分发 |
| 文件操作生命周期事件（created/renamed/deleted/moved/uploaded） | 无 | 插件无法感知主应用操作结果（如网盘插件需同步改名），只能轮询 |

### B3. 界面扩展点（P1/P2）

| 需求 | 现状 | 说明 |
|---|---|---|
| 右键菜单项注册 | **无**（ContextMenu.vue 硬编码 3 项） | 与 bulk actions 对称：`visible`（文件/文件夹/空白处）+ `run` |
| 工具栏按钮（单文件操作） | 仅「批量操作栏」，无单文件操作栏 | 插件操作单文件时只能走右键或批量栏 |
| 文件类型图标 | **无** | 文件列表图标硬编码；插件无法注册扩展名 → 图标映射 |
| 自定义列表列 | **无** | 无法增列（如 SMB 共享状态、标签列） |
| 文件状态徽标/标记 | 无 | 在文件名后追加小徽标（如「已共享」「加锁」） |
| 详情/预览面板贡献、状态栏 | 无 | 更远期的横向扩展 |

### B4. 上传/下载能力（P1，注意：**基础上传已缺失**）

- ⚠️ **现状事实**：`multer` 是 backend/package.json 的 unused 依赖；`FileApi.upload`（frontend-types.ts）是**死类型**（前端无实现、后端无路由）；README 声明的「上传」功能当前**不存在**。
- 需求：平台补回上传能力（`/api/files/upload` + multer 中间件 + 前端 API），并在此之上提供：
  - 上传前钩子（校验/改写目标目录/限大小）
  - 上传完成事件（B2 文件事件总线覆盖）
  - 下载包装/拦截钩子（如网盘插件改写下载头）

### B5. 主题与样式（现状够用，小的补充）

- 已有：`registerTheme`（CSS 变量令牌体系 + `color-scheme` + 类名前缀规范）
- 补充需求：令牌**注册**（插件自定义 `--app-*` 令牌声明表）、图标库注入、`activeTheme` 变更订阅（现有 `useTheme` 返回 ref，可 watch，已够）

### B6. 数据处理能力（P2，想象空间）

- 搜索扩展（注册额外索引/过滤源）
- 虚拟文件系统：后端已有 `isVirtualFs` 雏形（safePath），可扩展为「插件注册虚拟目录提供者」（如云盘/归档只读挂载）
- 属性读取扩展（文件元信息侧栏，如图片 EXIF 已在 image-viewer 内实现，可作为平台能力上收）
- 自定义操作确认拦截（删除前插件可拦截/附加提示）

### B7. 生命周期与平台机制（P0/P1）

| 需求 | 现状 | 说明 |
|---|---|---|
| 前端 teardown 契约 | **无**（提示用户手动刷新） | 卸载/重载后路由、监听器、全局注册仍残留。建议 `install(ctx)` 返回 teardown 或平台广播卸载事件 |
| 后端事件总线（跨插件 + 主项目） | 无（仅 `registerService` 点对点） | 广播式：`ctx.events.on/emit`，如 `file:deleted`、`plugin:loaded` |
| 插件数据持久化目录 | 无 | 插件自有状态（配置已在 config.yml，但业务数据无落盘位置）→ `ctx.dataDir` 或 `ctx.storage.{get,set}` |
| 定时/计划任务 | 无 | `ctx.schedule.{interval,cron}`（由主项目事件循环托管，随进程生命周期） |
| 认证扩展 | 无 | 第二因子、插件自定义登录校验器、API key（对「插件即 RCE」场景，认证扩展属高阶能力） |
| 上传中间件暴露 | multer 未使用 | `ctx.middleware.upload` 或 `ctx.utils.upload` |
| WebSocket/SSE 复用通道 | 有 task SSE；无插件消息通道 | 插件想推送实时消息只能自建 SSE 路由（现有 `utils.sse` 可支持，够用） |

### B8. 类型与文档契约（P0，发布阻断项）

| 问题 | 现状 | 要求 |
|---|---|---|
| 平台注册表类型未导出 | `BulkAction/BulkActionsApi` 不在 `@mqn00/file-manager/plugin/frontend` 类型入口 → compress 本地重定义 `BulkActionLike` | 平台类型统一从主包导出，消灭 `XxxLike` 漂移 |
| 查看器契约未平台化 | `FileViewerModule/FileViewerRegistry` 在 file-viewer 插件包内，主项目不感知 | 至少作为「官方向导契约」导出类型并文档化（registry 本身可保持插件自有） |
| frontend-types.ts 手写同步 | `@keep-in-sync` 五处 | 加类型一致性测试或改为生成 |
| 文档滞后 | API.md/plugin-design.md 未记录 bulk actions 与查看器体系 | 补文档（AGENT.md 规则） |
| 兼容性校验 | 安装时不校验插件的最低主项目版本 | `fileManagerPlugin.minHostVersion` 或读 peerDependencies，安装/加载时比对 |

---

## C. 接口草案（签名级，供实现参考）

以下草案遵循平台既有模式：**register(id, spec) → 返回 unregister；幂等覆盖；类型全部从主包导出**。

### C1. 导航（P0，改动最小）

```ts
// FrontendPluginContext.router 增加
router: {
  ...,
  push(to: RouteLocationRaw): Promise<NavigationFailure | void>
  replace(to: RouteLocationRaw): Promise<NavigationFailure | void>
}
// file-viewer 的 spaNavigate hack 可删除，改 ctx.router.push(`/plugin/file-viewer/view?...`)
```

### C2. 文件打开钩子（P0）

```ts
export interface FileOpenContext {
  file: FileItem
  currentPath: string
}
export interface FileOpenHook {
  /** 返回 true = 插件已处理，主应用不执行默认行为（导航/下载） */
  (ctx: FileOpenContext): boolean | void
}
// ctx.hooks.onFileOpen(handler): () => void   // 返回取消注册
// 主应用：HomeView 点击文件名 → 依次调用已注册 hook（注册序），首个返回 true 者接管
// 配套：文件名元素加 data 属性（data-fm-name="<文件名>"、data-fm-type="file|dir"），
//       插件禁止依赖 CSS 类名（.file-name-text/.is-folder）
```

### C3. 右键菜单注册（P1，与 bulk actions 完全对称）

```ts
export interface FileMenuEntry {
  id: string
  label: string
  /** 菜单项内嵌图标（Vue 组件/VNode） */
  icon?: () => VNode
  /** visible 返回 false 不显示；入参与 bulk 一致 + row 可为 null（空白处） */
  visible(p: { row: FileItem | null; count: number; currentPath: string }): boolean
  run(p: { row: FileItem | null; selected: string[]; infos: FileItem[]; currentPath: string }): void
  /** 可拆卸分割线分组 */
  group?: string
}
// ctx.menus.registerFileMenu(entry): () => void
// 主应用 ContextMenu.vue 渲染：内置 3 项 + 插件项（按 group 分隔）
```

### C4. 文件图标注册（P1）

```ts
export interface FileIconSpec {
  id: string
  /** 命中的扩展名（小写，不含点）；空数组 = 兜底 */
  extensions?: string[]
  /** 或自定义匹配（优先级：exact 扩展名 > 自定义匹配 > 兜底） */
  match?: (file: FileItem) => boolean
  /** 返回图标渲染（VNode / emoji 字符串 / CSS class 名） */
  icon: (file: FileItem) => VNode | string
  /** 优先级，数字大者先命中 */
  priority?: number
}
// ctx.icons.registerFileIcon(spec): () => void
// 主应用 FileTable 的图标列改为注册表驱动（未命中保持内置默认）
```

### C5. 自定义列表列（P2）

```ts
export interface FileColumnSpec {
  id: string
  label: string
  width?: number
  /** 渲染函数（平台传入 h 避免插件依赖渲染上下文） */
  render(h: typeof import('vue').h, file: FileItem): VNode
  /** 排序支持（可选）：取排序值 */
  sortValue?: (file: FileItem) => string | number
}
// ctx.columns.register(spec): () => void
// 主应用 el-table 列 = 内置列 + 插件列（列头允许显示/隐藏，偏好存 localStorage）
```

### C6. 上传能力回归 + 钩子（P1）

```ts
// 平台补回：POST /api/files/upload（multer，multipart：dir + file），注册到 ctx.api.file
// ctx.api.file.upload(dir: string, file: File, onProgress?: (pct: number) => void): Promise<void>

// 钩子（后端）
// ctx.hooks.onUploadBefore(ctx: { dir: string; fileName: string; size: number }): Promise<{ ok: boolean; reason?: string; newDir?: string } | void>
// ctx.hooks.onUploadComplete(ctx: { dir: string; path: string; size: number }): void
// 前端：ctx.hooks.onUploadComplete 同步一份（经事件总线 C9）
```

### C7. 文件操作事件总线（P1，前后端对称）

```ts
// 后端（ctx.events，EventEmitter 封装，插件间 + 主项目文件操作广播）
type FileEvents = {
  'file:created': { path: string }
  'file:renamed': { oldPath: string; newPath: string }
  'file:deleted': { paths: string[] }
  'file:moved': { sourcePaths: string[]; targetPath: string }
  'file:uploaded': { path: string }
}
ctx.events.on<K extends keyof FileEvents>(event: K, cb: (payload: FileEvents[K]) => void): () => void
ctx.events.emit<K extends keyof FileEvents>(event: K, payload: FileEvents[K]): void
// 主项目 fileService 在操作成功处 emit；插件注册监听（如改名同步）

// 前端（平台 window 事件封装，避免插件各造 window.dispatchEvent 命名）
// ctx.events.on('file:uploaded', cb) —— 主项目上传成功 dispatch('fm:file:uploaded', detail)
```

### C8. 前端 teardown 契约（P0）

```ts
// 约定：install(ctx) 可返回 (() => void) 或 Promise<() => void>
export const install: FrontendPluginInstallFunction = (ctx) => {
  const offRouter = ctx.router.addRoute({...})
  const offHook = ctx.hooks.onFileOpen(...)
  return () => { offRouter(); offHook(); document.getElementById('my-style')?.remove() }
}
// 平台：PluginView 卸载/重载时调用；主应用先广播 'fm:plugin:unload:<name>' 再收集 teardown
// 兼容：不返回 teardown 的旧插件照常工作（平台仍未做到的，提示刷新）
```

### C9. 插件数据与调度（P2）

```ts
// 数据目录：主项目为每个插件提供持久化目录（如 ~/.file-manager/data/<短名>/），
// ctx.dataDir: string（绝对路径，已确保存在；卸载不删除，删除插件时提示清理）

// 调度
ctx.schedule.interval(ms: number, task: () => void | Promise<void>): () => void  // 返回取消
ctx.schedule.cron(expr: string, task: () => void | Promise<void>): () => void    // 可选，引入 cron 依赖
```

### C10. 兼容性校验（P0，发布机制）

```jsonc
// plugin package.json 新增
"fileManagerPlugin": {
  "minHostVersion": "3.0.0"   // 或沿用 peerDependencies 声明
}
// 主项目安装/加载时：semver 比对当前版本，不满足 → 安装拒绝/加载时 403 提示
// 主项目发布时输出「API 冻结清单」：v3.0.0 起的 ctx 字段只增不改，破坏性变更走 v4
```

---

## D. 优先级与发布边界（建议）

| 优先级 | 项目 | 改动量 | 理由 |
|---|---|---|---|
| **P0（随 v3.0.0 发布）** | ① 版本全局对齐（beta7→3.0.0，root/backend/frontend/12 插件） | 小 | 发布阻断项 |
| | ② `ctx.router.push/replace` + file-viewer 去掉 pushState hack | 小 | 消除路由 hack |
| | ③ 文件名元素 data 属性 + 文件打开钩子（C2） | 中 | 消除 DOM 耦合，平台化「打开文件」 |
| | ④ 平台注册表类型导出（BulkAction/FileViewerModule 等）+ API.md/plugin-design.md 补文档 | 小 | 类型契约 + 文档（AGENT.md 规则） |
| | ⑤ `minHostVersion` 兼容校验（C10） | 小 | 版本契约 |
| | ⑥ 前端 teardown 契约（C8） | 中 | 卸载语义 |
| **P1（3.0.x 首批）** | ⑦ 右键菜单注册（C3） | 中 | 最常见第三方诉求 |
| | ⑧ 文件图标注册（C4） | 中 | 最常见第三方诉求 |
| | ⑨ 上传能力回归 + 钩子（C6，含清除 multer 死依赖/FileApi.upload 死类型） | 中 | 功能完整性 + 钩子诉求 |
| | ⑩ 文件操作事件总线（C7） | 中 | 插件联动基础 |
| **P2（roadmap）** | ⑪ 自定义列（C5）· ⑫ 插件数据目录 + 调度（C9）· ⑬ 虚拟文件系统提供者 · ⑭ 认证扩展 · ⑮ 搜索/过滤钩子 | 大 | 横向能力，随生态需求演进 |

**一句话边界声明（建议写入 README）**：v3.0.0 承诺冻结 A 部分全部 API 与 B1/B2 类别；P1/P2 为后续 minor 版本增量，新增 API 只增不改，不破坏已冻结契约。