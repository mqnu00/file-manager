# @mqn00/file-manager-plugin-file-video-viewer

File Manager 文件查看子插件：**视频播放**（HTML5 流式播放，Range 支持拖拽/Seek）。

作为 `file-viewer` 核心插件的子模块注册，单击打开视频文件即以内嵌播放器播放，支持常见视频格式，无文件大小限制。

## 支持的后缀（默认模块）

mp4、webm、mkv、avi、mov、flv、m4v、wmv

## 功能

- **流式播放 + 拖拽/Seek**：经平台 I/O 换取流令牌，`<video>` 播放；后端 `Range` 响应（206）支持进度条拖拽
- **下载**：播放器下方提供"下载视频"按钮（走主应用带认证的下载接口）

## 前置要求

- **File Manager** >= 3.0.0
- **@mqn00/file-manager-plugin-file-viewer**（核心）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-video-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 播放链路：`POST /api/files/token`（携带 Bearer 换令牌）→ `GET /api/files/stream?token=`（公开 Range 流）（平台 I/O，`ctx.api.fileIO`）
- 流令牌绑定安全校验后的绝对路径，30 分钟有效，访问时惰性清理
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'video', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```