# @mqn00/file-manager-plugin-file-office-viewer

File Manager 文件查看子插件：**Office 文档只读预览**（PDF、Word、Excel、PPT）。

作为 `file-viewer` 核心插件的子模块注册，单击打开办公文档即在页面内预览。**仅查看，不支持编辑**。

## 支持的后缀（默认模块）

pdf、docx、doc、xlsx、xls、pptx、ppt

## 各格式预览策略

| 格式 | 策略 | 前置要求 |
|---|---|---|
| pdf | 浏览器原生 iframe（平台流） | 无 |
| docx | `docx-preview` 前端渲染 | 无 |
| xlsx / xls | SheetJS 渲染为表格（可切换工作表） | 无 |
| ppt / pptx / doc | 后端 LibreOffice 转 PDF 后 iframe 预览 | 服务器安装 `soffice`/`libreoffice` |

> 未安装 LibreOffice 时，ppt/pptx/doc 会提示"无法预览，请下载后本地打开"，并保留下载按钮。

## 功能

- 转换缓存：服务端将转换 PDF 缓存在临时目录（键 = sha1(绝对路径+修改时间)），重复打开直接复用
- 独立 LibreOffice profile（`-env:UserInstallation`）避免并行转换配置锁；60s 超时保护
- 转换产物经本插件独立的令牌流 `/api/file-office-viewer/stream` 输出（与核心存储根流分离，同样支持 Range）

## 前置要求

- **File Manager** >= 3.0.0
- **@mqn00/file-manager-plugin-file-viewer**（核心）
- 预览 ppt/pptx/doc 需服务器安装 LibreOffice（`apt install libreoffice` 或 `soffice` 可用）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-office-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 前端渲染类（pdf/docx/xlsx/xls）复用平台 I/O `POST /api/files/token` + `GET /api/files/stream` 拉取原文件字节（`ctx.api.fileIO`）
- 转换类（ppt/pptx/doc）走本插件后端 `POST /api/file-office-viewer/convert`（Bearer）→ 先检测 soffice → 转换（缓存）→ 签发令牌 → `GET /api/file-office-viewer/stream?token=` iframe 预览
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'office', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install          # 含 docx-preview、xlsx（打进前端 bundle）与 mime-types（后端）
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```