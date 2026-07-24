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

> 注：`FILE_MANAGER_BASE_DIR` 优先级低于 `config.yml` 中的 `storageRoot` 配置。优先级：`config.yml` > 环境变量 > `/`

---

## 认证接口

所有文件/文件夹/配置接口（除登录外）均需认证：请求头携带 `Authorization: Bearer <sessionToken>`。

### 1. 登录

- **接口**: `POST /api/auth/login`
- **请求体**:
  ```json
  {
    "token": "admin123"
  }
  ```
- **响应示例**:
  ```json
  {
    "success": true,
    "sessionToken": "a1b2c3d4e5f6...",
    "expiresIn": 86400
  }
  ```
- **错误响应**:
  - `400` - 未提供令牌
  - `401` - 令牌错误

### 2. 登出

- **接口**: `POST /api/auth/logout`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**:
  ```json
  {
    "success": true
  }
  ```

### 3. 检查会话

- **接口**: `GET /api/auth/check`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**:
  ```json
  { "valid": true }
  ```

---

## 配置接口

所有配置接口均需认证。

### 1. 获取配置

返回系统当前配置（令牌脱敏）。

- **接口**: `GET /api/config`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**:
  ```json
  {
    "auth": {
      "token": "ad***23",
      "tokenExpiryHours": 24
    },
    "storageRoot": "/home/user"
  }
  ```

### 2. 修改配置

- **接口**: `PUT /api/config`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **请求体**（所有字段可选）:
  ```json
  {
    "auth": {
      "token": "new-token",
      "tokenExpiryHours": 48
    },
    "storageRoot": "/home/user/data"
  }
  ```
- **响应示例**:
  ```json
  {
    "success": true,
    "config": {
      "auth": { "token": "ne***en", "tokenExpiryHours": 48 },
      "storageRoot": "/home/user/data"
    },
    "sessionsCleared": true
  }
  ```
- **说明**：
  - `sessionsCleared: true` 表示令牌已修改，所有登录会话已失效，需重新登录
  - 配置写入 `config.yml` 后自动热加载

### 3. 重新加载配置

手动从 `config.yml` 重新加载配置到内存（通常不需要，文件修改会自动热加载）。

- **接口**: `POST /api/config/reload`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**:
  ```json
  {
    "success": true,
    "message": "配置已重新加载"
  }
  ```

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

- **字段说明**:
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `broken` | boolean | 可选。为 `true` 时表示该条目是一个符号链接，但其指向的目标已不存在 |

---

### 2. 计算文件夹大小

异步计算指定文件夹的总大小。

- **接口**: `GET /api/files/dirsize`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `path` | string | 是 | 要计算大小的文件夹路径 |

- **请求示例**:
  ```bash
  GET /api/files/dirsize?path=/documents
  ```

- **响应示例**:
  ```json
  {
    "size": 1048576
  }
  ```

---

### 3. 下载文件

下载指定文件。

- **接口**: `GET /api/files/download/*`
- **参数**: 文件路径（通过 URL 路径传递，`/download/` 之后的部分）

- **请求示例**:
  ```bash
  GET /api/files/download/documents/file.txt
  ```

- **响应**: 文件二进制流
  - `Content-Type`: 根据文件类型自动识别
  - `Content-Disposition`: `attachment; filename="文件名"`

---

### 4. 压缩文件夹

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

### 5. 取消压缩

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

### 6. 移动文件/文件夹

移动文件或文件夹到指定位置。

- **接口**: `POST /api/files/move`
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

### 7. 重命名文件/文件夹

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

### 8. 删除文件/文件夹

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

### 9. 批量删除文件/文件夹

批量删除多个文件或文件夹（支持递归删除）。

- **接口**: `POST /api/files/batch-delete`
- **请求体**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `paths` | string[] | 是 | 要删除的文件/文件夹路径列表 |

- **请求示例**:
  ```bash
  POST /api/files/batch-delete
  Content-Type: application/json

  {
    "paths": ["/documents/file1.txt", "/documents/folder1"]
  }
  ```

- **响应示例**:
  ```json
  {
    "success": 2,
    "failed": []
  }
  ```

  部分失败时：
  ```json
  {
    "success": 1,
    "failed": [
      { "path": "/documents/missing.txt", "message": "文件不存在" }
    ]
  }
  ```

---

## 文件夹接口

### 创建文件夹

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

## 系统信息接口

### 1. 获取系统信息

获取当前服务器的系统和硬件信息。

- **接口**: `GET /api/system`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**:
  ```json
  {
    "os": {
      "type": "Linux",
      "platform": "linux",
      "arch": "x64",
      "release": "5.15.0-91-generic",
      "hostname": "server-name",
      "uptime": 123456,
      "uptimeFormatted": "1天 10小时 17分钟"
    },
    "cpu": {
      "model": "Intel(R) Core(TM) i7-10700K",
      "cores": 8,
      "physicalCores": 8,
      "speed": 3700,
      "usage": 45.2
    },
    "memory": {
      "total": 17179869184,
      "free": 8589934592,
      "used": 8589934592,
      "usagePercent": 50.0,
      "totalFormatted": "16 GB",
      "freeFormatted": "8 GB",
      "usedFormatted": "8 GB"
    },
    "disk": {
      "device": "/dev/sda",
      "mountpoint": "/",
      "mountpoints": ["/", "/home", "/data"],
      "fstype": "ext4",
      "total": 500107862016,
      "free": 250053931008,
      "used": 250053931008,
      "totalFormatted": "465.8 GB",
      "freeFormatted": "232.9 GB",
      "usedFormatted": "232.9 GB"
    },
    "disks": [
      {
        "device": "/dev/sda",
        "vendor": "Samsung",
        "model": "SSD 870 EVO 1TB",
        "mountpoint": "/",
        "mountpoints": ["/", "/home", "/data"],
        "fstype": "ext4",
        "total": 500107862016,
        "free": 250053931008,
        "used": 250053931008,
        "totalFormatted": "465.8 GB",
        "freeFormatted": "232.9 GB",
        "usedFormatted": "232.9 GB",
        "partitions": [
          {
            "mountpoint": "/",
            "totalFormatted": "200 GB",
            "usedFormatted": "100 GB",
            "percent": 50
          },
          {
            "mountpoint": "/home",
            "totalFormatted": "265.8 GB",
            "usedFormatted": "132.9 GB",
            "percent": 50
          }
        ]
      },
      {
        "device": "/dev/sdb",
        "vendor": "Western Digital",
        "model": "WD Blue 1TB",
        "mountpoint": "/mnt/backup",
        "mountpoints": ["/mnt/backup"],
        "fstype": "xfs",
        "total": 1000204886016,
        "free": 800163908813,
        "used": 200040977203,
        "totalFormatted": "931.5 GB",
        "freeFormatted": "745.1 GB",
        "usedFormatted": "186.3 GB"
      }
    ],
    "node": {
      "version": "18.17.0",
      "pid": 12345
    }
  }
  ```

- **字段说明**:
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `disk` | object | 默认磁盘（与 `FILE_MANAGER_BASE_DIR` 或 `/` 匹配） |
  | `disks` | array | 所有磁盘列表 |
  | `disk.device` | string | 设备路径，如 `/dev/sda` |
  | `disk.vendor` | string | 制造商名称（可能为空） |
  | `disk.model` | string | 硬盘型号（可能为空） |
  | `disk.mountpoint` | string | 主挂载点（第一个挂载点） |
  | `disk.mountpoints` | string[] | 所有挂载点列表（排除 SWAP） |
  | `disk.fstype` | string | 文件系统类型，如 `ext4`、`xfs` |
  | `disk.partitions` | array | 各分区详情列表 |
  | `disk.partitions[].mountpoint` | string | 分区挂载点 |
  | `disk.partitions[].totalFormatted` | string | 分区总容量（格式化） |
  | `disk.partitions[].usedFormatted` | string | 分区已用容量（格式化） |
  | `disk.partitions[].percent` | number | 分区使用率百分比 |

---

## 日志接口

所有日志接口均需认证。日志按天存储在 `logs/YYYY-MM-DD.log` 文件中。

### 1. 查询日志

获取指定日期或日期范围内的操作日志，支持按级别、操作类型、关键词筛选。

- **接口**: `GET /api/logs`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `date` | string | 否 | 查询日期，格式 `YYYY-MM-DD`，默认当天。当使用 `startDate` 时忽略此参数 |
  | `startDate` | string | 否 | 查询起始日期，格式 `YYYY-MM-DD`，与 `endDate` 配合实现区间查询 |
  | `endDate` | string | 否 | 查询结束日期，格式 `YYYY-MM-DD`，不传时与 `startDate` 相同 |
  | `level` | string | 否 | 日志级别筛选：`INFO`、`WARNING`、`ERROR` |
  | `action` | string | 否 | 操作类型筛选：`move`、`copy`、`delete`、`rename`、`createFolder`、`login`、`auth` |
  | `keyword` | string | 否 | 关键词搜索（匹配日志内容） |
  | `page` | number | 否 | 页码，默认 `1` |
  | `pageSize` | number | 否 | 每页条数，默认 `50`，最大 `200` |

- **请求示例**:
  ```bash
  # 单日期查询
  GET /api/logs?date=2026-07-08&level=INFO&action=move&page=1&pageSize=20

  # 区间查询
  GET /api/logs?startDate=2026-07-01&endDate=2026-07-08&level=ERROR
  ```

- **响应示例**:
  ```json
  {
    "logs": [
      "[2026-07-08 06:30:22 UTC] [INFO] [move] /documents/file.txt → /backup/file.txt",
      "[2026-07-08 06:31:15 UTC] [INFO] [delete] /documents/old.txt"
    ],
    "total": 2
  }
  ```

- **日志格式**:
  ```text
  [YYYY-MM-DD HH:mm:ss UTC] [级别] [操作] 详情
  ```

- **字段说明**:
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `logs` | string[] | 日志行数组（已按筛选条件过滤） |
  | `total` | number | 符合条件的日志总条数（用于分页） |

### 2. 获取可用日期列表

获取日志目录中所有存在日志文件的日期列表。

- **接口**: `GET /api/logs/dates`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **参数**: 无

- **请求示例**:
  ```bash
  GET /api/logs/dates
  ```

- **响应示例**:
  ```json
  {
    "dates": ["2026-07-01", "2026-07-02", "2026-07-08"]
  }
  ```

- **字段说明**:
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `dates` | string[] | 有日志的日期列表（按日期升序） |

---

## 插件管理接口

插件管理接口用于查询已配置插件和执行运行时加载/卸载。

### 1. 获取插件列表

返回 `config.yml` 中 `plugins` 段配置的所有插件及其状态。

- **接口**: `GET /api/plugins`
- **无需认证**
- **响应示例**:

  ```json
  [
    {
      "name": "smb",
      "enabled": true,
      "local": true,
      "frontendPath": "/plugins-assets/smb/dist/frontend.js"
    },
    {
      "name": "my-plugin",
      "enabled": false,
      "local": false,
      "frontendPath": null
    }
  ]
  ```

- **字段说明**:

  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `name` | string | 插件名称（对应 config.yml 中的 key） |
  | `enabled` | boolean | 是否启用（`config.yml` 中 `enabled !== false`） |
  | `local` | boolean | 是否来自 `plugins/` 本地开发目录（否则来自 `node_modules`） |
  | `frontendPath` | string/null | 前端入口 URL，无前端时为 `null` |

### 2. 运行时加载插件

动态加载一个已配置但尚未运行的插件。

- **接口**: `POST /api/plugins/load`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **请求体**:

  ```json
  {
    "name": "smb"
  }
  ```

- **响应示例**:

  ```json
  {
    "name": "smb",
    "enabled": true,
    "local": true,
    "frontendPath": "/plugins-assets/smb/dist/frontend.js"
  }
  ```

- **错误响应**:
  - `400` — 未提供插件名称
  - `404` — 插件未找到或已加载

### 3. 运行时卸载插件

卸载一个已加载的插件（停止其 watcher、移除路由）。

- **接口**: `POST /api/plugins/:name/unload`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **URL 参数**: `:name` — 插件名称

- **响应示例**:

  ```json
  { "success": true }
  ```

- **错误响应**:
  - `404` — 插件未加载

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
| `401` | 未认证或令牌错误 |
| `404` | 文件/文件夹不存在 |
| `500` | 服务器内部错误 |

---

## 安全说明

1. **令牌认证**: 除登录接口外，所有 API 请求需携带 `Authorization: Bearer <sessionToken>` 头部，未认证请求返回 401
2. **Session 管理**: 基于内存的 Session 机制，有效期由 `config.yml` 中 `tokenExpiryHours` 控制；令牌修改后所有会话立即失效
3. **配置安全**: 令牌通过 `config.yml` 管理，API 返回时自动脱敏（仅显示首尾 2 位字符）；配置文件支持热加载，修改无需重启
4. **路径安全检查**: 所有路径操作都会验证是否在 `storageRoot`（优先于 `FILE_MANAGER_BASE_DIR`）目录下，防止路径遍历攻击
5. **静态文件服务**: 生产环境下，后端会自动提供前端打包的静态文件（`backend/dist` 目录）
6. **SPA 路由支持**: 所有未匹配的路由会返回 `index.html`，支持前端路由
