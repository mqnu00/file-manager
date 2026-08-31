# file-manager-plugin-test

File Manager 测试插件，用于验证插件的**安装、加载与版本切换**。

> 包名：`@mqn00/file-manager-plugin-test`，应用内插件名（config.yml 键）：`test`

## 用途

- 演示插件前后端入口的基本模式（`src/backend.ts` + `src/frontend.ts`）
- 验证主应用「插件管理」页面的安装 / 加载 / 卸载 / 版本切换功能
- 生产环境版本切换的验证载体：页面与接口均动态显示当前安装版本
- 演示托管服务（`ctx.manageService`）：启动一个 HTTP 服务，验证重启文件管理器后服务自动恢复

## 目录结构

```
plugins/test/
├── src/
│   ├── backend.ts          # 后端入口：注册路由 + 托管服务 test-service
│   ├── service.ts          # 托管服务实现：进程内 HTTP 测试服务
│   └── frontend.ts         # 前端入口：注册页面 /plugin/test
├── scripts/
│   └── publish.mjs         # 发布脚本（版本号管理 + 构建 + npm publish）
├── build.mjs               # esbuild 打包前端为浏览器 ESM
├── tsconfig.json           # NodeNext：后端编译为 CJS
└── package.json
```

## 接口

### GET /api/plugin/test

返回当前安装版本的运行状态（无鉴权）：

```json
{
  "plugin": "test",
  "name": "@mqn00/file-manager-plugin-test",
  "version": "0.3.0",
  "loadedAt": "2026-08-05T12:00:00.000Z",
  "message": "Hello from test plugin v0.3.0",
  "timestamp": "2026-08-05T12:00:01.000Z"
}
```

- `version`：读取当前安装包的 `package.json`，切换版本后随之变化
- `loadedAt`：后端模块加载时刻，切换版本（重新加载）后必然更新

### 托管服务（自动启动验证）

插件注册了一个托管服务 `test-service`（进程内 HTTP 服务，默认端口 `18765`，可用 `config.yml plugins.test.servicePort` 覆盖，仅监听 `127.0.0.1`）：

- `GET /api/plugin/test/service` — 服务状态：`{ running, port, startedAt, startCount }`
- `POST /api/plugin/test/service/start` — 启动服务（`ctx.startService`，持久化 `startedServices`）
- `POST /api/plugin/test/service/stop` — 停止服务（`ctx.stopService`，清理 `startedServices`）
- `GET /api/plugin/test/service/request` — 由后端代发请求到服务并返回响应（需服务已启动）。服务仅监听 `127.0.0.1` 且端口未对外暴露，浏览器直连会被 CSP `connect-src` 拦截（Docker 部署下也无法到达），故前端统一走该同源接口

服务本身响应：

```json
{
  "plugin": "test",
  "service": "test-service",
  "port": 18765,
  "startedAt": 1786000000000,
  "startCount": 1,
  "message": "Hello from test service",
  "timestamp": "2026-08-07T12:00:00.000Z"
}
```

验证重启后自动启动：

1. 打开 `/plugin/test` 页面（或 `POST /api/plugin/test/service/start`）启动服务
2. 重启文件管理器 —— 启动链中的 `startConfiguredServices()` 会按 `startedServices` 自动恢复服务，页面「最近启动时间」应更新
3. 停止服务后重启 —— 服务不应自动启动（`startedServices` 已清空）

> 注：`startCount` 为模块级计数器，重启文件管理器后归零，不能跨进程累计；判断自动启动是否生效以「最近启动时间」（`startedAt`）是否更新为准。

> 服务运行在文件管理器进程内，进程退出即关闭，端口不会残留占用，可反复测试。

## 本地开发

```bash
cd plugins/test
npm install
npm run build    # tsc 编译后端(CJS) + esbuild 打包前端(ESM)，产物在 dist/
npm run dev      # tsc 监听模式（前端改动后需重新 npm run build）
```

## 发布到 npm

```bash
npm run publish:npm           # 自动 patch 递增版本并发布
npm run publish:npm -- 0.3.0  # 指定版本发布
```

脚本会：校验/更新 `package.json` 版本号 → 构建 → `npm publish --access public`。

## 前端页面

插件在 `package.json` 的 `fileManagerPlugin.frontendPage` 中声明为 `/plugin/test`，插件管理页据此显示「进入前端」按钮，点击即打开该测试页面（无需手动拼接 URL）。

## 生产环境版本切换验证

前提：主应用版本 ≥ 3.0.0（支持插件版本下拉选择），已发布 ≥ 2 个插件版本（如 `0.1.0`、`0.2.0`）。

1. 发布两个版本（见上方发布命令）
2. 主应用进入「插件管理 → 发现插件」，搜索 `test`（或 `@mqn00/file-manager-plugin-test`）
3. 选择版本安装；已安装后可再次选择其他版本点击「切换版本」
4. 验证切换结果：
   - 后端：`curl http://<host>:<port>/api/plugin/test`，`version` 应为新版本、`loadedAt` 应更新
   - 前端：打开 `/plugin/test` 页面，标题版本号与「版本」项应显示新版本
5. 切回旧版本，重复第 4 步确认回退生效

> 注意：v3 起后端插件统一 CJS 加载，低于 0.2.0 的版本（ESM 产物）无法被加载。
