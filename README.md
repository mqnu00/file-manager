# File Manager

一个全栈文件管理应用，支持文件浏览、上传、下载、压缩、系统监控，并通过插件系统扩展功能（SMB 共享等）。提供 Web 界面和 Electron 桌面应用两种使用方式。

## 技术栈

**前端**
- Vue 3 (Composition API + `<script setup>`)
- TypeScript
- Vite
- Pinia（状态管理）
- Vue Router
- Element Plus（UI）
- Axios / Fetch

**后端**
- Node.js >= 22
- TypeScript
- Express.js
- WebSocket (ws)
- Multer（文件上传）
- Archiver（压缩）
- node-pty（终端）

**桌面应用**
- Electron

## 核心功能

- **文件管理**：浏览、上传、下载、创建/删除/重命名、移动、批量操作
- **压缩**：文件夹 zip 压缩/解压，SSE 实时进度反馈
- **预览**：图片、文本、音视频在线预览
- **认证**：令牌登录 + Session 管理，路由守卫保护
- **系统监控**：CPU、内存、硬盘信息面板
- **操作日志**：按天切块存储，支持日期区间查询和关键词筛选
- **WebSocket 终端**：在线终端，用于安装 Samba 等系统级操作
- **插件系统**：运行时加载/卸载插件，前后端一体化
- **双主题**：赛博朋克 / 亮色一键切换
- **Electron 桌面应用**：打包为 AppImage / deb

## 快速开始

### 安装为 npm 包

```bash
npm install -g @mqn00/file-manager
file-manager -p 3000 -d /path/to/files
```

### 本地开发

```bash
git clone https://github.com/mqnu00/file-manager.git
cd file-manager

# 安装依赖
npm run install:all

# 启动开发模式（前端 :5173 + 后端 :3000）
npm run dev
```

## 配置文件

后端使用 `config.yml`（位于工作目录），支持热加载。

```yaml
auth:
  token: admin123          # 登录令牌
  tokenExpiryHours: 24     # 登录有效期（小时）

storageRoot: /             # 文件管理根目录

log:
  cleanupOnStartup: false
  retentionDays: 30

plugins:
  smb:                     # SMB 插件配置
    enabled: true
    port: 1445
    workgroup: WORKGROUP
    serverString: File Manager
    shares: []
    users: []
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `FILE_MANAGER_BASE_DIR` | 文件根目录（优先级低于 config.yml） | `/` |

## 插件系统

> **当前版本 v3.0.0-beta1，插件系统处于测试阶段。** 以下插件已可用：

| 插件 | 说明 |
|------|------|
| [file-manager-plugin-smb](https://www.npmjs.com/package/file-manager-plugin-smb) | Samba 局域网文件共享 |

### 使用插件

```bash
# 安装插件（以 file-manager-plugin- 开头）
npm install file-manager-plugin-smb

# 启动主项目
file-manager

# 在界面中访问 /plugins，即可看到已安装的插件
# 点击"加载"按钮启用插件
```

插件通过 `config.yml` 的 `plugins` 段配置：

```yaml
plugins:
  smb:
    enabled: true
```

### 插件查找策略

1. `node_modules/{name}`（精确匹配，支持 `@scope/pkg`）
2. `node_modules/file-manager-plugin-{name}`
3. `node_modules/@scope/file-manager-plugin-{name}`
4. `plugins/{name}`（本地开发目录）

### 插件开发

参考 [plugins/smb](./plugins/smb) 目录的示例。

一个插件包含：
- `src/backend.ts` — 后端入口，export `install(ctx)` 函数
- `src/frontend.ts` — 前端入口，export `install(ctx)` 函数
- `package.json` 的 `exports` 字段分别指向两者

### 管理页面

应用内访问 `/plugins` 可查看插件列表、加载/卸载/重载插件，并标记插件来源（npm 包 / 本地开发）。

## 项目结构

```
file-manager/
├── frontend/              # Vue 3 前端
├── backend/               # Express 后端
│   └── config.yml         # 配置文件
├── plugins/               # 本地插件开发目录
│   ├── smb/               #   SMB 局域网共享插件
│   └── test/              #   测试插件
├── electron/              # Electron 桌面应用
├── scripts/               # 构建/发布脚本
└── .github/workflows/     # CI/CD
```

## CLI 选项

```
file-manager [options]

  -p, --port <port>      服务端口（默认 3000）
  -c, --config <path>    config.yml 路径
  -d, --dir <path>       文件根目录
  --daemon               daemon 模式后台运行
```

## API 文档

详见 [API.md](./API.md)

## License

MIT
