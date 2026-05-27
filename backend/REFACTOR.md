# 后端代码重构记录

## 重构信息

- **日期**: 2026-03-24
- **目标**: 对大型代码文件进行模块化重构，提高代码可读性和可维护性

---

## 重构概述

对 `src/routes/files.ts` 进行了模块化重构，将原本 280+ 行的大型文件拆分为多个职责单一的小模块。

### 重构前后对比

| 文件 | 重构前 | 重构后 |
|------|--------|--------|
| files.ts | 280 行 (混合所有逻辑) | 147 行 (仅路由定义) |
| folders.ts | 60 行 | 25 行 |

---

## 新的文件结构

```
backend/src/
├── types.ts                    # 全局类型定义
├── utils/
│   ├── safePath.ts             # 路径安全工具 (含 BASE_DIR 常量)
│   └── sse.ts                  # SSE 工具函数
├── services/
│   └── fileService.ts          # 文件操作业务逻辑
└── routes/
    ├── files.ts                # 文件路由 (精简版)
    └── folders.ts              # 文件夹路由 (精简版)
```

---

## 模块职责

| 模块 | 职责 | 行数 |
|------|------|------|
| `types.ts` | 全局类型定义 (FileInfo, SSEProgressMessage, 请求体类型等) | ~60 行 |
| `utils/safePath.ts` | 路径安全检查、目录大小计算 | ~60 行 |
| `utils/sse.ts` | SSE 消息发送工具函数 | ~45 行 |
| `services/fileService.ts` | 文件操作业务逻辑 (列表、压缩、移动、下载等) | ~310 行 |
| `routes/files.ts` | 路由定义和错误处理 | ~147 行 |
| `routes/folders.ts` | 路由定义和错误处理 | ~25 行 |

---

## 重构优势

1. **职责分离**: 路由层只负责请求处理和错误捕获，业务逻辑移至 Service 层
2. **代码复用**: `safePath` 和 SSE 工具函数可在多个路由间复用
3. **类型集中管理**: 所有类型定义统一在 `types.ts`，避免重复定义
4. **易于测试**: Service 层函数可独立进行单元测试
5. **易于维护**: 每个文件职责单一，代码阅读更清晰

---

## 核心类型定义

```typescript
// types.ts
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface SSEProgressMessage {
  type: 'progress' | 'complete' | 'error'
  progress?: number
  zipPath?: string
  message?: string
  speed?: number
}

// 请求体类型
export interface MoveRequest { fromPath: string; toPath: string }
export interface RenameRequest { path: string; newName: string }
export interface DeleteRequest { path: string }
export interface CreateFolderRequest { path?: string; name: string }
```

---

## SSE 工具函数

```typescript
// utils/sse.ts
export const setSSEHeaders = (res: Response): void
export const sendSSEMessage = (res: Response, message: SSEProgressMessage): void
export const sendSSEProgress = (res: Response, progress: number, speed?: number): void
export const sendSSEComplete = (res: Response, zipPath?: string): void
export const sendSSEError = (res: Response, message: string): void
export const endSSE = (res: Response): void
```

---

## 文件服务 API

```typescript
// services/fileService.ts
export const getFileList = (queryPath: string | undefined) => { path: string; files: FileInfo[] }
export const zipFolder = (folderPath: string, res: Response, activeArchives: Record<string, any>) => void
export const cancelZip = (folderPath: string, activeArchives: Record<string, any>) => boolean
export const moveFile = (fromPath: string, toPath: string, res: Response) => void
export const downloadFile = (filePath: string, res: Response) => void
export const renameFile = (filePath: string, newName: string) => void
export const deleteFile = (filePath: string) => void
export const createFolder = (parentPath: string | undefined, name: string) => void
```

---

## 重构原则

1. **单一职责**: 每个文件只负责一个功能领域
2. **依赖倒置**: 路由层依赖 Service 层抽象，不直接操作文件系统
3. **工具函数纯净化**: 工具函数无副作用，易于测试
4. **类型安全**: 所有函数参数和返回值都有明确类型定义

---

## 注意事项

1. **路径安全**: 保留 `safePath()` 函数防止目录遍历攻击
2. **环境变量**: `BASE_DIR`, `PORT`, `HOST` 保持兼容
3. **SSE 流**: 压缩进度使用 Server-Sent Events，保持原有逻辑
4. **错误处理**: 保留 try-catch 块，确保错误响应格式一致

---

## 下一阶段重构计划 (2026-05-26)

> 基于架构审查报告，按优先级排列的改进计划。

---

### 🔴 高优先级

#### 1. `GET /*` 通配符路由安全加固

**问题**: [routes/files.ts#L99](file:///home/lzh/code/vue/file-manager/backend/src/routes/files.ts#L99) `GET /*` 是兜底通配符路由，若误放到 `/zip` 或 `/move` 之前，会导致所有 GET 请求被通配符捕获。

**方案**:
1. 在 `GET /*` 正上方添加醒目注释 `// ⚠️ 通配符兜底路由 — 必须保持在所有具体路由之后`
2. 将 `GET /*` 改名为 `GET /download/*` 语义更明确

**目标文件**: [routes/files.ts](file:///home/lzh/code/vue/file-manager/backend/src/routes/files.ts)

---

#### 2. 统一错误处理中间件

**问题**: 每个路由 handler 都重复 `try/catch + console.error + res.status(500)` 模式。

**方案**: 创建 Express 错误处理中间件统一捕获异常。

```typescript
// middleware/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(`${req.method} ${req.path}:`, err.message)
  res.status(500).json({ message: err.message || '服务器内部错误' })
}
```

路由 handler 通过 `next(err)` 或 `throw` 传递错误，无需再写 try/catch。

**新建文件**: `middleware/errorHandler.ts`
**改动文件**: [app.ts](file:///home/lzh/code/vue/file-manager/backend/src/app.ts), 所有 `routes/*.ts`

---

### 🟡 中优先级

#### 3. `fileService.ts` 拆分

**问题**: 331 行，包含 6 个独立业务操作，增长趋势不可持续。

**目标结构**:
```
services/
├── fileList.ts     # getFileList
├── fileZip.ts      # zipFolder, cancelZip
├── fileMove.ts     # moveFile
├── fileDownload.ts # downloadFile
├── fileCrud.ts     # renameFile, deleteFile, deleteFiles
└── folderCrud.ts   # createFolder
```

**原则**: 每个文件 ≤ 100 行，变化原因单一。

**改动文件**: [services/fileService.ts](file:///home/lzh/code/vue/file-manager/backend/src/services/fileService.ts), [routes/files.ts](file:///home/lzh/code/vue/file-manager/backend/src/routes/files.ts), [routes/folders.ts](file:///home/lzh/code/vue/file-manager/backend/src/routes/folders.ts)

---

#### 4. 目录移动进度算法统一

**问题**: 文件移动按字节数计算进度，目录移动按文件计数计算进度，批量操作时进度语义不统一。

**方案**: 统一使用字节数计算进度。目录移动前先用 `calculateDirSize` 获取总字节数，每写入一个文件累加实际字节数。

**目标文件**: [services/fileService.ts#L189-L229](file:///home/lzh/code/vue/file-manager/backend/src/services/fileService.ts#L189-L229)

---

### 🟢 低优先级

#### 5. 安全加固

**问题**: CORS 全开、无速率限制。

**方案**:

| 加固项 | 方案 |
|--------|------|
| CORS 白名单 | `cors({ origin: ['http://localhost:3000'] })` |
| 登录速率限制 | `express-rate-limit`: 5次/分钟 |
| API 速率限制 | `express-rate-limit`: 100 次/分钟 |

**新建依赖**: `express-rate-limit`
**目标文件**: [app.ts](file:///home/lzh/code/vue/file-manager/backend/src/app.ts)

---

#### 6. `GET /api/files/move` 改为 `POST`

**问题**: 移动操作是副作用操作，不应使用 GET 方法。

**方案**: 改为 `POST /api/files/move`，参数从 query 改为 body。前端 `EventSource` 不支持 POST body，需改用 `fetch` + ReadableStream 或保持 EventSource + GET。权衡后可以保持现状，或用 `fetch` 手动解析 SSE 流。

**目标文件**: [routes/files.ts](file:///home/lzh/code/vue/file-manager/backend/src/routes/files.ts), [api/file.ts](file:///home/lzh/code/vue/file-manager/frontend/src/api/file.ts)

---

#### 7. 日志系统升级

**问题**: `console.error` 散落各处，生产环境无法持久化。

**方案**: 引入 `winston` 或 `pino`，按级别输出到控制台 + 文件。

**新建依赖**: `winston`
**新建文件**: `utils/logger.ts`
