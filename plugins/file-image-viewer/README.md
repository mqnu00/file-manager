# @mqn00/file-manager-plugin-file-image-viewer

File Manager 文件查看子插件：**图片查看**（支持缩放、旋转、适应窗口、文件夹内上一张/下一张切换、下载）。

作为 `file-viewer` 核心插件的子模块注册，单击打开图片文件即以内嵌查看器预览，常见图片格式均支持。

## 支持的后缀（默认模块）

png、jpg、jpeg、gif、webp、svg、bmp、ico、avif、apng、jfif、tif、tiff、heic、heif

## 功能

- **元数据**：工具栏展示分辨率、DPI、位深度（PNG/JPEG/GIF/BMP/WebP 解析文件头；其余格式回退为渲染尺寸）
- **适应窗口**：图片按窗口等比缩放居中；切换后回到该模式会重置缩放/旋转
- **缩放**：放大/缩小按钮（10% ~ 1000%）+ 滚轮缩放（以鼠标位置为锚点）
- **拖拽**：放大后可按住左键拖拽查看任意区域
- **旋转**：每次 90°（0/90/180/270）
- **文件夹内切换**：识别当前文件夹内全部图片、按名称升序排列，工具栏「上一张 / 下一张」+ 序号计数（如 3/12）沿顺序前后切换，边界处自动禁用；支持键盘 `←` / `→` 快捷切换，切换后查看页 URL 同步更新（保持同一查看页路由）
- **缩略图图库**：工具栏「图库」打开模态网格，按名称排序分页（每页 6 张）展示当前文件夹全部图片的缩略图；当前图高亮、打开时定位到其所在页；翻页懒加载该页缩略图，点击任意缩略图跳转到对应图片（图库关闭、主查看器切换、URL 更新并保持与上一张/下一张同一顺序）；损坏/无预览的图片显示占位
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
- 文件夹切换：通过 `ctx.api.file.list(parent)` 拉取父目录列表，过滤当前文件夹内图片并按名称排序；上一张/下一张以 `history.pushState + PopStateEvent` 改写查看页 URL（保留 `mode`），由 file-viewer 查看页壳重渲染并复用图片查看器实例（触发路径 watch 重取令牌）
- 缩略图图库：复用同一名称升序列表，分页（每页 6 张）；缩略图复用 `createToken + streamUrl` 全尺寸流并以 CSS 缩放，按页惰性签发并缓存令牌、逐张懒加载，避免一次性加载整个文件夹
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'image', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```