# @mqn00/file-manager-plugin-file-code-viewer

File Manager 文件查看子插件：**代码/纯文本查看与编辑**（Monaco Editor）。

作为 `file-viewer` 核心插件的子模块注册，单击打开代码/文本类文件后按后缀高亮渲染，支持编辑与保存（Ctrl+S 或保存按钮）。

## 功能

- **Monaco 高亮编辑**：50+ 代码/文本后缀自动匹配语言，支持智能提示、折叠、多光标等完整编辑器能力
- **保存**：Ctrl+S 或点击"保存"按钮写回文件（≤8MB）
- **主题联动**：自动跟随主应用深色/浅色主题切换
- **防御提示**：二进制内容、>8MB 文件给出提示并建议改用十六进制查看/下载

## 支持的后缀（默认模块）

ts、tsx、js、jsx、mjs、cjs、vue、json、jsonc、yaml、yml、md、txt、log、ini、toml、xml、svg、py、java、c、cpp、h、hpp、cs、go、rs、rb、php、sh、bash、zsh、ps1、bat、kt、swift、m、mm、sql、html、htm、css、scss、less、sass、graphql、proto、dockerfile、makefile

## 前置要求

- **File Manager** >= 3.0.0-beta7
- **@mqn00/file-manager-plugin-file-viewer**（核心，`fileManagerPlugin.dependsOn` 保证加载顺序）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-code-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- **Monaco 运行时资源**：构建时将 `node_modules/monaco-editor/min/vs` 整体拷贝到本包 `assets/vs/`（.gitignore 排除、npm 发布 `files` 含 `assets/`），经主应用静态资源 `/plugins-assets/file-code-viewer/assets/vs/` 提供；运行时 AMD `loader.js` 懒加载 `editor.main`，worker 经 `MonacoEnvironment.getWorkerUrl` 以 importScripts 方式加载
- **文件读写**：复用核心插件后端 `GET /api/file-viewer/read`（载入）与 `POST /api/file-viewer/write`（保存），路径安全校验由核心完成
- **注册表接入**：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'code', editable: true }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install          # 含 monaco-editor
npm run build        # tsc 编译 + esbuild 打包前端 + 拷贝 assets/vs
node scripts/publish.mjs   # 构建并发布
```