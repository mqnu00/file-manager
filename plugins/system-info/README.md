# file-manager-plugin-system-info

File Manager 系统信息插件：将内置「系统信息」页面抽取为独立插件，展示服务器的 OS / CPU / 内存 / 磁盘分区 / Node.js 信息。

## 功能

- **系统信息展示**：操作系统（类型/平台/架构/版本/主机名/运行时间）、CPU（型号/核心数/频率）、内存（总量/已用/可用）、硬盘（设备/制造商/型号/挂载点/文件系统/使用率进度条 + 分区明细）、Node.js（版本/进程 ID）
- **多磁盘切换**：检测到多块物理磁盘时，页面顶部下拉切换查看
- **顶栏导航入口**：启用插件后，文件浏览器顶栏出现「系统信息」图标按钮（主应用 `__fm_nav_actions` 挂载点），点击进入 `/plugin/system-info`（需登录）
- **主题适配**：样式使用主应用主题令牌（`--app-*`），明暗主题自动切换

## 使用

安装/启用插件（config.yml 的 `plugins.system-info.enabled: true`）后，顶栏出现系统信息按钮 → 点击进入页面；页面内可手动刷新，加载失败显示错误态 + 重试。

## 接口

需登录，挂在 `/api/plugin/system-info` 下（详见主项目 `API.md`「系统信息（system-info 插件）」）：

| 接口 | 说明 |
|------|------|
| `GET /api/plugin/system-info/info` | 返回系统信息：`{ os, cpu, memory, disk, disks, node }`（结构与迁移前 `GET /api/system` 一致） |

## 构建与测试

```bash
npm install --registry=https://registry.npmmirror.com   # 安装依赖（systeminformation 等）
npm run build                                            # tsc 编译后端 + esbuild 打包前端
```

## 实现说明

- **图标**：图标组件来自 `@element-plus/icons-vue`（devDependency，仅打包 import 到的图标，tree-shake）；图标组件对 `vue` 的引用经构建期别名 `vue → src/vue-shim.ts` 转发到主应用暴露的 `window.Vue`，bundle 不含 vue runtime（避免双实例）
- **类型门面**：icons 2.3.2 的类型入口在插件 tsconfig（NodeNext）下无法解析出具名导出，tsconfig `paths` 将 `@element-plus/icons-vue` 映射到 `src/icons-types.ts`（类型经主项目 `frontend-types` 导入）；esbuild 打包时显式 alias 到真实包入口
- **页面**：render 函数实现（插件不走 SFC），Element Plus 组件取自 `ctx.ElementPlus`

## 依赖

- 运行时：`systeminformation`
- 主项目：`file-manager`（peerDependencies，类型与平台能力：`ctx.router.addRoute`、`ctx.api.instance`、`window.__fm_nav_actions` 挂载点等）