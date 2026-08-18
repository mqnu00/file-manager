# @mqn00/file-manager-plugin-file-binary-viewer

File Manager 文件查看子插件：**十六进制查看与编辑**（兜底模块）。

作为 `file-viewer` 核心插件的子模块注册，`extensions` 为空数组 = 兜底模块：**未知扩展名的文件默认用它打开**，页内也可手动切换到它查看任意文件。

## 功能

- **栅格视图**：偏移量（8 位 hex）| 16 字节 hex | ASCII 三栏显示
- **页导航**：上一页/下一页/跳到底/按偏移跳转，页大小 256KB
- **单元格编辑**：hex 单元格两位十六进制、ASCII 单元格单字符，输入即时校验（非法字符自动过滤）
- **整页保存**：有修改的页点"保存本页"一次性提交（平台 `/api/files/write` 定位写入）；保存后以新内容刷新视图
- **大文件只读**：>512MB 仅可查看，禁止编辑（提示条告知）

## 支持的后缀

空（兜底）：所有未命中其他查看模块扩展名的文件。

## 前置要求

- **File Manager** >= 3.0.0-beta7
- **@mqn00/file-manager-plugin-file-viewer**（核心）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-binary-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 读取：`GET /api/files/read?path=&offset=&length=`（base64，单次 ≤512KB，平台 I/O `ctx.api.fileIO.read`）
- 保存：`POST /api/files/write`（`{path, data(base64), offset}` 定位写入，`ctx.api.fileIO.write`）
- 纯逻辑（`toCells/isValidHex/isValidAscii/applyDrafts/hasDrafts`）独立实现、无第三方依赖
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'hex', extensions: [], editable: true }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```