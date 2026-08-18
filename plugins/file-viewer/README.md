# @mqn00/file-manager-plugin-file-viewer

File Manager 文件查看**核心插件**：劫持文件列表单击打开文件，维护查看器注册表并把渲染分发到各子查看插件（code / music / video / office / hex），同时提供子插件共用的文件 I/O 后端。

本插件**不内置任何查看模块**，只做分发；具体查看/编辑能力由子插件（如 `@mqn00/file-manager-plugin-file-code-viewer`）注册提供。首次安装时请同时安装至少一个子插件，否则查看页会提示"未安装任何查看插件"。

## 功能

- **单击劫持**：文件列表中单击文件名即打开查看页（文件夹双击导航不受影响）
- **注册表分发**：按扩展名解析默认查看模块，页面内可切换"打开方式"并记住选择
- **公共后端 I/O**：读/写文本、分页读写二进制、短期流令牌 + Range 流式输出，供各子插件消费

## 前置要求

- **File Manager** >= 3.0.0-beta7（用于 `ctx.router.addRoute` 的 `requiresAuth` 路由拦截与 `currentRoute`）
- **Node.js** >= 22

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer
# 同时安装子插件（按需）：
npm install @mqn00/file-manager-plugin-file-code-viewer @mqn00/file-manager-plugin-file-music-viewer \
  @mqn00/file-manager-plugin-file-video-viewer @mqn00/file-manager-plugin-file-office-viewer \
  @mqn00/file-manager-plugin-file-binary-viewer
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

## 使用

1. 进入文件列表，**单击**文件名（非文件夹）→ 自动打开 `/plugin/file-viewer?path=...&mode=...` 查看页
2. 查看页头部有"打开方式"下拉：可切换到该文件可用的其他查看模块（如代码 → 十六进制），选择会被记住（localStorage），下次单击同名后缀文件时优先使用
3. 未登录访问查看页会被重定向到登录页（路由 `requiresAuth`）

### 默认打开方式映射表

| 扩展名 | 默认模块 | 页面内可切换 |
|---|---|---|
| 代码/文本后缀（ts/js/vue/json/md/txt/py 等） | 代码编辑器（file-code-viewer） | 十六进制 |
| mp3/wav/flac/ogg/m4a/aac/opus | 音乐播放器（file-music-viewer） | 十六进制 |
| mp4/webm/mkv/avi/mov/flv/m4v/wmv | 视频播放器（file-video-viewer） | 十六进制 |
| pdf/docx/doc/xlsx/xls/pptx/ppt | 办公文档查看器（file-office-viewer） | 十六进制 |
| 其他全部（未知扩展名） | 十六进制查看器（file-binary-viewer，兜底） | — |

打开方式优先级：**URL 指定 mode > 用户覆盖（localStorage）> 注册表默认**。

## 查看器注册表契约（第三方接入点）

核心在 `globalThis.__fm_file_viewer_registry__` 上维护注册表。子插件在前端 `install()` 时调用：

```ts
const registry = getRegistry() // globalThis.__fm_file_viewer_registry__
registry.register({
  id: 'code',             // 唯一标识，同时作为 URL query 的 mode 值
  label: '代码编辑器',      // 下拉显示名
  extensions: ['ts', 'js'], // 支持后缀（小写、不含点）；空数组 = 兜底模块
  editable: true,          // 是否可编辑保存（页面头部按此显示保存按钮）
  component: defineComponent({ /* props: { file: FileItem } */ }),
})
```

- 模块组件 **props 仅一个 `{ file: FileItem }`**；文件内容/保存/令牌由组件内部调用核心后端 API 完成
- `getApplicable(ext)` 返回扩展名命中的模块 + 兜底模块；`getDefault(ext)` 返回首个命中模块或兜底模块
- 查看页在**打开时**读取注册表，与插件加载顺序解耦

## 公共后端 API

子插件在 `install()` 时可通过 `createViewerApi(ctx.api.instance)` 使用（核心包导出；子插件也可自行实现同构客户端，见各子插件源码）：

| 路由 | 鉴权 | 说明 |
|---|---|---|
| `GET /api/file-viewer/read?path=` | Bearer | 文本探测（前 8KB 含 NUL 判二进制）；≤8MB 返回 `{name,size,isText,content,encoding}`；二进制/超限返回 `{isText:false,reason}` |
| `POST /api/file-viewer/write` | Bearer | `{path, content, encoding}` 写回文本（≤8MB） |
| `GET /api/file-viewer/bytes?path=&offset=&length=` | Bearer | 分页读字节，`{data: base64}`，length ≤512KB |
| `POST /api/file-viewer/write-range` | Bearer | `{path, offset, data(base64)}` 定位写入（hex 保存） |
| `POST /api/file-viewer/token` | Bearer | `{path}` → 30 分钟流令牌（绑定安全路径校验后的绝对路径） |
| `GET /api/file-viewer/stream?token=` | 公开（令牌） | Range 流式输出（206/200、Accept-Ranges、按扩展名 mime），供 `<audio>/<video>/<iframe>` 使用 |

> 主应用鉴权为 Bearer header，`<video>/<audio>/<iframe>` 无法携带 header，因此媒体/PDF 流统一走 `/token` + `/stream`。路径参数一律经 `ctx.utils.path.safe()` 校验，`..` 穿越会被拒绝。

## 与主应用的耦合说明（重要）

- 单击劫持通过**捕获阶段** `document` 级 click 监听实现，匹配 `.file-name-text` 类名元素且**不含** `.is-folder`（broken 符号链接跳过）
- **主应用重构文件列表 DOM 时需保留 `file-name-text` / `is-folder` 类名**，否则本插件单击打开失效（文件列表类名位于主应用 `frontend/src/views/FileList.vue`）
- SPA 导航不刷新页面：`history.pushState` + 合成 `PopStateEvent`，vue-router 守卫照常生效（未登录会拦截）

## 构建与发布

```bash
npm install          # 安装依赖（国内镜像：--registry=https://registry.npmmirror.com）
npm run build        # tsc 编译后端 + esbuild 打包前端 → dist/
npm test             # vitest 单测（注册表解析 + 后端路由）
node scripts/publish.mjs   # 构建并发布到 npm（自动 patch 递增版本号）
```

## 目录结构

```
src/
├── frontend.ts      # 单击劫持 + 注册表初始化 + 查看页路由（requiresAuth）
├── backend.ts       # 公共文件 I/O 路由（read/write/bytes/write-range/token/stream）
├── registry.ts      # 注册表 + 默认解析（纯逻辑，可单测）
├── overrides.ts     # 打开方式用户覆盖（localStorage）
├── page.ts          # 查看页外壳（返回/文件名/打开方式下拉/模块渲染区）
├── api.ts           # 前端 API 客户端（子插件可复用）
├── backend.test.ts  # 后端路由单测
└── registry.test.ts # 注册表单测
```