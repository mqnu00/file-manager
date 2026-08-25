## v3.0.0-beta9 (2026-08-24)

### ✨ 新增功能

- **插件工具栏操作挂载点**：主应用新增批量操作注册表（`window.__fm_bulk_actions` + `useBulkActions`），
  前端插件可注册显示在文件浏览器批量操作栏的自定义操作按钮（可见性 + 点击回调，按 id 幂等覆盖），
  为“压缩”等由插件提供能力的场景提供平台扩展点

### 🔧 变更

- **压缩功能提取为独立插件**：主应用删除内置压缩（工具栏压缩按钮、`POST /api/tasks/compress` 任务型压缩、
  `POST /api/files/zip` SSE 压缩及 `/zip/cancel`），压缩改由插件 `@mqn00/file-manager-plugin-compress`
  提供（详见插件 README 与 API.md）

---

## v3.0.0-beta8 (2026-08-21)

### ✨ 新增功能

- **sudo 提权**：浏览目录（目录不可读）、读取文件内容、新建文件/文件夹、重命名、删除（单文件/批量）、写入文件内容因权限不足（`EACCES`/`EPERM`）失败时，前端弹出提权对话框收集 ubuntu 用户名 + 密码，后端校验后限时缓存凭据并自动以 `sudo` 重试原操作
  - 列目录提权基于 `sudo find -printf` 实现；仅个别条目不可访问（如受限符号链接）时以 `lstat` 信息降级展示，不再导致整页 500
  - 读文件提权基于 `sudo dd` 按 4KB 块对齐读取后裁剪目标区间，避免整文件载入
  - 凭据内存级限时缓存，有效期由 `config.yml` 的 `auth.elevationTtlMinutes` 控制（默认 5 分钟，可配 5/10 等，热加载生效）；过期 / 后端进程重启 / 前端登出即失效
  - 总开关 `features.sudoElevation`（默认 `true`），关闭后不进入提权流程
  - 新增接口 `POST /api/auth/elevate`、`POST /api/auth/elevate-clear`；权限不足错误统一为 `403` + `code: ELEVATION_REQUIRED`
  - 提权创建/重命名的文件默认归还属主给应用启动用户（对话框「提权后归还属主」勾选项，默认勾选），避免文件变 root 属主后应用无法再读写
  - 安全：sudo 以数组参数调用（不进 shell，路径加 `--` 防注入），密码仅存内存不落盘

---

## v3.0.0-beta7 (2026-08-20)

### ✨ 新增功能

- 插件页面路由支持 `meta.requiresAuth` 自声明登录拦截：插件通过 `ctx.router.addRoute` 声明 `requiresAuth: true` 时，未登录访问该页面会被路由守卫重定向到登录页（登录后跳回原页面）；纯主题/公开页面不声明即默认放行
  - 类型定义同步：backend 插件类型（`backend/src/plugin/frontend-types.ts`）与前端 context（`frontend/src/context.ts`）新增 `PluginRouteRecord`，提供 `meta.requiresAuth` 类型提示与文档
  - hatsune-miku 主题插件页面落地声明（其自定义背景上传/删除接口已挂认证，页面随之需要登录）
  - 配套测试：路由守卫新增插件路由 requiresAuth 拦截/放行用例
- 引入 file-viewer 查看插件体系（图片/代码/视频/音频/二进制/Office/Markdown 子插件），主应用零改动即可扩展文件查看能力
- 新增 file-image-viewer 图片查看器：缩放 / 旋转 / 适应窗口 / 拖拽 / 滚轮缩放（以鼠标位置为锚点），工具栏展示分辨率、DPI、位深度（PNG/JPEG/GIF/BMP/WebP 解析文件头）
- 新增 file-markdown-viewer：Markdown 只读预览（marked + highlight.js 语法高亮）
- 配置页支持用户指定默认查看器（替代硬编码兜底）
- 查看器支持自由选择全部已注册模块，并增加媒体加载错误提示
- 插件需声明 `frontendPage` 才显示进入前端入口按钮
- 文件列表所有文件悬浮可点击样式，已注册查看器的文件常驻高亮
- 主页目录路径记忆改用 sessionStorage 临时记忆
- 工具栏「新建」按钮改造为下拉菜单，新增创建文件功能（命名空文件）

### 🐛 Bug 修复

- 修复查看文件返回后 has-viewer 样式丢失
- 修复直接刷新查看器 URL 时文件大小显示为 0B（store 为空时异步补全真实元数据）
- 修复十六进制查看器跳转偏移输入框无法输入（ElInput 的 `onUpdate` 应为 `onUpdate:modelValue`），新增回车跳转与格式占位符提示

### 🎨 样式与规范

- 插件样式与主题适配规范：颜色只用 `--app-*` 主题令牌（带 fallback）、禁硬编码；暗色主题声明 `color-scheme: dark`；注入类名必须带插件前缀；Monaco/PDF 等第三方组件内部主题订阅 `useTheme()` 联动
- file-viewer 系插件类名前缀化与令牌化整改（`fiv-`/`fcv-`/`fbv-`/`fvv-` 等）

### 🔧 工程改进

- 文件 I/O 上收主项目平台：file-viewer 新增查看器映射配置主页，5 个文件查看器插件 I/O 迁移至 `ctx.api.fileIO`
- `fileIO` 降为纯二进制透传，文本/二进制/大小判断下沉到消费方插件
- 修复插件热重载临时副本保留 node_modules 依赖解析链
- 十六进制查看器虚拟滚动改造，解决大文件加载性能问题（渲染节点从约 52 万降至可视区数百）
- 清理 file-viewer 系列插件的 ElementPlus/Vue 类型断言（`createXxxViewer` 返回类型改由推导，移除 `as unknown as` / `never`）

---

## v3.0.0-beta6 (2026-08-13)

### ✨ 新增功能

#### 主题系统插件化

- 新增插件主题注册能力：插件通过 `useTheme.registerTheme` 注册 `ThemeDefinition`（`name`/`label`/`className`/`css`），主题切换按钮由「赛博/亮色」二元切换改为下拉框，可列出并切换全部已注册主题
- `useTheme` 重构：新增 `themes` / `activeTheme` / `setTheme` / `registerTheme`，`isCyber` 改为计算属性（用于控制赛博特效显示）
- 插件提供的主题 CSS 由主项目注入 `<style data-theme="name">`（按 id 去重，插件重载时覆盖）
- 插件注册晚于主应用启动时，若持久化主题名与之匹配则立即应用，不覆写 localStorage 存储值

#### 插件发现页增强

- 搜索支持分页：后端 `GET /api/plugins/search` 新增 `page`/`pageSize` 参数，返回 `{ total, results }`；前端新增页码条与每页 20/50/100 切换
- 版本下拉框标注已安装版本：后端 `GET /api/plugins` 返回插件 `version`（读取 package.json），下拉选项标注「最新」「当前」，同一版本合并为「最新 · 当前」

#### gh-pages demo 集成主题插件

- 插件 `backgrounds.ts` 静态资源地址改为 esbuild `define` 可注入（`__MIKU_API_BASE__` / `__MIKU_LOGO_URL__`），`build.mjs` 新增 `--demo` 产出 `dist/frontend.demo.js`，资源前缀烘焙为 `/file-manager/`（gh-pages 项目站点无后端）
- 新增 `scripts/sync-demo-plugins.mjs`：`build:demo` 串接构建插件 demo bundle，并同步 bundle 与静态资源到 `frontend/public`（产物已 gitignore）
- 新增 `frontend/src/demo/plugins.ts`（`DEMO_PLUGINS` + `DEMO_DEFAULT_THEME`），mockHandlers 虚拟化 `/api/plugins` 列表与 load/unload 接口，demo 插件可出现在插件管理页并支持启停
- `pluginLoader` 在 `VITE_DEMO_MODE=true` 时跳过 `/api/plugins` 直接加载内置静态插件；`main.ts` 无主题偏好时默认应用 miku 主题
- 配套测试：pluginLoader demo 分支、mockHandlers 插件接口及测试 fixture

### 🐛 Bug 修复

- 修复离开主页后文件选中状态残留，导致批量操作标签在其他页面/再次返回时仍显示的问题（`onUnmounted` 清空选择）
- 修复移动文件对话框路径自动定位的死循环与定位失效：等待节点注册/懒加载改为带超时轮询，路径规范化与 `node-key` 对齐，根目录直接滚动到顶部

### 🎨 样式优化

- hatsune-miku 主题面板默认透明度改为 10%、模糊度改为 0px，毛玻璃效果更通透

### 🔧 工程改进

- 合并 test 与 release 为单一 workflow（测试通过后执行 release），删除独立的 test workflow
- release 后显式触发 publish 与 deploy-gh-pages（GITHUB_TOKEN 创建的 tag 不触发 push 事件）
- 修复 test job 缺少 test 插件构建产物导致的 CI 失败
- 拆分 `install:all-demo` 脚本：gh-pages 构建改用其安装主题插件依赖（根 + 前端 + 后端 + 主题插件），普通 `install:all` 不再安装插件依赖

### 📝 文档

- 新增插件编写规范文档 `plugin-design.md`（含 ctx API、构建发布、静态资源两种模式）

---

## v3.0.0-beta5 (2026-08-11)

### 🏗️ 架构变更

#### 三层测试体系 + CI 接入

- **后端单元/集成测试**（Vitest + supertest）：214 个用例，覆盖鉴权（session/中间件/登录/限流）、文件操作（列表/下载/重命名/移动/删除/批量删除/压缩/路径穿越防护），并扩展覆盖配置/CLI/错误中间件/插件加载/文件路由/终端服务/包管理器/文件服务/插件加载监听与托管服务
  - 测试隔离：`CONFIG_PATH` / `LOG_DIR` / storageRoot 指向临时目录，不触碰真实数据与日志
  - `backend/vitest.config.ts` + `backend/test/setup.ts`；测试文件从 tsc 构建中排除（`tsconfig.json`）
- **前端组件测试**（Vitest + @vue/test-utils + jsdom）：197 个用例，覆盖 API/store/组件/组合式函数/视图/路由/插件加载/脚本运行及格式化工具函数
  - `frontend/vitest.config.ts` + `frontend/test/setup.ts`（Element Plus 全局挂载、jsdom 布局/API mock）
- **端到端测试**（Playwright）：22 个用例，覆盖登录认证、文件浏览/新建/重命名/删除、未登录安全防护、任务、日志/配置/插件管理页面
  - 独立测试配置 `e2e/fixtures/config.yml`（token `e2e-token-123`），数据由 `e2e/prepare-data.mjs` 重建
  - 登录会话通过 storageState 复用（`e2e/tests/auth.setup.ts`），避免触发后端登录限流
- **覆盖率报告**：接入 Vitest v8 provider，新增 `test:coverage` / `test:coverage:backend` / `test:coverage:frontend` 脚本
- **CI 接入**：新增 `.github/workflows/test.yml`，push / PR 时运行三层测试（node 22）
- 根 `package.json` 新增 `test` / `test:backend` / `test:frontend` / `test:e2e` 脚本
- test 插件发布 v0.2.0 / v0.3.0 版本，用于验证版本切换与托管服务场景

### ✨ 新增功能

#### 插件托管服务机制

- 新增 `ManagedServiceSpec` 与 `BackendPluginContext.manageService/startService/stopService/waitForService/isServiceRunning`：插件可注册启停可管理、状态可查询的托管服务，支持服务级依赖等待（`dependsOn`）
- 启动时按依赖分层恢复 `config.yml` 中 `startedServices` 记录的服务（不阻塞服务器监听），插件热重载后自动恢复托管服务，卸载插件时停止其服务
- smb 插件注册托管服务：`canAutoStart` 用 `sudo -n` 预检避免 PTY 挂起等待密码；start/stop 走托管包装并持久化 `startedServices`，重启文件管理器后 smbd 自动恢复
- `saveSmbConfig` 合并保留插件配置系统字段（`enabled` / `source` / `startedServices`），避免整段覆盖丢失

### 🐛 Bug 修复

- 修复 npm 插件包丢失时删除报错 not found：来源 npm 的插件若包已不在磁盘上（如手动清理 node_modules），删除时仅清理 config.yml 配置并跳过 npm uninstall
- 修复本地插件解析：优先解析 `plugins/` 本地开发目录，避免 node_modules 中同名包被 scope 扫描误匹配（如 `@playwright/test` 命中插件 "test"）

### 🔄 改进优化

- 简化 CI 触发：publish npm 与 deploy gh-pages 改为仅由 `v*` tag 推送触发，移除 `workflow_run` 双触发及守卫条件，保留 `workflow_dispatch` 手动触发

---

## v3.0.0-beta4 (2026-08-05)

### ✨ 新增功能

#### 插件版本下拉选择

- 搜索 npm 插件后自动获取该包已发布版本列表，通过下拉框选择（替代手动输入），最新版标记"最新"
- 下拉支持输入过滤与自定义版本/tag，加载失败时可手动输入兜底
- 后端新增 `GET /api/plugins/versions` 接口，返回全部已发布版本（semver 降序）与 latest 版本

### 🐛 Bug 修复

- 修复 npm 插件被当作 extraneous 自动清除的问题：插件安装命令由 `--no-save` 改为 `--save-exact`，插件写入安装目录 `package.json` 的 `dependencies`（精确版本），后续在同一目录安装其他插件时不再被 npm 清理
- `--save-exact` 记录用户选择的精确版本，避免后续 `npm install` 意外升级
- 卸载接口默认 `--save` 行为，自动从 `dependencies` 移除条目，无需额外改动
- 版本切换（已安装 npm 插件重装新版本）自动更新 `dependencies` 中的版本

> 注意：修复前通过 `--no-save` 安装的插件（extraneous 状态）需手动重新安装一次。

---

## v3.0.0-beta3 (2026-08-05)

### 🏗️ 架构变更

#### 插件加载统一为 CJS

- 后端插件统一使用 CJS `require` 加载，**v3 起不再支持 ESM 插件**（`type: module`），删除 `nativeImport`/`new Function` 分支
- 已通过 npm 安装的 ESM 插件需升级为 CJS 版本后重新安装，否则无法加载
- 插件前端资源不受影响：仍由 esbuild 打包为浏览器 ESM，经 `import()` 动态加载
- smb 插件移除 `type: module`，tsconfig（NodeNext）下自动编译为 CJS；相对导入补 `.js` 扩展名

### ✨ 新增功能

#### 插件自动加载

- `GET /api/plugins` 自动加载 `config.yml` 中 `enabled=true` 但尚未加载的插件，单个插件加载失败不影响其他插件和列表返回

#### 插件加载兼容性

- `getInstallFn` 兼容函数直出（`export default function`）模式

### 🐛 Bug 修复

- 修复并行加载时插件服务注册归属竞态：`registerService` 通过 `currentInstallingPlugin` 直接归属当前插件，避免 `___loading___` 占位符被先完成 install 的插件抢走（曾导致 smb 热重载报 `Service "smb" is already registered by plugin "test"`）；install 失败按归属清理
- 修复 `resolvePluginRoot` 本地分支在 npm 安装后 config 尚未写入 `source` 时的解析回退（fallback 到 pluginInstallDir）
- 修复 smb 配置合并：`getSmbConfig` 使用 spread 合并默认值，避免部分字段为 `undefined` 导致 `.some()`/`.map()` 崩溃
- 修复 smbd 因缺失 ncalrpc 目录退出：`generateSetupScript` 添加 `mkdir -p /run/samba`

### 🔄 改进优化

- 插件热重载 `cacheBust` 从"复制单个入口文件"改为"复制整个 dist 目录"（`fs.cpSync`），支持多文件 CJS 插件（如 smb 的 `require('./smbManager.js')`）相对依赖解析
- 热重载临时目录 30 秒延迟清理，兼容 install 异步引用相对依赖

---

## v3.0.0-beta2 (2026-07-28)

### ✨ 新增功能

#### npm 插件市场

- 新增 npm 插件搜索/安装/卸载/删除完整生命周期管理
- 搜索：通过 `keywords:file-manager-plugin` 在 npm registry 查询可用插件
- 安装：支持指定版本安装、强制模式（`--legacy-peer-deps` 绕过 peer dependency 冲突）
- 卸载：npm uninstall + config.yml 配置自动清理
- 删除：禁止删除本地开发插件（`plugins/` 目录），仅允许删除 npm 插件

#### 插件 source 字段

- 新增 `source` 字段（`local` / `npm`）区分插件来源，持久化到 config.yml
- 同名本地插件和 npm 插件可共存，通过 source 切换启用哪个
- 安装 npm 插件时不覆盖本地同名插件的配置值

#### 统一插件安装目录

- 新增 `pluginInstallDir` 配置项，npm 插件统一安装到此目录
- 开发环境默认 `cwd/node_modules`，生产环境默认 `~/.file-manager/node_modules`
- 系统配置页面（ConfigView）支持可视化修改 npm 安装目录

### 🐛 Bug 修复

- 修复 `/plugins-assets` 静态资源路由硬编码指向本地 `plugins/` 目录，导致 npm 插件前端资源无法正确加载
- 修复前端安装/删除插件后需手动刷新才能看到变更的问题（自动刷新）
- 修复 `loadPluginFrontend` 相同 URL 被浏览器 ES Module 缓存导致切换版本后仍加载旧模块的问题

### 🔄 改进优化

- 安装/删除插件后自动刷新页面，避免手动刷新
- 删除接口 npm uninstall 统一使用 `pluginInstallPrefix`（与安装路径一致）

---

## v3.0.0-beta1 (2026-07-24)

### 🏗️ 架构变更

#### 插件系统

- SMB 功能从主项目提取为独立插件 `file-manager-plugin-smb`
- 插件加载器支持 4 级查找策略：精确匹配 → `file-manager-plugin-` 前缀 → scoped 包内查找 → `plugins/` 本地目录
- 新增 `resolvePackageRoot` 辅助函数绕过 `exports` 字段限制
- 插件后端上下文统一从 `@mqn00/file-manager/plugin` 导入 express 类型，消除插件构建报错
- 插件示例目录 `plugins/test` 提供开发参考

#### 插件管理界面

- 前端新增插件管理页面（`/plugins`），展示已配置插件列表
- 支持运行时加载/卸载/重载插件
- 标记插件来源：npm 包 或 本地开发（`local` 字段穿透到前端展示）
- 已加载插件的前端页面通过动态 import 渲染

### 🔧 开发工具链

- 后端开发模式从 `ts-node` 切换为 `tsx watch`，支持热加载

---

## v2.9.0 (2026-07-17)

### ✨ 新增功能

#### SMB 局域网共享

- 新增 SMB 协议支持，可通过局域网共享文件夹
- 基于系统 Samba（smbd），非特权端口 1445 运行，无需 root 权限
- 前端新增 SMB 管理页面（`/smb`），支持启停控制、全局设置、共享 CRUD
- 后端新增 SMB 服务管理器，自动生成 `smb.conf` 并管理 smbd 进程生命周期
- Samba 未安装时前端友好提示，不阻塞应用正常使用

---

## v2.8.0 (2026-07-17)

### ✨ 新增功能

#### Electron 桌面应用

- 新增 `electron/` 目录，包含主进程 (`main.ts`) 和预加载脚本 (`preload.ts`)
- 新增 `electron-builder.yml` 构建配置，支持 Linux AppImage 和 deb 格式
- Electron 模式下自动禁用 CSP 限制、绑定 `127.0.0.1` 防止外部访问
- 新增 `npm run electron:dev` / `electron:start` / `electron:build` 开发/启动/打包命令
- 构建产物：AppImage (~108MB) + deb (~75MB)

#### GitHub Actions Release 增强

- Release 工作流新增 Electron 构建步骤 (`npm run electron:build`)
- Release 附件从仅 `.tar.gz` 扩展为 `.tar.gz` + `.AppImage` + `.deb`
- Node 版本从 20 升级到 22

### 🔄 改进优化

- 根 `package.json` 添加 `"type": "module"`，统一 ESM 模块规范
- `scripts/dev.js` 和 `scripts/release.js` 从 CJS 转换为 ESM
- `backend/src/cli.ts` 适配 `createServer` 导出模式
- `.gitignore` 新增 `dist-electron/`、`release/` 排除项

---

## v2.7.1-test.1 (2026-07-16)

- 测试：GitHub Pages demo 部署 + npm 发布完整流水线

---

## v2.7.0 (2026-07-16)

### 🐛 Bug 修复

- 修复 SSE 压缩接口 `GET /zip` 改为 `POST /zip`，前端改用 `fetch` + ReadableStream 携带认证头
- 修复下载功能 `window.open` 改为 `fetch` + `blob` 携带认证头，解决认证失效问题
- 修复登录后未跳转回原页面，现在读取 `redirect` 查询参数正确回跳
- 修复路径遍历漏洞：检测 `..` 路径段，拒绝非法路径访问
- 修复移动文件 handler 中 `fromPath`/`toPath` 变量作用域问题（移到 try 之前）
- 修复前端日志页面幽灵"复制"选项
- 修复虚拟文件系统中文件大小异常显示
- 修复日志页面多余的 HTML 结束标签导致编译失败
- 优化文件/文件夹操作提示样式（mobile-style → 标准位置）

### 🔄 改进优化

- 后端统一使用结构化日志（`LogEntry` 接口），替代原始字符串行
- 日志自动清理：支持配置保留天数，启动时自动删除过期日志
- 前端日志页面适配结构化数据，移除前端的 `parseLogLine` 解析逻辑
- 前端日志卡片宽度改为响应式，自适应窗口大小
- 移除 `errorHandler` 中间件冗余的 `console.error`，统一通过 `log()` 输出
- 文件移动/压缩错误改用 `log()` 记录，移除 `console.error`
- 导出 `isVirtualFs`，消除 `fileService.ts` 中的重复定义
- 目录复制改为流式传输（`createReadStream` + `pipeline`），替代同步读写法
- 右键菜单加入视口边界检测，避免溢出屏幕
- `SciFiBackground` 从 `v-if` 改为 `v-show`，避免重复初始化 Three.js
- 移动对话框 `PathSelector` 排除源目录及其子目录
- 日志系统新增 `other` 操作类型，记录所有错误/失败操作

### ✨ 新增功能

- **设置页面日志清理配置**：可选启动时清理、保留天数下拉选择、立即执行清理
- 后端新增 `POST /api/logs/clean` 清理接口
- 日志配置（`cleanupOnStartup` / `retentionDays`）支持 `config.yml` 持久化和热加载
- npm 包补充 `repository`、`license`、`keywords` 字段
- 新增 `LICENSE` MIT 许可证文件
- **GitHub Pages Demo 部署**：构建 demo 模式前端，所有 API mock，可交互浏览文件管理界面
  - `VITE_DEMO_MODE=true` 启用 mock 拦截器，自动跳过认证
  - 模拟 3 层嵌套文件树、系统信息、配置、日志等数据
  - 支持文件浏览、创建文件夹、删除、重命名、移动（模拟进度）、主题切换
  - 路由切换 Hash 模式兼容 GitHub Pages，压缩/下载操作提示不支持
  - tag 推送自动构建部署到 `gh-pages` 分支
  - `npm run build:demo` / `npm run preview:demo` 本地预览

### 🔧 工程改进

- 升级 ESLint 及相关 lint 依赖版本

---

## v2.6.0 (2026-07-15)

### ✨ 新增功能

#### npm 包发布支持

- 新增 CLI 入口 `backend/src/cli.ts`，支持 `file-manager` 全局命令（`-p`/`-c`/`-d`/`--daemon` 等选项）
- 新增 `backend/README.md`，提供 npm 安装和使用说明
- `backend/package.json` 配置 `bin`、`files`、`prepublishOnly` 等发布字段
- 新增 `.github/workflows/publish.yml`，推送 `v*` 标签时自动 `npm publish` 至 `@mqn00/file-manager`
- `scripts/release.js` 版本 bump 同步更新 `backend/package.json`

### 🔧 工程改进

- Node.js 最低版本要求从 >= 18 提升至 >= 22

# 变更日志

## v2.5.1 (2026-07-15)

### ✨ 新增功能

#### 日志查询增强

- 后端新增 `GET /api/logs/dates` 接口，返回有日志的日期列表
- 后端 `GET /api/logs` 支持 `startDate`/`endDate` 参数进行区间查询
- 前端日志页面单日期选择器改为日期区间选择器（daterange）
- 前端通过 `disabledDate` 禁用无日志日期（本地时间格式化修复时区偏移）

### 🔧 工程改进

#### 跨平台适配（Windows 兼容性）

- 后端引入 `systeminformation` 依赖，替代所有 `execSync` Linux 专有命令调用
- `system.ts` 重构：`lscpu`/`sysctl`/`df`/`lsblk` 替换为跨平台 API
- CPU 频率四级回退链：`si.speed` → `si.speedMax` → `lscpu`(Linux) → `os.cpus()`
- 磁盘设备路径按平台适配（Linux `/dev/sda`，Windows `C:`）
- `safePath.ts` 默认回退路径 `'/'` → `process.cwd()`，`startsWith('/')` → `path.isAbsolute()`
- `config.ts` `storageRoot` 默认值 `'/'` → `process.cwd()`

### 📝 文档

- 更新 API 文档，补充日志区间查询和可用日期接口说明

---

## v2.5.0 (2026-07-08)

### ✨ 新增功能

#### 操作日志系统

- 后端新增日志工具，按天切块写入 `logs/YYYY-MM-DD.log`
- 记录文件移动、重命名、删除、创建文件夹、登录/认证等操作
- 新增 `GET /api/logs` 查询接口，支持按日期、级别、操作类型、关键词筛选和分页
- 前端新增日志查询页面（日期选择、筛选、分页表格）
- UTC 时间自动转换为浏览器本地时区显示
- Toolbar 新增日志导航按钮

#### 硬盘信息增强

- 多分区硬盘容量汇总显示（之前只显示第一个分区）
- 硬盘容量合并为单个 el-progress 展示，根据使用率变色（≤65% 蓝色、65%-85% 黄色、>85% 红色）
- 鼠标悬浮进度条显示各分区详情（挂载点、使用率、已用/总量）

### 🐛 Bug 修复

- 修复空文件夹计算大小后重复显示计算按钮的问题
- 修复移动文件前检查目标目录同名冲突，有冲突则取消操作
- 修复 helmet 默认启用 HSTS 导致生产环境强制 HTTPS 重定向
- 修复 helmet 默认启用 upgrade-insecure-requests 导致 HTTP 资源被升级为 HTTPS
- 修复 helmet 默认启用 COOP/COEP/CORP 跨域安全头在 HTTP 环境下的警告

### 🎨 样式优化

- 赛博主题适配 el-table（表头、斑马纹、悬停行、选中行）
- 赛博主题适配 el-pagination（按钮、激活状态）
- 赛博主题适配 el-tag（info/warning 变体）

### 📝 文档

- 更新 API 文档，补充日志、文件夹大小、磁盘分区接口说明

---

## v2.4.3 (2026-07-08)

### ✨ 新增功能

- 文件夹大小按需计算，进入目录时自动触发
- 前端适配文件/文件夹重命名功能
- 路径选择器自动滚动到当前文件位置

### 🐛 Bug 修复

- 修复 PathSelector 懒加载树展开逻辑，逐级加载并展开到目标路径
- 修复移动对话框默认定位到源文件所在目录
- 修复移动文件时源和目标目录相同导致文件被删除的问题
- 修复大文件夹计算超时处理，超时显示提示文字
- 修复 calculateDirSize 异步化，避免事件循环阻塞
- 修复"取消选择"按钮文案

### 🔒 安全加固

- 为 file/folder/system 路由添加认证中间件
- 为 renameFile 和 createFolder 添加路径安全校验
- 使用 crypto.randomBytes 替换 Math.random 生成会话令牌
- move 接口从 GET 改为 POST
- 添加 helmet 安全头、CORS 限制、JSON body 大小限制
- 错误处理区分用户验证错误与内部错误，不再向客户端暴露内部错误信息
- CLI 安全警告 + 配置脱敏改为前 3 位

---

## v2.4.2 (2026-07-07)

### ✨ 新增功能

#### 工具栏增强

- 选中文件时在工具栏显示已选文件的 `el-tag` 列表
- 已选文件 `el-tag` 悬浮时展示完整信息（名称、路径、类型、大小、修改时间）
- 工具栏新增"取消选择"按钮，一键取消所有已选文件

#### 硬盘信息

- 硬盘信息支持显示多个挂载点
- 硬盘信息显示制造商和型号

### 🐛 Bug 修复

- 修复文件表格表头固定的问题

---

## v2.4.1 (2026-07-06)

### ✨ 新增功能

#### 赛博主题全面适配

- 新增 el-card、el-divider、el-input-number、el-tag、el-table 选中行、el-loading mask、el-form-item、el-button text 等组件的赛博主题样式
- 新增 el-select 触发器和下拉菜单的赛博主题样式
- 新增 el-button 基础 CSS 变量覆盖，确保所有按钮类型继承赛博主题色
- 新增浏览器自动填充密码的背景色覆盖

### 🐛 Bug 修复

#### 文件下载

- 修复下载中文文件名导致的 `Invalid character in header content` 错误，使用 RFC 5987 编码
- 修复下载后文件选中状态和 toolbar 消失的问题，保留选中状态方便继续操作

#### 硬盘信息

- 修复已挂载硬盘显示为"未挂载"的问题，递归查找分区的挂载信息
- 修复硬盘文件系统类型显示为 unknown 的问题，使用 `df -T` 替代 `df -B1`

#### 赛博主题

- 修复 ElMessage/ElMessageBox 按需导入样式缺失导致布局错乱的问题
- 修复 el-tree 展开箭头点击后选中样式为白色的问题
- 修复 PathSelector 目录选择器选中样式为白天主题的问题
- 修复返回按钮 hover 背景为白色的问题
- 修复浏览器自动填充密码背景为白色的问题

---

## v2.4.0 (2026-07-02)

### ✨ 新增功能

#### 系统信息页面

- 新增系统信息页面（`/system`），展示服务器运行状态
- **操作系统信息**：类型、平台、架构、版本、主机名、运行时间
- **CPU 信息**：型号、核心数、基础频率（通过 `lscpu` 获取）
- **内存信息**：总量、已用、可用
- **硬盘信息**：设备名、挂载点、文件系统类型、总量、已用、可用
- **Node.js 信息**：版本号、进程 ID

#### 多硬盘选择

- 硬盘信息支持选择不同磁盘查看，使用 `lsblk` 获取所有磁盘设备
- 当系统存在多个磁盘时，硬盘卡片头部显示选择框
- 未挂载的磁盘也会显示，容量信息从 `lsblk` 获取

#### 后端新增接口

- 新增 `GET /api/system` 系统信息接口，返回 OS、CPU、内存、硬盘列表、Node.js 信息
- 硬盘接口返回 `disk`（默认磁盘）和 `disks`（所有磁盘列表）

#### UI 改进

- 工具栏新增"系统信息"按钮（Monitor 图标），位于主题切换和设置按钮之间
- 系统信息页面采用卡片式布局，自动适配赛博/亮色双主题

### 🐛 Bug 修复

#### CPU 频率获取

- 修复 CPU 频率返回 0 的问题，改用 `lscpu | grep "CPU MHz"` 获取基础频率
- 移除不准确的实时频率显示

---

## v2.3.0 (2026-05-27)

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
- **登录有效期**：1\~720 小时可配置，新登录生效
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
- `routes/files.ts` 和 `routes/folders.ts` 非 SSE 路由全部改用 `asyncHandler`，减少 \~40 行样板代码
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

| 模块  | 新增文件 | 改动文件 | 新增接口 |
| ----- | -------- | -------- | -------- |
| 后端  | 5        | 4        | 4        |
| 前端  | 7        | 3        | —        |
| CI/CD | 1        | —        | —        |

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

| 模块 | 新增接口         | 改动文件             |
| ---- | ---------------- | -------------------- |
| 后端 | 1 (batch-delete) | 3 文件               |
| 前端 | —                | 10 文件              |
| 文档 | —                | API.md, CHANGELOG.md |

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

| 模块     | 新增文件 | 删除文件 | 代码变化         |
| -------- | -------- | -------- | ---------------- |
| 后端     | 4        | 0        | +597, -729       |
| 前端     | 6        | 1        | +759, -373       |
| **总计** | **10**   | **1**    | **+1356, -1102** |

### ✅ 兼容性说明

- API 接口保持不变
- 功能完全兼容 v2.0.0
- 无需修改任何使用代码

---

## v2.0.0 (2026-03-20)

详细更改见 <https://github.com/mqnu00/file-manager/blob/v2.0.0/backend/REFACTOR.md>

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
