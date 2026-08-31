# @mqn00/file-manager-plugin-file-markdown-viewer

File Manager 文件查看子插件：**Markdown 只读预览**（marked 渲染 + highlight.js 代码高亮，跟随主应用主题）。

作为 `file-viewer` 核心插件的子模块注册，单击打开 Markdown 文件即以内嵌预览器渲染，支持常见 Markdown 语法与围栏代码块高亮。**仅查看，不支持编辑**。

## 支持的后缀（默认模块）

md、markdown、mdown、mkd

## 功能

- **Markdown 渲染**：marked 解析，支持 GFM（表格 / 删除线 / 任务列表等）
- **代码高亮**：highlight.js 对围栏代码块按语言高亮，自动跟随主应用深色 / 浅色主题
- **响应式预览**：预览区自适应宽度，图片最大宽度限制，避免溢出

## 前置要求

- **File Manager** >= 3.0.0
- **@mqn00/file-manager-plugin-file-viewer**（核心，`fileManagerPlugin.dependsOn` 保证加载顺序）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-markdown-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 读取：经平台 I/O `POST /api/files/token`（携带 Bearer 换令牌）+ `GET /api/files/stream?token=`（公开 Range 流）拉取原文件字节（`ctx.api.fileIO`），前端解码为文本后 marked 渲染
- 依赖（构建时打进前端 bundle）：marked、marked-highlight、highlight.js
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'markdown', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install          # 含 marked / marked-highlight / highlight.js（打进前端 bundle）
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs   # 构建并发布
```
