# file-manager-plugin-compress

File Manager 压缩插件：将内置压缩功能提取为独立插件并增强。

## 功能

- **多选压缩**：支持同时选择多个**文件**与**文件夹**压缩为单个 zip（原有内置压缩仅支持单选文件夹）
- **指定输出文件夹**：压缩结果可放入任意已存在文件夹，默认输出到**当前浏览文件夹**
- **压缩前权限预检**：
  - 确认每个选中条目的**读取权限**（`R_OK`）
  - 确认输出文件夹的**写入权限**（`W_OK`）且必须存在
  - 禁止输出文件夹位于某个选中文件夹内部（避免把 zip 压进自己）
- **SSE 进度与取消**：压缩进度实时展示，可取消；取消/失败自动清理半成品；客户端断开自动中止
- **命名规则**：单项 `<名称>.zip`；多项 `<首项名称> 等 N 项.zip`；目标已存在自动追加 ` (1)`、` (2)`… 后缀，不覆盖

## 使用

安装/启用插件后，文件浏览器**多选任意文件/文件夹**（复选框）→ 工具栏批量操作区出现「压缩」按钮 →
点击弹出对话框：确认默认输出文件夹（可点「选择文件夹…」更换）→ 权限预检通过后「开始压缩」→ 进度展示、可取消。

## 接口

均需登录，挂在 `/api/plugin/compress` 下（详见主项目 `API.md`「4. 压缩（compress 插件）」）：

| 接口 | 说明 |
|------|------|
| `POST /api/plugin/compress/check` | 权限预检（源读取 + 输出目录写入 + 目录包含防护），返回逐项状态与目标 zip 路径 |
| `POST /api/plugin/compress/zip` | 开始压缩（SSE：`progress` / `complete` / `error` / `cancelled`），请求体含客户端生成的 `jobId` |
| `POST /api/plugin/compress/cancel` | 按 `jobId` 取消进行中的压缩 |

## 构建与测试

```bash
npm install --registry=https://registry.npmmirror.com   # 安装依赖（archiver 等）
npm run build                                            # tsc 编译后端 + esbuild 打包前端
npm test                                                 # vitest 单元测试（命名/权限/条目收集/压缩/取消）
```

## 依赖

- 运行时：`archiver`
- 主项目：`file-manager`（peerDependencies，类型与平台能力：`ctx.utils.path.safe`、SSE、日志等；工具栏操作经主应用 `window.__fm_bulk_actions` 注册表挂载）