# 后端 Express 重构为 TypeScript

## 重构信息

- **分支**: `refactor/backend-to-typescript`
- **日期**: 2026-03-20
- **目标**: 将后端 Express 应用从 JavaScript 迁移到 TypeScript

---

## 重构计划

### 步骤总览

| 步骤 | 任务 | 状态 |
|------|------|------|
| 1 | 安装 TypeScript 和相关类型依赖 | ✅ |
| 2 | 创建 tsconfig.json 配置文件 | ✅ |
| 3 | 转换 src/routes/folders.js 为 TypeScript | ✅ |
| 4 | 转换 src/routes/files.js 为 TypeScript | ✅ |
| 5 | 转换 src/app.js 为 TypeScript | ✅ |
| 6 | 更新 package.json 脚本支持 TypeScript | ✅ |
| 7 | 测试 TypeScript 编译和运行 | ✅ |

---

## 详细步骤

### 步骤 1: 安装 TypeScript 和相关类型依赖

```bash
cd backend
npm install --save-dev typescript @types/node @types/express @types/cors @types/multer @types/archiver @types/mime-types ts-node
```

**安装的依赖说明**:

| 包 | 用途 |
|----|------|
| `typescript` | TypeScript 编译器 |
| `@types/node` | Node.js 类型定义 |
| `@types/express` | Express 框架类型定义 |
| `@types/cors` | CORS 中间件类型定义 |
| `@types/multer` | Multer 上传中间件类型定义 |
| `@types/archiver` | Archiver 压缩库类型定义 |
| `@types/mime-types` | MIME 类型检测类型定义 |
| `ts-node` | 直接运行 TypeScript 文件（开发用） |

---

### 步骤 2: 创建 tsconfig.json

**文件**: `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**配置说明**:
- `target: ES2020` - 编译目标为 ES2020
- `module: commonjs` - 使用 CommonJS 模块系统（Node.js 标准）
- `strict: true` - 启用严格类型检查
- `esModuleInterop: true` - 允许 default 导入 CommonJS 模块
- `outDir: ./dist` - 编译输出目录
- `rootDir: ./src` - 源文件目录

---

### 步骤 3: 转换 folders.js → folders.ts

**源文件**: `src/routes/folders.js`  
**目标文件**: `src/routes/folders.ts`

**主要改动**:
1. 使用 ES6 import 语法替代 require
2. 添加类型注解（Request, Response）
3. 定义接口类型（如 `CreateFolderRequest`）
4. 使用 `const` 替代隐式全局变量
5. 错误处理使用 `instanceof Error` 类型守卫

**关键类型定义**:
```typescript
interface CreateFolderRequest {
  path?: string
  name: string
}
```

---

### 步骤 4: 转换 files.js → files.ts

**源文件**: `src/routes/files.js`  
**目标文件**: `src/routes/files.ts`

**主要改动**:
1. 使用 ES6 import 语法替代 require
2. 添加类型注解
3. 定义接口类型:
   - `FileInfo` - 文件信息对象
   - `SSEProgressMessage` - SSE 进度消息
   - `MoveRequest`, `RenameRequest`, `DeleteRequest`, `ZipCancelRequest` - 请求体类型
   - `ArchiveLocals` - 扩展 app.locals 类型
4. 类型化 `req.app.locals.activeArchives`
5. 为 `calculateDirSize` 函数添加显式返回类型
6. 处理 `req.query.path` 可能为数组或 ParsedQs 的情况

**关键类型定义**:
```typescript
interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

interface SSEProgressMessage {
  type: 'progress' | 'complete' | 'error'
  progress?: number
  zipPath?: string
  message?: string
}

interface ArchiveLocals {
  activeArchives?: Record<string, archiver.Archiver>
}
```

**类型安全处理**:
```typescript
// 处理 query 参数可能为数组的情况
const queryPath = req.query.path
const userPath = Array.isArray(queryPath) 
  ? queryPath[0] 
  : (typeof queryPath === 'string' ? queryPath : '')

// 类型断言访问 app.locals
const locals = req.app.locals as ArchiveLocals
```

---

### 步骤 5: 转换 app.js → app.ts

**源文件**: `src/app.js`  
**目标文件**: `src/app.ts`

**主要改动**:
1. 使用 ES6 import 语法
2. 移除 `module.exports`，TypeScript 使用 ES Module
3. 端口处理使用 `Number(PORT)` 显式转换
4. 错误回调使用 `NodeJS.ErrnoException` 类型

**关键改动**:
```typescript
// 错误处理类型注解
app.listen(port, HOST, () => {
  console.log(`🚀 服务器运行在 http://localhost:${port}`)
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`端口 ${port} 已被占用`)
    startServer(port + 1)
  } else {
    throw err
  }
})
```

---

### 步骤 6: 更新 package.json

**文件**: `backend/package.json`

**修改前**:
```json
"scripts": {
  "dev": "node src/app.js",
  "build": "echo 'Backend build complete'",
  "start": "node src/app.js"
}
```

**修改后**:
```json
"scripts": {
  "dev": "ts-node src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js"
}
```

**说明**:
- `dev` - 使用 ts-node 直接运行 TypeScript（开发热重载可选配 nodemon）
- `build` - 编译 TypeScript 到 dist 目录
- `start` - 运行编译后的 JavaScript

---

### 步骤 7: 测试编译和运行

```bash
# 编译 TypeScript
npm run build

# 运行测试
npm start

# 或开发模式
npm run dev
```

**验证点**:
- [x] TypeScript 编译无错误
- [x] 所有路由正常工作
- [x] 文件列表 API 正常
- [x] 文件上传/下载正常
- [x] 文件夹压缩功能正常
- [x] SSE 进度推送正常

**编译输出**:
```
> file-manager-backend@1.0.0 build
> tsc
```

**生成的文件**:
```
dist/
├── app.d.ts         # 类型声明
├── app.d.ts.map     # 类型声明映射
├── app.js           # 编译后的 JS
├── app.js.map       # Source map
└── routes/
    ├── files.d.ts
    ├── files.js
    ├── files.d.ts.map
    ├── files.js.map
    ├── folders.d.ts
    ├── folders.js
    ├── folders.d.ts.map
    └── folders.js.map
```

---

## 后续清理

### 删除旧 JS 文件

```bash
cd backend/src
rm routes/files.js routes/folders.js app.js
```

### 最终文件结构

```
backend/
├── src/
│   ├── routes/
│   │   ├── files.ts      # 文件操作路由
│   │   └── folders.ts    # 文件夹操作路由
│   └── app.ts            # 应用入口
├── dist/                 # 编译输出
├── tsconfig.json         # TypeScript 配置
├── package.json          # 更新后的脚本
└── REFACTOR.md           # 本文档
```

---

## 完成检查清单

- [x] 所有 `.js` 文件转换为 `.ts`
- [x] TypeScript 编译通过无错误
- [x] 所有 API 端点测试通过
- [x] 类型定义完整
- [x] 代码风格一致
- [x] 文档更新完成
- [x] 旧 JS 文件已删除

### 核心接口

```typescript
// 文件信息
interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

// SSE 消息类型
interface SSEProgressMessage {
  type: 'progress' | 'complete' | 'error'
  progress?: number
  zipPath?: string
  message?: string
}

// 请求体类型
interface MoveRequest {
  fromPath: string
  toPath: string
}

interface RenameRequest {
  path: string
  newName: string
}

interface CreateFolderRequest {
  path?: string
  name: string
}
```

### Express 扩展类型

```typescript
// 扩展 Express Request 类型
interface ArchiveRequest extends Request {
  app: {
    locals: {
      activeArchives: Record<string, any>
    }
  }
}
```

---

## 注意事项

1. **路径安全**: 保留 `safePath()` 函数防止目录遍历攻击
2. **环境变量**: `BASE_DIR`, `PORT`, `HOST` 保持兼容
3. **SSE 流**: 压缩进度使用 Server-Sent Events，保持原有逻辑
4. **错误处理**: 保留 try-catch 块，确保错误响应格式一致

---

## 回滚方案

如需回滚到 JavaScript 版本:

```bash
git checkout main
# 或
git reset --hard <commit-before-refactor>
```

---

## 完成检查清单

- [ ] 所有 `.js` 文件转换为 `.ts`
- [ ] TypeScript 编译通过无错误
- [ ] 所有 API 端点测试通过
- [ ] 类型定义完整
- [ ] 代码风格一致
- [ ] 文档更新完成
