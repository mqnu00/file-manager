# file-manager-plugin-compress

File Manager 压缩插件：将内置压缩功能提取为独立插件并增强。

## 功能

- **多选压缩**：支持同时选择多个**文件**与**文件夹**压缩为单个 zip（原有内置压缩仅支持单选文件夹）
- **指定输出文件夹**：压缩结果可放入任意已存在文件夹，默认输出到**当前浏览文件夹**
- **压缩前权限预检**：
  - 确认每个选中条目的**读取权限**（`R_OK`）
  - 确认输出文件夹的**写入权限**（`W_OK`）且必须存在
  - 禁止输出文件夹位于某个选中文件夹内部（避免把 zip 压进自己）
- **后台任务**：压缩任务推入**主项目后台任务系统**——后台任务面板（TaskPanel）展示进度/速度/当前文件并可取消；任务持久化，页面刷新后可继续跟踪；取消/失败自动清理半成品
- **命名规则**：单项 `<名称>.zip`；多项 `<首项名称> 等 N 项.zip`；目标已存在自动追加 ` (1)`、` (2)`… 后缀，不覆盖

## 使用

安装/启用插件后，文件浏览器**多选任意文件/文件夹**（复选框）→ 工具栏批量操作区出现「压缩」按钮 →
点击弹出对话框：确认默认输出文件夹（可点「选择」更换）→ 权限预检通过后「开始压缩」→
任务推送到后台（对话框关闭），在**后台任务面板**查看进度/取消；完成后输出目录自动刷新。

## 接口

均需登录，挂在 `/api/plugin/compress` 下（详见主项目 `API.md`「4. 压缩（compress 插件）」）：

| 接口 | 说明 |
|------|------|
| `POST /api/plugin/compress/check` | 权限预检（源读取 + 输出目录写入 + 目录包含防护），返回逐项状态与目标 zip 路径 |
| `POST /api/plugin/compress/zip` | **创建压缩后台任务**，返回 `taskId`；进度/取消/完成走主项目任务系统（`GET /api/tasks`、`GET /api/tasks/:id/stream`、`POST /api/tasks/:id/cancel`） |

## 构建与测试

```bash
npm install --registry=https://registry.npmmirror.com   # 安装依赖（archiver 等）
npm run build                                            # tsc 编译后端 + esbuild 打包前端
npm test                                                 # vitest 单元测试（命名/权限/条目收集/压缩/取消）
```

## 依赖

- 运行时：`archiver`
- 主项目：`file-manager`（peerDependencies，类型与平台能力：`ctx.utils.path.safe`、`ctx.services.task` 外部任务（createExternal/updateProgress/finalize）、日志等；工具栏操作经主应用 `window.__fm_bulk_actions` 注册表挂载）

## 任务系统接入示例

本插件演示如何将耗时操作接入主项目后台任务系统：

**后端**（创建任务 + 执行 + 进度上报）：

```ts
// 1. 创建任务条目
const task = ctx.services.task.createExternal(
  'compress',
  { paths, names, outputDir, targetPath },
  { phase: 'compress', totalCount: paths.length }
)

// 2. 获取取消信号
const signal = ctx.services.task.signal(task.id)

// 3. 异步执行（不阻塞响应）
void (async () => {
  try {
    // ... 执行压缩 ...
    ctx.services.task.updateProgress(task.id, { progress: 50, currentFile: 'xxx.txt' })
    ctx.services.task.finalize(task.id, 'completed')
  } catch (e) {
    if (e?.message === 'CANCELLED') {
      ctx.services.task.finalize(task.id, 'cancelled', { message: '已取消' })
    } else {
      ctx.services.task.finalize(task.id, 'failed', { error: e.message })
    }
  }
})()

// 4. 立即返回 taskId
res.json({ taskId: task.id })
```

**前端**（挂载任务到 TaskPanel）：

```ts
export const install: FrontendPluginInstallFunction = (ctx) => {
  // 注册批量操作
  const api = window.__fm_bulk_actions
  api?.register({
    id: 'compress',
    label: '压缩',
    visible: (p) => p.count > 0,
    run: (payload) => openCompressDialog(ctx, payload),
  })
}

// 对话框中创建任务后：
const { taskId } = await ctx.api.instance.post('/plugin/compress/zip', { paths, outputDir })
ctx.stores.task.attachTask(taskId, taskInfo, () => {
  // 完成回调：刷新文件列表等
})
```