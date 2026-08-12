# file-manager-plugin-hatsune-miku-theme

File Manager 主题插件：**初音未来（Hatsune Miku）**青绿霓虹风格主题。

> 包名：`@mqn00/file-manager-plugin-hatsune-miku-theme`，应用内插件名（config.yml 键）：`hatsune-miku-theme`，主题名：`hatsune-miku`

## 效果

- 深黑蓝背景 + 青绿霓虹高亮（`#00f2ff` / `#0abdc6`），蓝色/红粉点缀
- 整体背景图取自 [DB_Hatsune-Miku-Theme](https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme) 的 `media/` 目录（`logo3.png` 除外），默认 `f3DwR01P.png`
- **图片静态资源由插件后端提供**（`/api/hatsune-miku-theme`，不依赖主项目 `/plugins-assets`）：内置背景图、登录卡片 logo、用户上传的背景图
- 插件主页（插件管理 → 打开页面）可选择背景图、**上传自定义背景图**、删除自定义背景，切换立即生效并按浏览器持久化
- 登录卡片内"文件管理器"标题上方显示初音 logo（`assets/logo.png`，来自 [DB_Hatsune-Miku-Theme](https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme)）
- 安装插件后，主项目工具栏主题下拉框自动出现**「初音未来」**选项，切换即生效并持久化

## 安装

### 本地开发（plugins/ 目录）

```bash
cd plugins/hatsune-miku-theme
npm install
npm run build    # tsc 编译后端(CJS) + esbuild 打包前端(ESM)，产物在 dist/
```

主项目「插件管理 → 已安装 → 加载」启用插件（或 config.yml `plugins.hatsune-miku-theme.enabled: true` 后重启），刷新页面即可在主题下拉框看到「初音未来」。

### npm 安装

```bash
npm run publish:npm           # 自动 patch 递增版本并发布
npm run publish:npm -- 0.1.0  # 指定版本发布
```

发布后在主项目「插件管理 → 发现插件」搜索 `hatsune-miku` 安装。

> 依赖主项目 `registerTheme` 能力（含插件 ctx 类型），需主项目版本 ≥ 3.0.0-beta5 且包含该 API。

## 目录结构

```
plugins/hatsune-miku-theme/
├── src/
│   ├── backend.ts          # 后端入口：挂载 /api/hatsune-miku-theme 路由 + 创建数据目录
│   ├── routes.ts           # 后端路由：图片静态服务（logo/内置背景/自定义背景）+ 背景列表 + 上传/删除
│   └── frontend.ts         # 前端入口：registerTheme 注册主题（配色 + 背景图 + 登录 logo + 插件主页）
├── assets/
│   ├── logo.png            # 初音 logo（登录卡片标题上方展示，随 npm 包发布）
│   └── bg/                 # 内置背景图（f3DwR01P.png、o_1dmto233h1ap1grj1kn511qn1oim1o.jpg，来自 DB_Hatsune-Miku-Theme/media）
├── scripts/
│   └── publish.mjs         # 发布脚本
├── build.mjs               # esbuild 打包前端为浏览器 ESM
├── tsconfig.json           # NodeNext：后端编译为 CJS
└── package.json
```

## 图片资源与背景图切换

- 背景图来自 [DB_Hatsune-Miku-Theme](https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme) `media/` 目录（`logo3.png` 为 logo 不适合做背景，已排除），原样复制至 `assets/bg/`
- **图片由插件后端提供**：内置背景 `/api/hatsune-miku-theme/bg/<file>`、logo `/api/hatsune-miku-theme/logo`、自定义背景 `/api/hatsune-miku-theme/custom/<file>`，不再依赖主项目 `/plugins-assets`
- 主题启用后默认使用 `f3DwR01P.png` 作为整体背景（带深色叠加保证文字可读性）
- 插件管理 → 已安装 → 「打开页面」进入插件主页：
  - 点击缩略图切换背景图；选择存入 `localStorage`（键 `hatsune-miku-theme-bg`），刷新后保持，仅在当前浏览器生效
  - 「上传背景图」支持 png/jpg/webp/gif、最大 10MB；文件保存至 `~/.file-manager/hatsune-miku-theme/`（与主项目生产数据目录一致，插件重装/升级不丢）
  - 自定义背景可删除（内置背景不可删），删除当前使用中的背景会自动回退默认图
- 后端接口：
  - `GET /backgrounds` 背景列表（内置 + 自定义）
  - `POST /backgrounds`（需登录）上传自定义背景，multipart 字段 `file`
  - `DELETE /backgrounds/:file`（需登录）删除自定义背景

## 主题配色

| 用途 | 色值 |
|---|---|
| 背景（深黑蓝） | `#040405` |
| 主色（青绿） | `#00f2ff` |
| 次色（蓝） | `#0080ff` / `#03a9f4` |
| 点缀（红/粉） | `#f40303` / `#E91E63` |
| 文本 | `#ffffff` / `#dcddde` |

> logo 与背景图版权归 [Hatsune-Mikun/DB_Hatsune-Miku-Theme](https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme) 作者所有，仅作主题装饰用途。
