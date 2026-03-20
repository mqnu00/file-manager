# 变更日志

## v2.0.0 (2026-03-20)

详细更改见 https://github.com/mqnu00/file-manager/blob/v2.0.0/backend/REFACTOR.md

### 重大更新

#### 后端 TypeScript 重构
- 🔄 将后端从 JavaScript 迁移到 TypeScript
- 📦 添加完整的类型定义（FileInfo, SSEProgressMessage, ArchiveLocals 等）
- 🔧 使用严格模式确保类型安全
- 📝 添加 REFACTOR.md 详细记录重构过程

#### 技术栈更新
**后端新增开发依赖**:
- `typescript` ^5.9.3
- `ts-node` ^10.9.2
- `@types/node` ^25.5.0
- `@types/express` ^5.0.6
- `@types/cors` ^2.8.19
- `@types/multer` ^2.1.0
- `@types/archiver` ^7.0.0
- `@types/mime-types` ^3.0.1

#### 构建流程改进
- 🏗️ 前端构建输出到 `backend/dist`
- 🏗️ 后端 TypeScript 编译输出到 `backend/dist`
- 📦 前后端统一输出到同一目录，简化部署

#### 脚本更新
```json
{
  "dev": "ts-node src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js"
}
```

#### 文件变更
- `backend/src/app.js` → `backend/src/app.ts`
- `backend/src/routes/files.js` → `backend/src/routes/files.ts`
- `backend/src/routes/folders.js` → `backend/src/routes/folders.ts`
- 新增 `backend/tsconfig.json`
- 新增 `backend/REFACTOR.md`

### 兼容性说明
- ✅ API 接口保持不变
- ✅ 功能完全兼容 v1.0.0
- ⚠️ 生产环境运行命令改为 `node dist/app.js`

---

## v1.0.0 (2026-03-19)

### 第一版目标

- [x] 文件目录查看
- [x] 创建文件夹
- [x] 移动文件
- [x] 压缩文件夹 (zip)
- [x] 面包屑导航（支持点击跳转任意层级）
- [x] 压缩进度显示和取消功能
- [x] 文件排序（名称/类型/修改时间，支持正序/倒序）
