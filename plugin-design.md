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
    "@mqn00/file-manager": "^3.0.0-beta5"       // 声明依赖的主项目版本，编译时解析类型
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
- 页面路由用 `ctx.router.addRoute({ path, component })` 注册，建议路径 `plugin/<短名>` 或 `/plugin/<短名>`
- **注册了页面路由的插件，必须在 package.json 的 `fileManagerPlugin` 中声明 `frontendPage`（路由路径）**，否则插件管理页不显示「进入前端」按钮
- 页面需要登录时在 `addRoute` 中声明 `meta: { requiresAuth: true }`：未登录访问该页面会被主项目路由守卫重定向到登录页（登录后自动跳回原页面）；纯主题/公开页面不声明即默认放行。插件前端资源（JS/静态图）的加载不受影响，是否拦截由插件自行声明决定

### ctx 能力

| API | 说明 |
|---|---|
| `ctx.Vue` | Vue 核心库命名空间（`h`、`ref`、`defineComponent`、`onMounted` 等） |
| `ctx.ElementPlus` | Element Plus 完整命名空间（组件 + 工具函数） |
| `ctx.stores` | Pinia stores：`auth` / `file` / `task` |
| `ctx.api` | axios 实例（`instance`，已配认证拦截器）+ `auth` / `file` / `config` / `task` / `system` API 模块 |
| `ctx.composables` | `useTheme` / `useContextMenu` / `useFileProgress` / `useFileSort` |
| `ctx.utils` | `formatSize` / `formatTime` / `formatSpeed` / `formatProgress` |
| `ctx.constants` | 存储键、主题常量、`API_BASE_URL` |
| `ctx.router` | `createRouter` / `createWebHistory` / `createWebHashHistory` / `addRoute` / `currentRoute` |

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

### 插件样式与主题适配（样式规范）

插件自带的容器/自定义元素不随主题自动换肤，需遵守以下规范才能在「白天 / 赛博 / 初音未来…」等主题下外观一致（file-viewer 查看器系插件以此整改，见 `plugins/file-*`）。

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

插件注入的 `<style>` 是全局样式，为防与其他插件 / 主项目类名冲突，**所有类名必须带插件专属前缀**，禁止使用 `media-viewer`、`code-bar`、`hex-input` 这类通用词。file-viewer 系前缀约定：

| 插件 | 前缀 |
|---|---|
| file-viewer（核心） | `fv-` |
| file-code-viewer | `fcv-` |
| file-image-viewer | `fiv-` |
| file-video-viewer | `fvv-` |
| file-music-viewer | `fmu-` |
| file-office-viewer | `fov-` |
| file-binary-viewer | `fbv-` |

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
    "dependsOn": ["smb"],                      // 可选：依赖的其他插件短名
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
- `frontendPage`：插件声明的前端配置页路由路径（如 `/plugin/smb`）。插件用 `ctx.router.addRoute` 注册了独立页面路由后须声明此字段，插件管理页才会显示「进入前端」按钮并跳转到该路径；**未声明的插件（即使有 `exports["./frontend"]` 前端模块）不显示按钮**。子插件（如 file-viewer 系查看器）无独立页面，无需声明

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
