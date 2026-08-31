# @mqn00/file-manager-plugin-file-music-viewer

File Manager 文件查看子插件：**音频播放**（HTML5 流式播放）。

作为 `file-viewer` 核心插件的子模块注册，单击打开音频文件即以内嵌播放器播放，支持常见音频格式，无文件大小限制（Range 流式）。

## 支持的后缀（默认模块）

mp3、wav、flac、ogg、m4a、aac、opus

## 功能

- **流式播放**：经平台 I/O 换取 30 分钟流令牌，`<audio>` 直接播放（Range 支持拖进度）
- **下载**：播放器下方提供"下载音频"按钮（走主应用带认证的下载接口）

## 前置要求

- **File Manager** >= 3.0.0
- **@mqn00/file-manager-plugin-file-viewer**（核心）

## 安装

```bash
npm install @mqn00/file-manager-plugin-file-viewer @mqn00/file-manager-plugin-file-music-viewer
```

`config.yml` 中启用两个插件（`source` 按实际来源填 `local` 或 `npm`）。

## 架构说明

- 播放链路：`POST /api/files/token`（携带 Bearer 换令牌）→ `GET /api/files/stream?token=`（公开 Range 流）（平台 I/O，`ctx.api.fileIO`）
- 流令牌绑定安全校验后的绝对路径，30 分钟有效，访问时惰性清理
- 注册表接入：前端 `install()` 时向 `globalThis.__fm_file_viewer_registry__` 注册 `{ id: 'music', editable: false }` 模块（契约见 file-viewer README）

## 构建与发布

```bash
npm install
npm run build        # tsc 编译 + esbuild 打包前端
node scripts/publish.mjs
```