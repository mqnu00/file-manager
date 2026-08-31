# @mqn00/file-manager-plugin-file-viewer

File Manager 文件查看**核心插件**：经平台文件打开契约（`ctx.platform.fileOpen`）承接文件列表单击打开，维护查看器注册表并把渲染分发到各子查看插件（code / music / video / office / hex），并提供查看器映射**配置主页**（扩展名 → 查看器）。

本插件**不内置任何查看模块**，也**不再提供文件 I/O 后端**——通用文件读写能力已上收主项目平台（`/api/files/*` + `ctx.api.fileIO` / `ctx.services.fileIO`），子插件直接消费平台 API，与 file-viewer 无耦合。首次安装时请同时安装至少一个子插件，否则查看页会提示"未安装任何查看插件"。

## 功能

- **主页（配置页）`/plugin/file-viewer`**：按查看器分组编辑各自打开的后缀列表，保存为 config.yml 完整映射表（`plugins.file-viewer.extensionMappings`），立即生效并全局持久化
- **查看页 `/plugin/file-viewer/view`**：单击文件列表中文件名打开（文件夹双击导航不受影响），按扩展名解析默认查看模块，页面内可切换"打开方式"并记住选择（localStorage）
- **注册表分发**：子插件在前端 `install()` 时注册自己的默认后缀，核心负责按扩展名解析默认模块
- **依赖平台 I/O**：文本读写、字节分页、短期流令牌 + Range 流式输出由主项目 `/api/files/*` 提供

## 前置要求

- **File Manager** >= 3.0.0（`ctx.router.addRoute` 的 `requiresAuth` 路由拦截、`ctx.config.get/updatePlugin`、`ctx.api.fileIO`、`ctx.services.fileIO`）
- **Node.js** >= 22

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer
# 同时安装子插件（按需）：
npm install @mqn00/file-manager-plugin-file-code-viewer @mqn00/file-manager-plugin-file-music-viewer \
  @mqn00/file-manager-plugin-file-video-viewer @mqn00/file-manager-plugin-file-image-viewer \
  @mqn00/file-manager-plugin-file-office-viewer @mqn00/file-manager-plugin-file-binary-viewer \
  @mqn00/file-manager-plugin-file-markdown-viewer
```

在 `config.yml` 中启用（子插件通过 `fileManagerPlugin.dependsOn: ["file-viewer"]` 保证在核心之后加载，无需手动排序）：

```yaml
plugins:
  file-viewer:
    enabled: true
    source: local   # 本地开发目录；npm 安装后改为 npm
  file-code-viewer:
    enabled: true
    source: local
  # ... 其余子插件同理
```

`extensionMappings` 首次保存前可省略（缺省时使用各查看器注册的默认后缀）。

## 使用

1. **配置主页**：插件管理页「打开页面」→ `/plugin/file-viewer`，或任意查看页头部「查看器设置」按钮。每个查看器一行：编辑后缀列表、`还原默认` 恢复该查看器注册的后缀；保存后写入 config.yml 并立即生效
2. 进入文件列表，**单击**文件名（非文件夹）→ 自动打开 `/plugin/file-viewer/view?path=...&mode=...` 查看页
3. 查看页头部有"打开方式"下拉：可切换到该文件可用的其他查看模块（如代码 → 十六进制），选择会被记住（localStorage），下次单击同名后缀文件时优先使用
4. 未登录访问查看页/配置页会被重定向到登录页（路由 `requiresAuth`）

### 打开方式优先级

```
URL 指定 mode > 页面内选择（localStorage） > config.yml 映射（extensionMappings） > 注册表默认
```

### 默认打开方式映射表（注册表默认，可在配置主页覆盖）

| 扩展名 | 默认模块 | 页面内可切换 |
|---|---|---|
| 代码/文本后缀（ts/js/vue/json/txt/py 等） | 代码编辑器（file-code-viewer） | 十六进制 |
| mp3/wav/flac/ogg/m4a/aac/opus | 音乐播放器（file-music-viewer） | 十六进制 |
| mp4/webm/mkv/avi/mov/flv/m4v/wmv | 视频播放器（file-video-viewer） | 十六进制 |
| png/jpg/jpeg/gif/webp/svg/bmp/ico/avif/tiff/heic 等 | 图片查看器（file-image-viewer） | 十六进制 |
| pdf/docx/doc/xlsx/xls/pptx/ppt | 办公文档查看器（file-office-viewer） | 十六进制 |
| 其他全部（未知扩展名） | 十六进制查看器（file-binary-viewer，兜底） | — |

> 注：`.md` 同时被 `file-code-viewer` 与 `file-markdown-viewer` 注册，默认打开方式取决于二者前端加载顺序；若需固定，可在配置主页（扩展名→查看器映射）显式指定，或在查看页「打开方式」中手动切换并记住选择。

## 类名前缀约定

file-viewer 系插件注入的 `<style>` 是全局样式，为防与其他插件 / 主项目类名冲突，**所有类名必须带插件专属前缀**：

| 插件 | 前缀 |
|---|---|
| file-viewer（核心） | `fv-` |
| file-code-viewer | `fcv-` |
| file-image-viewer | `fiv-` |
| file-video-viewer | `fvv-` |
| file-music-viewer | `fmu-` |
| file-office-viewer | `fov-` |
| file-binary-viewer | `fbv-` |

其他主项目插件前缀：compress (`fcp-`)、system-info (`fci-`)。

## 服务架构

file-viewer 是主项目文件打开契约（`ctx.platform.fileOpen`）的**唯一注册者**，子查看插件（file-image-viewer 等）不直接注册 fileOpen，而是通过后端服务向 file-viewer 报备能力，由 file-viewer 统一注册和分发：

```
子插件 ──① 后端 registerViewer(meta)──▶ file-viewer 核心（注册服务）
子插件 ──② 自有托管服务 dependsOn 'viewers' ──▶ 平台（级联生命周期）
file-viewer ──③ 唯一 fileOpen handler ──▶ 平台（文件打开分发）
```

### ① 子插件报备能力（后端 install）

```ts
ctx.getService('file-viewer:viewers').registerViewer({
  id: 'image',                    // 查看器唯一标识
  label: '图片查看器',              // 配置页显示名
  defaultExtensions: ['png','jpg'], // 默认可打开后缀（配置表可改写）
  route: '/plugin/image/view',     // 子插件提供的查看页路由
})
```

### ② 托管服务依赖（级联生命周期）

子插件通过 `dependsOn: ['viewers']` 声明对 file-viewer 的 `viewers` 服务依赖：

```ts
ctx.manageService('image-viewer', {
  canAutoStart: async () => true,
  start: async () => {},
  stop: async () => {},
  isRunning: async () => true,
})
ctx.startService('image-viewer')
```

file-viewer 卸载时平台自动级联停/卸依赖它的子插件。

### ③ file-viewer 唯一 fileOpen

file-viewer 注册平台 fileOpen handler，根据可编辑的扩展名映射表（config.yml `extensionMappings` + `defaultViewer`）解析最佳查看器，`router.push` 到子插件查看页。

### 子插件查看页路由约定

`/plugin/<id>/view?path=<文件路径>`，子插件自行渲染组件（不再由中央页 `<component :is>` 渲染）。file-viewer 提供最小页面外壳参考（返回按钮 + 文件信息 + 组件渲染）。

## 查看器注册表契约（第三方接入点）

核心在 `globalThis.__fm_file_viewer_registry__` 上维护注册表。子插件在前端 `install()` 时调用：

```ts
const registry = getRegistry() // globalThis.__fm_file_viewer_registry__
registry.register({
  id: 'code',             // 唯一标识，同时作为 URL query 的 mode 值
  label: '代码编辑器',      // 下拉/配置页显示名
  extensions: ['ts', 'js'], // 默认支持后缀（小写、不含点）；空数组 = 兜底模块
  editable: true,          // 是否可编辑保存（页面头部按此显示保存按钮）
  component: defineComponent({ /* props: { file: FileItem } */ }),
})
```

- 模块组件 **props 仅一个 `{ file: FileItem }`**；文件内容/保存/令牌由组件内部调用平台 I/O 完成（见下）
- `getApplicable(ext)` 返回扩展名命中的模块 + 兜底模块；`getDefault(ext)` 按「config 映射 > 注册表命中 > 兜底」解析
- 配置页保存时调用 `registry.setConfigMappings(map)` 同步全局解析；查看页在**打开时**读取注册表，与插件加载顺序解耦

## 平台文件 I/O（主项目提供，子插件直接使用）

file-viewer 后端只提供配置 API（`/api/file-viewer/config`），**不提供**任何文件读写。文件读写是主项目平台能力：

| 路由 | 鉴权 | 说明 |
|---|---|---|
| `GET /api/files/read?path=&offset=&length=` | Bearer | 二进制透传读取，返回 `{offset,length,size,data:base64}`；省略 offset/length = 整文件读取（截断到 8MB，`size` 返回真实大小）；传 offset/length = 分页读取。平台不判文本/二进制 |
| `POST /api/files/write` | Bearer | `{path, data(base64), offset?}` 二进制写回；省略 offset = 整文件覆盖（允许空内容清空文件），传 offset = 定位写入 |
| `POST /api/files/token` | Bearer | `{path}` → 30 分钟流令牌（绑定安全路径校验后的绝对路径） |
| `GET /api/files/stream?token=` | 公开（令牌） | Range 流式输出（206/200、Accept-Ranges、按扩展名 mime），供 `<audio>/<video>/<iframe>` 使用 |

子插件前端在 `install()` 中直接用 `ctx.api.fileIO`（`read` / `write` / `createToken` / `streamUrl` / `base64ToBytes` / `bytesToBase64`），子插件后端可用 `ctx.services.fileIO`：

```ts
const api = ctx.api.fileIO
// 文本应用（如代码编辑器）：平台只透传二进制，判断与解码由应用完成
const r = await api.read(props.file.path)            // { offset, length, size, data: base64 }
if (r.size > MY_LIMIT) { /* 应用自行判断"太大" */ }
const bytes = api.base64ToBytes(r.data)
if (bytes.subarray(0, 8192).includes(0)) { /* 应用自行判断二进制 */ }
const text = new TextDecoder('utf-8').decode(bytes)
// 保存：应用自行编码为字节后写回
await api.write(props.file.path, new TextEncoder().encode(text))
// 二进制应用（如 hex 编辑器）：分页读取 + 定位写入
await api.read(props.file.path, offset, 256 * 1024)
await api.write(props.file.path, nextBytes, pageOffset)
// 媒体/PDF：流式输出（无法携带 Bearer header）
const token = await api.createToken(props.file.path)
const src = api.streamUrl(token)            // <audio src>
```

> 主应用鉴权为 Bearer header，`<video>/<audio>/<iframe>` 无法携带 header，因此媒体/PDF 流统一走 `/token` + `/stream`。路径参数一律经主项目 `safePath` 校验，`..` 穿越会被拒绝。

> ⚠️ **迁移提示**：旧版 file-viewer 曾在插件内提供 `/api/file-viewer/read|write|bytes|write-range|token|stream`。这些路由已上收主项目并移除，未迁移的旧版子插件（image/video/music/office/binary）调用会 404，需升级到使用 `ctx.api.fileIO` 的新版本。

## 配置数据（config.yml）

```yaml
plugins:
  file-viewer:
    enabled: true
    extensionMappings:      # 可选；保存配置页时写入，缺省使用注册表默认
      ts: code
      md: code
      mp3: music
```

- 后缀键一律小写、不含点；值为查看器模块 id
- 未列出的后缀在打开文件时匹配首个声明它的查看器，否则回退兜底（hex）
- 映射指向未安装的查看器时自动回退注册表默认，配置页会提示并允许清除

## 与主应用的耦合说明（重要）

- 文件打开经**平台文件打开契约**（`ctx.platform.fileOpen`，v3.0.0+）：注册
  `{ id: 'file-viewer', canOpen(file), open(file) }` handler，主应用渲染文件列表时按
  `canOpen` 判定打 `is-openable` 标记、单击文件名时分发调用 `open()`。**本插件不再劫持
  document 点击事件、不再扫描主应用 DOM**；主应用重构文件列表 DOM 不影响本插件
- 可打开文件的高亮样式由本插件注入（`.file-name-text.is-openable`，`is-openable` 为主应用打的平台语义 class）；注册表变化（子插件加载/卸载）由主应用自动重算
- SPA 导航使用平台 `ctx.router.push` / `ctx.router.replace`（vue-router 原生处理 history / hash 双模式，未登录会被路由守卫拦截）

## 构建与发布

```bash
npm install          # 安装依赖（国内镜像：--registry=https://registry.npmmirror.com）
npm run build        # tsc 编译后端 + esbuild 打包前端 → dist/
npm test             # vitest 单测（注册表解析 + 配置 API）
node scripts/publish.mjs   # 构建并发布到 npm（自动 patch 递增版本号）
```

## 目录结构

```
src/
├── frontend.ts      # 文件打开 handler 注册 + 注册表初始化 + 双路由注册（配置主页 / 查看页）
├── backend.ts       # 配置 API（GET/PUT /api/file-viewer/config）
├── registry.ts      # 注册表 + 默认解析（含 config 映射优先级，纯逻辑，可单测）
├── config-page.ts   # 配置主页（按查看器分组编辑后缀列表）
├── config-api.ts    # 配置读写客户端
├── overrides.ts     # 打开方式用户覆盖（localStorage）
├── page.ts          # 查看页外壳（返回/文件名/打开方式下拉/模块渲染区）
├── backend.test.ts  # 配置 API 路由单测
└── registry.test.ts # 注册表单测（含 config 映射优先级）
```