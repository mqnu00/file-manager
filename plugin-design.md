# 插件编写规范

本文档归纳 file-manager 插件系统的开发规范，供插件开发者参考。示例插件：`plugins/test`（功能演示）。

## 一、插件是什么

插件是前后端一体化的扩展包：

- **后端**：CJS 模块，export `install(ctx)` 函数，可注册路由、共享服务、托管服务
- **前端**：esbuild 打包的浏览器 ESM，export `install(ctx)` 函数，可注册页面、主题等
- 打包为 npm 包（`keywords` 含 `file-manager-plugin`），或在 `plugins/` 目录本地开发

插件安装/启用后由主项目运行时加载：后端 `require()` 动态导入并调用 `install(ctx)`，前端经 `/plugins-assets/` 静态资源 URL 由浏览器 `import()` 动态导入并调用 `install(ctx)`。

## 二、package.json 规范

```jsonc
{
  "name": "@mqn00/file-manager-plugin-test",   // npm 包名
  "version": "0.3.0",
  "description": "…",
  "license": "MIT",
  "main": "dist/backend.js",                    // 后端 CJS 入口（加载器默认值）
  "exports": {
    ".": "./dist/backend.js",                   // 后端入口
    "./frontend": "./dist/frontend.js"          // 前端入口（exports 子路径）
  },
  "files": ["dist", "README.md"],               // 发布内容，assets 等资源需一并列出
  "scripts": {
    "build": "tsc && node build.mjs",           // tsc 编译后端(CJS) + esbuild 打包前端(ESM)
    "dev": "tsc --watch",                       // 仅监听后端；前端改动需重新 build
    "prepublishOnly": "npm run build",
    "publish:npm": "node scripts/publish.mjs"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/mqnu00/file-manager.git",
    "directory": "plugins/test"                 // 插件在仓库中的子目录
  },
  "keywords": ["file-manager", "file-manager-plugin", "…"],
  "peerDependencies": {
    "@mqn00/file-manager": "^3.0.0"             // 声明依赖的主项目版本，编译时解析类型
  },
  "devDependencies": {
    "@mqn00/file-manager": "file:../../backend",// 本地开发：引用主项目源码
    "esbuild": "^0.28.1",
    "typescript": "^5.4.0"
  },
  "publishConfig": {
    "access": "public"                          // scoped 包默认 restricted，必须显式 public
  }
}
```

要点：

- **包名**：以 `file-manager-plugin-` 开头（scoped 亦可，如 `@scope/file-manager-plugin-x`）。应用内插件名（config.yml 键）由包名派生：去掉 `file-manager-plugin-` 前缀、scoped 包取 `/` 后的部分。例如 `@mqn00/file-manager-plugin-test` → 短名 `test`
- **`fileManagerPlugin` 字段**（可选）：插件清单声明，见下文「插件配置与依赖」
- **npm registry 镜像**：安装依赖必须加 `--registry=https://registry.npmmirror.com`

## 三、目录结构

```
plugins/<name>/
├── src/
│   ├── backend.ts          # 后端入口：export install(ctx)
│   ├── frontend.ts         # 前端入口：export install(ctx)（可选，无前端功能可不提供）
│   └── …                   # 其他模块（如 service.ts）
├── assets/                 # 静态资源（图片等），需列入 package.json files
├── scripts/
│   └── publish.mjs         # 发布脚本
├── build.mjs               # esbuild 打包前端
├── tsconfig.json           # NodeNext：后端编译为 CJS
└── package.json
```

## 四、后端插件（src/backend.ts）

### install 函数

```ts
import type { BackendPluginContext, PluginInstallFunction, Request, Response } from '@mqn00/file-manager/plugin'

export const install: PluginInstallFunction<BackendPluginContext> = (ctx) => {
  // …注册路由、服务…
}
```

- 类型从 `@mqn00/file-manager/plugin` 导入（express 类型由该入口 re-export，插件无需直接依赖 express）
- 加载器兼容多种导出模式：函数直出（`export default function`）、`exports.install`、`exports.default`
- **v3 起后端统一 CJS 加载，不支持 ESM**：package.json 不得声明 `"type": "module"`；tsconfig 用 NodeNext，相对导入必须带 `.js` 扩展名

### ctx 能力

| API | 说明 |
|---|---|
| `ctx.app` | Express Router，插件路由挂载点（插件只能注册路由，不能启动服务器） |
| `ctx.express` | express 命名空间，用 `ctx.express.Router()` 创建子路由 |
| `ctx.middleware.auth` | 认证中间件，校验 `Authorization: Bearer <token>`；敏感路由应挂载：`ctx.app.use('/api/xxx', ctx.middleware.auth, router)` |
| `ctx.registerService(name, impl)` | 注册插件间共享服务；重名抛错，卸载时自动清理 |
| `ctx.getService(name)` | 获取其他插件注册的服务；未注册抛错 |
| `ctx.manageService(name, spec)` | 注册托管服务（见「托管服务」） |
| `ctx.startService(name)` / `ctx.stopService(name)` | 启动/停止托管服务，并持久化 config 的 `startedServices` |
| `ctx.waitForService(name, opts)` | 等待服务达到状态（默认运行中），超时抛错 |
| `ctx.isServiceRunning(name)` | 查询托管服务是否运行 |
| `ctx.utils.logger.log(level, tag, message)` | 日志（level: INFO/WARNING/ERROR） |
| `ctx.utils.path.safe(filePath)` | 路径安全校验（防穿越），返回规范化绝对路径 |
| `ctx.utils.path.getStorageRoot()` | 获取配置的存储根目录 |
| `ctx.utils.path.calculateDirSize(dirPath)` | 递归计算目录大小（字节） |
| `ctx.dataDir` | 插件私有数据目录绝对路径（惰性创建）。缓存文件、二进制大文件等可直接在此写文件 |
| `ctx.storage` | 结构化 KV 存储（JSON 序列化，落盘 `<dataDir>/store.json`）。方法：`get<T>`/`set`/`delete`/`has`/`keys`/`all`；键禁止路径分隔符、值必须可 JSON 序列化 |
| `ctx.services.task` | 后端任务系统（见「后端任务系统接入」）：`createExternal`/`signal`/`updateProgress`/`finalize` 等 |
| `ctx.services.fileIO` | 通用文件 I/O 原语（文本读/写、字节分页读/定位写、流令牌 + Range），供查看器类插件共享 |
| `ctx.services.file` | 文件操作服务层（列目录、复制/移动/删除等核心操作） |

路由注册示例：

```ts
const router = ctx.express.Router()
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})
ctx.app.use('/api/plugin/test', router)
```

### 读取自身版本信息

插件读取自身 package.json 用 `require('../package.json')`（CJS 产物在 dist/，package.json 在上一级）。热重载 cacheBust 临时目录场景下读取可能失败，需兜底。

### 托管服务

```ts
ctx.manageService('test-service', {
  start,                                   // 启动服务，返回值透传给调用方
  stop,                                    // 停止服务
  isRunning: () => …,                      // 当前是否运行
  canAutoStart: () => …,                   // 可选：自动启动预检，false 则跳过
  dependsOn: ['other-service'],            // 可选：启动前需已运行的服务
})
```

- 启停通过 `ctx.startService`/`ctx.stopService` 走托管包装（持久化 `startedServices`），重启文件管理器后由 `startConfiguredServices()` 自动恢复
- 服务级依赖（`dependsOn`）按拓扑分层启动；跨层/未声明的依赖由 `waitForService` 兜底等待
- `canAutoStart` 用于避免假启动，如 smb 用 `sudo -n true` 探测无密码 sudo，避免 PTY 挂起等待密码

### 后端任务系统接入（v3.0.0）

插件可通过 `ctx.services.task` 将耗时操作接入主项目的后台任务系统（TaskPanel 统一展示进度、速度、当前文件、取消按钮）：

| API | 说明 |
|---|---|
| `ctx.services.task.createExternal(type, metadata, opts)` | 创建外部任务条目（仅建条目不自动执行），返回 `{ id, metadata }`。`type` 为任务类型，`metadata` 为自定义元数据，`opts` 含 `phase`/`totalCount`/`completedCount` 等初始状态。同类型 + 同 targetPath 的未完成任务视为冲突（抛 `TASK_CONFLICT`） |
| `ctx.services.task.signal(taskId)` | 取任务的 `AbortSignal`（执行器通过 `signal.aborted` 或监听 `abort` 事件响应取消） |
| `ctx.services.task.updateProgress(taskId, patch)` | 更新任务进度/字段（广播 SSE + 持久化）。`patch` 含 `progress`/`speed`/`totalSize`/`currentFile`/`completedCount`/`totalCount`/`metadata` 等 |
| `ctx.services.task.finalize(taskId, status, extra?)` | 任务终态收尾：`'completed'`（进度置 100）、`'failed'`（记 error）、`'cancelled'`（广播取消事件），3 秒后自动从列表移除 |

**前端对接**：前端插件在 `install(ctx)` 中用 `ctx.stores.task.attachTask(taskId, taskInfo, onComplete?)` 挂载任务——TaskPanel 自动展示进度/取消按钮，完成/失败后触发回调。具体用法参考 `plugins/compress`。

## 五、前端插件（src/frontend.ts）

### 加载机制

插件前端产物（`dist/frontend.js`，esbuild 打包的独立 ESM 文件）由后端作为静态资源暴露，浏览器在运行时动态加载：

1. 后端 `GET /api/plugins` 返回启用插件列表，`frontendPath` 由 `exports["./frontend"]` 相对路径拼出：`/plugins-assets/<短名>/<路径去掉 ./ 前缀>`，如 `/plugins-assets/hatsune-miku-theme/dist/frontend.js`
2. 浏览器对该 URL 执行原生动态导入（插件 URL 运行时才可知，须加 `/* @vite-ignore */` 让 Vite 跳过静态分析）：

```ts
const mod = await import(/* @vite-ignore */ frontendPath)
```

3. 从模块命名空间提取 `install`（兼容 `mod.install`、`mod.default` 函数、`mod.default.install` 三种导出写法），调用 `await install(ctx)` 完成注册
4. URL 追加 `?_t=<时间戳>` 做缓存破坏：安装/切换版本后 URL 不变但内容已变，强制浏览器重新拉取
5. 单个插件加载失败仅记录日志，不影响其他插件及主功能

### install 函数与硬约束

```ts
import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

export const install: FrontendPluginInstallFunction = (ctx) => {
  const { h, ref, defineComponent } = ctx.Vue
  const { ElButton, ElMessage } = ctx.ElementPlus
  // …
  // 页面需要登录时声明 requiresAuth: true（未登录访问重定向到登录页，登录后跳回）
  ctx.router.addRoute({ path: '/plugin/test', component: PageComponent, meta: { requiresAuth: true } })
}
```

- 类型从 `@mqn00/file-manager/plugin/frontend` 导入
- **不得直接 `import vue` / `import element-plus`** —— 所有依赖通过 ctx 获取。前端产物是零外部依赖的独立 JS 文件（esbuild 打包时 `external: ['@mqn00/file-manager/plugin/frontend']`，该导入仅为类型，无运行时依赖）
- 页面用 `h()` 渲染函数 + `defineComponent` 编写（插件不走 SFC/模板编译）
- 页面路由用 `ctx.router.addRoute(route)` 注册，`route` 类型为 `PluginRouteRecord`（由 `@mqn00/file-manager/plugin/frontend` 导出），建议路径 `plugin/<短名>` 或 `/plugin/<短名>`
- **注册了页面路由的插件，必须在 package.json 的 `fileManagerPlugin` 中声明 `frontendPage`（路由路径）**，否则插件管理页不显示「进入前端」按钮
- 页面需要登录时在 `addRoute` 中声明 `meta: { requiresAuth: true }`：未登录访问该页面会被主项目路由守卫重定向到登录页（登录后自动跳回原页面）；纯主题/公开页面不声明即默认放行。插件前端资源（JS/静态图）的加载不受影响，是否拦截由插件自行声明决定
- `addRoute` 返回注销函数（插件 teardown 用）

### ctx 能力

| API | 说明 |
|---|---|
| `ctx.Vue` | Vue 核心库命名空间（`h`、`ref`、`defineComponent`、`onMounted` 等） |
| `ctx.ElementPlus` | Element Plus 完整命名空间（组件 + 工具函数） |
| `ctx.stores` | Pinia stores：`auth` / `file` / `task`。`task` store 提供 `attachTask(taskId, info, onComplete?)` 方法，用于挂载插件后端通过 `ctx.services.task.createExternal` 创建的后台任务——前端据此在 TaskPanel 中展示进度/取消按钮（见「后端任务系统接入」） |
| `ctx.api` | axios 实例（`instance`，已配认证拦截器）+ `auth` / `file` / `fileIO` / `config` / `task` API 模块。`fileIO` 提供通用文件二进制读写（纯二进制透传，文本/二进制/大小判断由插件自行完成） |
| `ctx.composables` | `useTheme` / `useContextMenu` / `useFileProgress` / `useFileSort` |
| `ctx.platform` | 平台扩展注册表：`fileOpen`（文件打开钩子，见「文件打开契约」）；`PLUGINS_CHANGED_EVENT`（插件集合变化事件名，加载/卸载/重载完成后广播，插件可监听此事件响应其他插件的状态变化） |
| `ctx.pluginData` | 按插件隔离的 KV 数据（接口与后端 `ctx.storage` 对应：`get`/`set`/`remove`/`all`）。正式环境经已认证的 HTTP 调用后端 `ctx.storage`；Demo 模式降级为 localStorage 垫片 |
| `ctx.utils` | `formatSize` / `formatTime` / `formatSpeed` / `formatProgress` |
| `ctx.constants` | 存储键、主题常量、`API_BASE_URL` |
| `ctx.router` | `createRouter` / `createWebHistory` / `createWebHashHistory` / `addRoute` / `push` / `replace` / `currentRoute` |

### 文件打开契约（fileOpen）

平台提供 `ctx.platform.fileOpen` 作为「文件打开」的通用钩子。插件注册 `{ id, canOpen(file), open(file) }` 声明"能打开哪些文件"：

- 主应用渲染时对可打开文件打 `is-openable` class（**平台语义 class**，样式由插件自行注入）；注册表变化（插件加载/卸载）时自动重算
- `FileOpenHandler` 支持 `isOpenable?(file)` 可选方法：将「能打开」（`canOpen`）和「应标记」（`isOpenable`）分离——如默认打开器打开的文件不标蓝。缺省时等同 `canOpen`
- 平台侧实现（`frontend/src/platform/fileOpen.ts`）与类型声明（`@mqn00/file-manager/plugin/frontend`）保持同步
- **file-viewer 是平台 fileOpen 的唯一注册者**：子查看插件（file-image-viewer 等）不直接注册 fileOpen，而是通过后端服务向 file-viewer 报备能力，由 file-viewer 统一注册和分发。具体架构见 `plugins/file-viewer/README.md`

**FileOpenApi 完整接口**（`ctx.platform.fileOpen`）：

| 方法 | 说明 |
|---|---|
| `register(handler)` | 注册 handler（同 id 覆盖替换），返回注销函数 |
| `unregister(id)` | 按 id 移除已注册 handler（插件 teardown 用），不存在则 no-op |
| `resolve(file)` | 按注册序返回第一个 `canOpen` 命中的 handler，无则 `null` |
| `list()` | 当前全部 handler（注册顺序） |
| `subscribe(fn)` | 注册表变化订阅（插件加载/卸载时触发），返回取消订阅函数 |
| `refresh()` | 主动触发重算：handler 内部能力来源变化但 handler 本身未增删时通知主应用重算 `is-openable` 标记 |

### SPA 导航（router.push / replace）

- `ctx.router.push(to)` / `ctx.router.replace(to)`：编程式导航，vue-router 原生处理 history / hash（demo）双模式；**禁止**再使用 `history.pushState + PopStateEvent` hack（历史栈语义与 hash 模式均不正确）
- 查看器"上一张/下一张"等原地切换场景用 `replace`，避免历史栈膨胀使"返回"失效
- 页面路由注册仍用 `ctx.router.addRoute`

### 通用文件 I/O（ctx.api.fileIO）

查看器类插件通过 `ctx.api.fileIO` 读写文件二进制，平台只做**纯二进制透传**（返回 base64 编码的原始字节 + 文件总大小），文本/二进制/大小判断由消费方插件自行完成：

| 方法 | 说明 |
|---|---|
| `read(path, offset?, length?)` | 读取文件二进制。省略 offset/length = 整文件读取（截断到 8MB，`size` 返回真实大小）；传 offset/length = 分页读取。返回 `{ offset, length, size, data: base64 }` |
| `write(path, data, offset?)` | 写回文件二进制。省略 offset = 整文件覆盖（允许空内容清空文件）；传 offset = 定位写入 |
| `createToken(path)` | 签发流令牌（30 分钟有效，可多次使用，供 `<video>`/`<audio>`/`<iframe>` 等无法带 header 的场景） |
| `streamUrl(token)` | 构造流式 URL（需携带令牌参数） |
| `base64ToBytes(base64)` | 将 base64 解码为 `Uint8Array` |
| `bytesToBase64(bytes)` | 将 `Uint8Array` 编码为 base64 |

**典型用法**（图片查看器的流式加载）：

```ts
// 1. 签发流令牌
const token = await ctx.api.fileIO.createToken(file.path)

// 2. 构造流式 URL（配合 Range 请求实现大图分片加载）
const url = ctx.api.fileIO.streamUrl(token)

// 3. 在 <img src> 或 fetch 中使用
```

### 平台挂载点（window 注册表）

主应用提供多个全局注册表，插件 install 时注册可扩展能力（模块求值即挂到 window，主应用在 `initPlugins()` 前经 `main.ts` 静态 import 保证就绪；重复注册按 id 幂等覆盖，`unregister(id)` 供插件 teardown 移除）：

| 挂载点 | 用途 | 注册项（类型入口已发布） |
|---|---|---|
| `window.__fm_bulk_actions` | 文件批量操作栏按钮（如压缩） | `BulkAction`（`visible(count, hasFolder)` + `run(selected, infos, currentPath)`） |
| `window.__fm_nav_actions` | 顶栏页面导航图标按钮（如系统信息） | `NavAction`（`{ id, label, path, icon? }`，`icon` 为图标组件，点击 `router.push(path)`） |
| `window.__fm_file_open` | 文件打开钩子 | `FileOpenHandler`（见「文件打开契约」） |

**类型契约（v3.0.0 起）**：挂载点的注册项与注册表 API 类型均由类型入口 `@mqn00/file-manager/plugin/frontend`
发布——`BulkActionVisibility` / `BulkActionContext` / `BulkAction` / `BulkActionsApi`、`NavAction` / `NavActionsApi`。
插件**直接类型导入，不要本地重复声明**：

```ts
import type { BulkAction } from '@mqn00/file-manager/plugin/frontend'

// window 扩展由发布入口 declare global 声明（可选属性），运行时读全局无需任何强转；
// 判空守卫兼容旧主应用（无该注册表）时降级
const api = window.__fm_bulk_actions
if (!api || typeof api.register !== 'function') {
  console.warn('[my-plugin] 主应用未暴露批量操作注册表，功能不可用')
  return
}
api.register({ id: 'my-op', label: '我的操作', visible: (p) => p.count > 0, run: (p) => { /* … */ } })
```

发布类型与主应用真实实现经 `frontend/test/types-sync.test-d.ts` **双向断言**防漂移（漂移即编译失败）。

**注册表完整 API**：

| 挂载点 | 方法 | 说明 |
|---|---|---|
| `__fm_bulk_actions` | `register(action)` | 注册操作（同 id 覆盖替换） |
| | `unregister(id)` | 按 id 移除（插件 teardown 用），不存在则 no-op |
| | `list()` | 当前全部操作（注册顺序） |
| | `subscribe(fn)` | 注册表变化订阅，返回取消订阅函数 |
| `__fm_nav_actions` | `register(action)` | 注册导航项（同 id 覆盖替换） |
| | `unregister(id)` | 按 id 移除（插件 teardown 用），不存在则 no-op |
| | `list()` | 当前全部导航项（注册顺序） |
| | `subscribe(fn)` | 注册表变化订阅，返回取消订阅函数 |

**Window 全局类型声明**：三个挂载点均有类型化的 window 扩展（`window.__fm_bulk_actions` /
`window.__fm_nav_actions` / `window.__fm_file_open`），由**两侧同步声明**：
- 主项目侧：`frontend/src/env.d.ts` 的 `declare global { interface Window { … } }`（与 `THREE`/`Vue`/`ElementPlus`/`__runScript` 同一块）；
- 插件侧：发布类型入口 `frontend-types.ts` 文件尾部的 `declare global`（插件 import 该入口即获得）。

两侧对同一属性的声明经 **interface 合并**强制结构一致（类型不一致直接编译失败）。
属性声明为**可选**（`?:`）：主应用 v3.0.0 起保证提供，但插件可能需要兼容更旧主应用——
访问前判空并降级（见上例）。不需要再写 `(window as unknown as Record<string, unknown>)['__fm_xxx']` 之类强转。

> **卸载清理**：注册表均提供 `unregister(id)`（v3.0.0）；插件在 teardown 中调用（详见「前端卸载与 teardown 契约」）。`fileOpen` 的 handler 除插件自行注销外，平台在卸载时也会收集兜底清理。

**插件集合变化事件**：`ctx.platform.PLUGINS_CHANGED_EVENT` 是一个自定义事件名（`'fm:plugins-changed'`），主应用在加载/卸载/重载插件完成后通过 `window.dispatchEvent` 广播。其他插件可监听此事件响应状态变化：

```ts
window.addEventListener(ctx.platform.PLUGINS_CHANGED_EVENT, () => {
  // 重新查询其他插件状态
  refreshViewerList()
})
```

### 插件数据目录（v3.0.0）

插件常需持久化自己的业务数据（配置、缓存、状态标记等）。主项目为插件提供**按短名隔离、跨重启保留**的本地存储，分两层：

- **后端**（`install(ctx)` 中经 `ctx` 访问，存于磁盘）：
  - `ctx.dataDir: string` —— 插件私有目录绝对路径（惰性 `mkdir`），可直接写缓存文件、二进制大文件。
  - `ctx.storage` —— 结构化 KV 存储（JSON 序列化，落盘 `<dataDir>/store.json`），方法：`get<T>(key)`、`set(key, value)`、`delete(key)`、`has(key)`、`keys()`、`all()`。
  - 约束：键禁止 `/` `\` `.` `..`（防越目录）；值必须可 JSON 序列化（函数 / `undefined` 等会抛错）；单进程内串行读写，适合配置型小数据；大/二进制数据请直接用 `ctx.dataDir` 写文件。
- **前端**（`install(ctx)` 中经 `ctx.pluginData` 访问，因为浏览器无文件系统）：
  - `ctx.pluginData` —— KV 接口与后端一致：`get<T>(key)`、`set(key, value)`、`remove(key)`、`all()`。
  - 正式环境经已认证的 HTTP 调用后端 `ctx.storage`（`GET/PUT/DELETE /api/plugins/<名>/data[/<键>]`，详见 `API.md`）；Demo 模式（无后端）降级为 `localStorage` 垫片（键前缀 `fm-plugin-data:<名>:`）。
  - 前端仅提供 KV，无 `dataDir` 等价物；需要落盘大文件时由插件后端经 `ctx.dataDir` 处理。

**生命周期**：
- 首次访问时惰性创建，不预先为空插件建目录；
- 卸载（unload）/ 进程重启均**保留**数据；
- 仅当**删除插件且显式勾选"同时删除本地数据目录"**时（`DELETE /api/plugins/<名>?clearData=1`）才清除；unload 不删。

后端示例：

```ts
export const install: PluginInstallFunction = (ctx) => {
  // 结构化配置
  ctx.storage.set('lastSyncAt', Date.now())
  const t = ctx.storage.get<number>('lastSyncAt')
  // 原始文件缓存
  fs.writeFileSync(path.join(ctx.dataDir, 'cache.bin'), buf)
}
```

前端示例：

```ts
export const install: FrontendPluginInstallFunction = (ctx) => {
  await ctx.pluginData.set('draft', { text: '…' })
  const draft = await ctx.pluginData.get<{ text: string }>('draft')
}
```

### 主题注册（registerTheme）

```ts
ctx.composables.useTheme().registerTheme({
  name: 'midnight',        // 主题唯一标识，同时是 localStorage 持久化值
  label: '午夜',           // 工具栏下拉框显示名
  className: 'midnight',   // 应用到 <html> 的类（选择器对应）
  css: `                  // 样式文本，主项目注入 <style data-theme="name">
html.midnight {
  --app-bg: #0d1117;
  --app-accent: #58a6ff;
  /* 覆盖 --app-* 核心变量 + Element Plus 变量（如 --el-color-primary-light-9） */
}
`,
})
```

- 安装插件后主题下拉框自动出现该选项，切换即生效并持久化
- 主题通过覆盖 `--app-*` CSS 变量与 Element Plus 变量实现，选择器写 `html.<className>`
- 自带资源（图片等）经 `/plugins-assets/<短名>/assets/...` 引用，需将 `assets/` 列入 package.json `files` 随包发布
- 纯前端主题插件（无后端功能）仍需提供最小后端入口（空 `install`）满足加载器要求

### 前端卸载与 teardown 契约（v3.0.0）

**插件生命周期**：后端插件有完整的加载/卸载/重载生命周期；前端插件自 v3.0.0 起补齐——

**后端 teardown 契约（与前端对称）**：后端 `install(ctx)` 同样可返回 **teardown 函数**，供插件撤销 install 期间产生的、平台不代管的全局副作用（如经其他插件注册表报备的能力——查看器注册等）。`PluginInstallFunction` 的返回类型已放宽（`void | Promise<void> | PluginTeardown | Promise<PluginTeardown>`）。平台在 `unloadPlugin` / `reloadPlugin` 时按「托管服务停止 → **插件 teardown** → 路由层移除 → 注册服务清理」顺序执行，teardown 抛错仅记日志不阻断。

`install(ctx)` 的返回值可扩展为 **teardown 函数**：

```ts
export const install: FrontendPluginInstallFunction = (ctx) => {
  const unregister = registry.register(module)   // 例：查看器注册表
  document.addEventListener('click', handler, true)

  // teardown 契约：撤销 install 期间的全局副作用
  return () => {
    unregister()
    document.removeEventListener('click', handler, true)
    document.getElementById('my-plugin-style')?.remove()
  }
}
```

- **返回 teardown = 插件声明「install 期间的全局副作用由我撤销」**；不返回 = 声明无全局副作用（路由由平台代管）。`FrontendPluginInstallFunction` 类型已放宽返回值。
- **平台自动收集并清理两类资源**（插件无需自己处理）：
  1. `ctx.router.addRoute` 注册的路由 —— 卸载时逐个移除；
  2. `ctx.composables.useTheme().registerTheme` 注册的主题 —— 卸载时逐个 `unregisterTheme(name)`（列表项 + 注入的 `<style>`，若为当前活动主题则回退默认并持久化）。
- **teardown 的职责**（平台不代管的）：
  - 移除 document/window 上的事件监听与 MutationObserver；
  - 注销 window 注册表条目（`__fm_bulk_actions.unregister(id)` / `__fm_nav_actions.unregister(id)`，v3.0.0 提供）；
  - 移除自注入的 `<style>`；关闭自挂载的 `createApp` 对话框（`unmount()` + 移除宿主节点）；
  - 子查看插件无需手动注销 fileOpen handler（平台自动收集）；其托管服务由平台级联停止。
- **卸载顺序**（平台执行）：路由移除 → 主题反注册 → 插件 teardown；任一步骤抛错仅记日志，不阻断其余步骤，也不影响后端卸载与其他插件。
- **重载/重复加载**：平台先调用旧实例 teardown 再重新 install（不再需要自造 `INSTALL_KEY` 之类全局清理标记）。
- **边界**：
  - 后端热重载（开发期 dist watcher）只重后端，前端保持不动，页面刷新后自然拿到新 bundle；
  - 卸载后端插件后前端实例立即清理，无需刷新页面；
  - demo 模式（gh-pages 纯前端）没有管理页入口，不存在卸载场景。
- 插件内 `useTheme().registerTheme` 与 `router.addRoute` 的返回值在卸载时由平台统一处理，插件不要在 teardown 里重复反注册（幂等无害但冗余）。

### 插件样式与主题适配（样式规范）

插件自带的容器/自定义元素不随主题自动换肤，需遵守以下规范才能在「白天 / 赛博 / 初音未来…」等主题下外观一致。

#### 1. 颜色只用主题令牌

主项目以 CSS 变量提供一套**主题令牌**，所有主题（含插件注册的主题）都通过覆盖这些变量换肤。插件样式**禁止硬编码颜色**（`#fff`、`rgb(...)`、`#ccc` 等），一律引用令牌并带 fallback，保证令牌缺失时仍可读：

```css
.my-panel {
  background: var(--app-panel-solid, #fff);
  color: var(--app-text, #333);
  border: 1px solid var(--app-border, #ccc);
}
```

令牌清单（`:root` 定义，暗色主题同名覆盖）：

| 令牌 | 语义 |
|---|---|
| `--app-bg` | 页面背景 |
| `--app-panel` | 面板背景（暗色主题可为半透明） |
| `--app-panel-solid` | 不透明面板背景（正文阅读区用这个） |
| `--app-border` | 边框 / 分割线 |
| `--app-text` / `--app-text-dim` / `--app-text-bright` | 正文 / 次要 / 标题文字 |
| `--app-accent` | 主强调色（按钮、高亮） |
| `--app-accent-bg` / `-bg-hover` / `-bg-subtle` | 强调色背景（强 / 中 / 弱） |
| `--app-accent-border` / `-border-light` | 强调色边框 |
| `--app-input-bg` | 输入控件背景 |
| `--app-shadow` / `--app-glow` / `--app-blur` | 阴影 / 辉光 / 磨砂 |
| `--app-mask-bg` | 遮罩背景 |
| `--app-table-header-bg` 等 `--app-table-*` | 表格细节 |
| `--app-checkbox-border` / `--app-select-caret` / `--app-scrollbar-*` | 对应组件细节 |

内联 `style`（`h('div', { style: { color: '...' } })`）同样只允许令牌引用。

#### 2. 暗色主题声明 color-scheme

`<video>`/`<audio>`、原生 `<input>`、Chromium 内置 PDF 查看器的控件外观由浏览器按 `color-scheme` 渲染。主项目内置暗色主题（`html.cyber`）已声明 `color-scheme: dark`；**插件注册的暗色主题必须在自己的 css 里同样声明**：

```css
html.my-theme { color-scheme: dark; }
```

否则暗色主题下原生控件仍是亮色，观感割裂（参考 `plugins/test` 示例）。

#### 3. 类名加插件前缀

插件注入的 `<style>` 是全局样式，为防与其他插件 / 主项目类名冲突，**所有类名必须带插件专属前缀**，禁止使用 `media-viewer`、`code-bar`、`hex-input` 这类通用词。各插件前缀约定见各自 README。

样式注入惯例：`install()` 时创建带稳定 id 的 `<style>` 标签，先查重后追加（插件卸载/热重载时同 id 覆盖或复用）：

```ts
function injectStyles(): void {
  if (document.getElementById('my-plugin-style')) return
  const style = document.createElement('style')
  style.id = 'my-plugin-style'
  style.textContent = `.mp-panel { ... }`
  document.head.appendChild(style)
}
```

#### 4. 第三方组件内部主题联动

Monaco、docx-preview、SheetJS、PDF 等库自带内部主题（不读 CSS 变量），需订阅主项目主题做组件级切换：

```ts
const theme = ctx.composables.useTheme()
watch(() => theme.activeTheme.value.name, () => {
  // 按当前主题切换第三方组件主题；className 为 '' 表示亮色（light）
  editor.setTheme(theme.activeTheme.value.className === '' ? 'vs' : 'vs-dark')
})
```

「是否暗色」以 `activeTheme.value.className` 是否为空判断，不要硬编码主题名；PDF/影片等中性色内容（如播放器黑底、PDF 灰底）保持惯例即可。

## 六、静态资源

- 后端静态服务：`/plugins-assets/<短名>/<包内相对路径>`（含路径穿越防护），如 `/plugins-assets/hatsune-miku-theme/assets/logo.png`
- 前端入口 URL 由 `exports["./frontend"]` 相对路径拼出：`/plugins-assets/<短名>/<frontendPath 去掉 ./ 前缀>`
- 前端插件的跨域约束：浏览器受 CSP `connect-src` 限制，不要直连插件自启的本地端口（如 127.0.0.1 服务），统一走同源后端接口由后端代发请求

## 七、插件配置与依赖（fileManagerPlugin 清单）

在 package.json 声明，供主项目安装时读取：

```jsonc
{
  "fileManagerPlugin": {
    "dependsOn": ["smb"],                      // 可选：依赖的其他插件短名（仅存在 + 拓扑顺序）
    "dependencies": {                           // 可选：依赖插件的最小版本约束（semver range）
      "smb": ">=1.0.0",                        //   key=依赖插件短名，value=要求的版本范围
      "compress": ">=0.4.0"
    },
    "minHostVersion": "^3.0.0",                // 可选：要求的主项目最低版本（semver range）
    "frontendPage": "/plugin/smb",             // 可选：前端配置页路由路径（见下）
    "config": {                                // 可选：自定义配置 schema
      "servicePort": {
        "type": "number",
        "default": 18765,
        "description": "服务端口",
        "required": false
      }
    }
  }
}
```

- `config` 字段类型：`string` / `number` / `boolean` / `array` / `object`；安装 npm 插件时默认值自动写入 config.yml（仅补充缺失字段，不覆盖已有配置值）
- `dependsOn` 对应 config.yml 的插件键：加载时做 Kahn 分层拓扑排序，同一层互不依赖可并行加载；缺失依赖/循环依赖会报错，依赖未加载时拒绝加载
- `dependencies`：依赖插件的**最小版本**约束（semver range）。与 `dependsOn` 的区别：`dependsOn` 只要求"存在"，`dependencies` 还要求"版本满足范围"。两者都会驱动拓扑加载顺序（取并集）。校验在三个时机触发（见下「兼容性校验」）
- `minHostVersion`：要求的主项目最低版本（semver range）。缺省时主项目回退读取 `peerDependencies["@mqn00/file-manager"]`；`file:`/`link:` 等路径型 peer 视为无约束（本地开发即当前源码）
- `frontendPage`：插件声明的前端配置页路由路径（如 `/plugin/smb`）。插件用 `ctx.router.addRoute` 注册了独立页面路由后须声明此字段，插件管理页才会显示「进入前端」按钮并跳转到该路径；**未声明的插件（即使有 `exports["./frontend"]` 前端模块）不显示按钮**。子插件（如 file-viewer 系查看器）无独立页面，无需声明

### 兼容性校验

主项目在**安装 / 运行时加载 / 启动自动加载**三处对插件做双轴兼容性校验（宿主版本 + 依赖插件），并按"硬阻塞 / 软提示"分级处理：

- **宿主版本轴**：校验当前主项目版本是否满足 `minHostVersion`（或回退的 peerDependencies 范围）。当前主项目为预发布版（如 `3.0.0-beta7`）时以 `includePrerelease` 规则判定，避免 `>=2.8.0` / `^3.0.0-beta5` 这类范围被误判为不满足。
- **依赖版本轴**：校验 `dependencies` 中每个依赖插件（含 `dependsOn` 中的名称）满足：① 已安装；② `enabled !== false`；③ 已启动（运行时已加载激活）；④ 版本满足声明的 semver range。不满足时区分四种状态：
  - `missing`：依赖插件未安装
  - `disabled`：已安装但未启用（`enabled: false`）
  - `not-started`：已安装、已启用，但当前未启动（未加载激活）——**依赖插件必须在 A 之前启动**
  - `mismatch`：已安装 / 已启用 / 已启动，但版本低于要求范围

**分级策略**：

- **硬阻塞（不允许加载）**：任一依赖处于 `missing` / `disabled` / `not-started`（依赖根本不可用）；**或**宿主版本不兼容 **且**同时存在依赖 `mismatch`（多方面不兼容）。
- **软提示（仍允许加载，仅告警）**：仅宿主版本偏低（依赖正常）；**或**仅依赖 `mismatch`（依赖已安装/已启用/已启动，只是版本偏低）。

行为：

| 时机 | 硬阻塞时 | 软提示时 |
|---|---|---|
| `POST /api/plugins/install`（安装） | `npm uninstall` 回滚 + 清配置，响应 `409` | 安装成功，响应带 `compatibilityWarning` 字段 |
| `POST /api/plugins/load`（运行时加载） | 响应 `409` + 原因 | 加载成功，响应带 `compatibilityWarning`，前端弹警告 |
| 启动 / `GET /api/plugins` 自动补载 | 跳过该插件并记 `ERROR` 日志 | 仍加载，记 `WARNING` 日志 |

插件管理页（`/plugins`）：硬阻塞插件显示红色「不兼容」标签（hover 显示具体原因），「加载」按钮禁用；软提示插件显示黄色「兼容警告」标签（hover 显示警告文案），可正常加载。

### config.yml 中的插件配置

```yaml
plugins:
  test:
    enabled: true          # 启用状态
    source: npm            # 'local' | 'npm'，持久化来源
    startedServices:       # 托管服务已启动列表（由 ctx.startService 维护，勿手改）
      - test-service
    # …fileManagerPlugin.config 声明的自定义字段
```

- 系统字段：`enabled` / `source` / `startedServices`，插件自定义配置应避免与之冲突
- `source: 'local'` 与 `'npm'` 可同名共存，通过 source 切换启用哪个；安装 npm 插件不覆盖本地同名插件配置值

## 八、构建与发布

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### build.mjs（esbuild 打包前端）

```js
await esbuild.build({
  entryPoints: ['src/frontend.ts'],
  bundle: true,
  outfile: 'dist/frontend.js',
  format: 'esm',                                  // 浏览器 ESM
  platform: 'browser',
  target: 'es2020',
  external: ['@mqn00/file-manager/plugin/frontend'], // 纯类型导入
})
```

### 发布

```bash
npm run publish:npm           # 自动 patch 递增版本并发布
npm run publish:npm -- 0.3.0  # 指定版本发布
```

发布脚本（scripts/publish.mjs）流程：校验/更新 package.json 版本号 → `npm run build` → `npm publish --access public`。发布前须通过 `prepublishOnly` 构建。

## 九、本地开发与热重载

- 本地开发插件放在 `plugins/<name>/`，主项目 `npm run install:all` 后依赖经 `file:../../backend` 解析
- 构建：`cd plugins/<name> && npm run build`；后端 `tsc --watch` 监听，前端改动需重新 build
- 热重载：加载器监视本地插件 `dist/` 目录的 `.js` 文件变更（500ms 防抖）自动重载，重载后按 config 恢复其托管服务
- 注意：热重载在 ts-node 下受限（独立编译缓存），推荐编译模式开发：`cd backend && npm run build && npm start`
- 启用插件：插件管理页「已安装 → 加载」，或 config.yml `plugins.<name>.enabled: true` 后重启

## 十、插件解析与加载机制

### 查找策略（resolvePluginRoot 优先级）

1. `node_modules/{name}`（精确匹配，支持 `@scope/pkg`）
2. `node_modules/file-manager-plugin-{name}`
3. `node_modules/@scope/{name}` / `node_modules/@scope/file-manager-plugin-{name}`（扫描所有 scope）
4. `plugins/{name}`（本地开发目录；优先于 node_modules 解析，避免 scope 扫描误匹配，如 `@playwright/test` 命中插件 "test"）

### 加载流程

- 启动时从 config.yml 收集 `enabled !== false` 的插件 → 拓扑排序 → 分批加载（同层并行）
- `GET /api/plugins` 自动加载 enabled 但未加载的插件，单个失败不影响其他
- npm 插件统一安装到 `pluginInstallDir`（开发默认 `cwd/node_modules`，生产默认 `~/.file-manager/node_modules`），安装命令 `npm install <pkg>@<version> --prefix <dir> --save-exact`（强制模式加 `--legacy-peer-deps`）
- 删除接口禁止删除本地开发插件（仅限 npm 插件）
- npm 市场搜索按 `keywords:file-manager-plugin` 查询 registry

## 十一、环境要求与约定

- Node.js >= 22
- 主项目版本：经 peerDependencies 声明；使用新 API（如 registerTheme、托管服务）时声明对应的最低版本
- 插件修改记录不进主项目 CHANGELOG（changelog 只记主项目）
- 功能改动需同步维护测试用例（backend/vitest、frontend 组件测试、e2e）
