# @mqn00/file-manager-plugin-file-image-viewer

File Manager 文件查看子插件：**图片查看**（支持缩放、旋转、适应窗口、下载）。

作为 `file-viewer` 核心插件的子模块注册，单击打开图片文件即以内嵌查看器预览，常见图片格式均支持。

## 支持的后缀（默认模块）

png、jpg、jpeg、gif、webp、svg、bmp、ico、avif、apng、jfif、tif、tiff、heic、heif

## 功能

- **元数据**：工具栏展示分辨率、DPI、位深度（PNG/JPEG/GIF/BMP/WebP 解析文件头；其余格式回退为渲染尺寸）
- **适应窗口**：图片按窗口等比缩放居中；切换后回到该模式会重置缩放/旋转
- **缩放**：放大/缩小按钮（10% ~ 1000%）+ 滚轮缩放（以鼠标位置为锚点）
- **拖拽**：放大后可按住左键拖拽查看任意区域
- **旋转**：每次 90°（0/90/180/270）
- **下载**：工具栏"下载图片"按钮（走主应用带认证的下载接口）
- **大图无损**：经平台 `/api/files/stream` Range 流式加载，无文件大小限制

## 前置要求

- **File Manager** >= 3.0.0-beta7
- **@mqn00/file-manager-plugin-file-viewer**（核心）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-image-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 图片链路：`POST /api/files/token`（携带 Bearer 换令牌）→ `GET /api/files/stream?token=`（公开 Range 流）→ `<img src>`（平台 I/O，`ctx.api.fileIO`）
- 流令牌绑定安全校验后的绝对路径，30 分钟有效，访问时惰性清理；切换文件自动重取令牌并重置视图
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'image', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```