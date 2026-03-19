# API 接口文档

文件管理系统后端 API 接口说明。

## 基础信息

- **基础路径**: `/api`
- **默认端口**: `3000`
- **完整地址**: `http://localhost:3000/api`

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `FILE_MANAGER_BASE_DIR` | 文件管理根目录 | `/` |

---

## 文件接口

### 1. 获取文件列表

获取指定目录下的文件和文件夹列表。

- **接口**: `GET /api/files`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 否 | 文件路径，默认为根目录 |

- **请求示例**:
  ```bash
  GET /api/files?path=/documents
  ```

- **响应示例**:
  ```json
  {
    "path": "/documents",
    "files": [
      {
        "name": "folder1",
        "path": "documents/folder1",
        "isDirectory": true,
        "size": 4096,
        "modified": "2026-03-19T10:00:00.000Z"
      },
      {
        "name": "file.txt",
        "path": "documents/file.txt",
        "isDirectory": false,
        "size": 1024,
        "modified": "2026-03-19T10:00:00.000Z"
      }
    ]
  }
  ```

---

### 2. 下载文件

下载指定文件。

- **接口**: `GET /api/files/*`
- **参数**: 文件路径（通过 URL 路径传递）

- **请求示例**:
  ```bash
  GET /api/files/documents/file.txt
  ```

- **响应**: 文件二进制流
  - `Content-Type`: 根据文件类型自动识别
  - `Content-Disposition`: `attachment; filename="文件名"`

---

### 3. 压缩文件夹

将指定文件夹压缩为 zip 文件，使用 SSE 发送压缩进度。

- **接口**: `GET /api/files/zip`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 是 | 要压缩的文件夹路径 |

- **请求示例**:
  ```bash
  GET /api/files/zip?path=/documents
  ```

- **响应**: SSE (Server-Sent Events) 流
  ```text
  data: {"type":"progress","progress":50}
  data: {"type":"progress","progress":100}
  data: {"type":"complete","zipPath":"documents/documents.zip"}
  ```

- **事件类型**:
  | 类型 | 说明 |
  |------|------|
  | `progress` | 压缩进度，`progress` 字段表示百分比 (0-100) |
  | `complete` | 压缩完成，`zipPath` 字段表示压缩文件路径 |
  | `error` | 压缩失败，`message` 字段表示错误信息 |

---

### 4. 取消压缩

取消正在进行的压缩任务。

- **接口**: `POST /api/files/zip/cancel`
- **请求体**:
  ```json
  {
    "path": "/documents"
  }
  ```

- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

---

### 5. 移动文件/文件夹

移动文件或文件夹到指定位置。

- **接口**: `PUT /api/files/move`
- **请求体**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `fromPath` | string | 是 | 源文件路径 |
  | `toPath` | string | 是 | 目标文件路径 |

- **请求示例**:
  ```json
  {
    "fromPath": "/documents/file.txt",
    "toPath": "/backup/file.txt"
  }
  ```

- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

---

### 6. 重命名文件/文件夹

重命名文件或文件夹。

- **接口**: `PUT /api/files/rename`
- **请求体**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 是 | 原文件路径 |
  | `newName` | string | 是 | 新名称 |

- **请求示例**:
  ```json
  {
    "path": "/documents/old.txt",
    "newName": "new.txt"
  }
  ```

- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

---

### 7. 删除文件/文件夹

删除指定的文件或文件夹（支持递归删除）。

- **接口**: `DELETE /api/files`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 是 | 要删除的文件/文件夹路径 |

- **请求示例**:
  ```bash
  DELETE /api/files?path=/documents/file.txt
  ```

- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

---

## 文件夹接口

### 8. 创建文件夹

在指定路径创建新文件夹。

- **接口**: `POST /api/folders`
- **请求体**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 否 | 父文件夹路径，默认为根目录 |
  | `name` | string | 是 | 新文件夹名称 |

- **请求示例**:
  ```json
  {
    "path": "/documents",
    "name": "new-folder"
  }
  ```

- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

---

## 错误响应

所有接口在发生错误时返回统一格式：

```json
{
  "message": "错误描述信息"
}
```

### 常见错误码

| HTTP 状态码 | 说明 |
|------------|------|
| `400` | 请求参数错误 |
| `404` | 文件/文件夹不存在 |
| `500` | 服务器内部错误 |

---

## 安全说明

1. **路径安全检查**: 所有路径操作都会验证是否在 `FILE_MANAGER_BASE_DIR` 目录下，防止路径遍历攻击
2. **静态文件服务**: 生产环境下，后端会自动提供前端打包的静态文件（`backend/dist` 目录）
3. **SPA 路由支持**: 所有未匹配的路由会返回 `index.html`，支持前端路由
