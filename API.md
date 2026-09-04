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

### 4. sudo 提权（权限不足时重试）

当浏览目录（目录本身不可读，如 `/root`）、读取文件、新建/重命名/删除/写入文件因权限不足（`EACCES`/`EPERM`）失败时，后端返回 `403` 且错误码 `ELEVATION_REQUIRED`（见「错误响应」）。前端据此弹出提权对话框，收集 **用户名 + 密码** 后调用下方接口校验并缓存凭据（内存级、限时），随后自动以 `sudo` 重试原操作。

> 覆盖范围：列目录（`sudo find`）、读文件内容（`sudo dd` 按块对齐读取）、新建/重命名/删除/整文件写入。
> **暂不支持提权**：流式媒体输出（`/api/files/stream`，视频/音频/PDF 预览）与文件下载——无权限时仍按普通错误提示；hex 编辑器的定位写入（offset 写）同理。

> 注：列目录时若仅**个别条目**不可访问（如符号链接指向无权限目标），该条目会以 `lstat` 信息降级展示、不弹窗也不影响整页；只有**整个目录不可读**才触发提权流程。

- 总开关：`config.yml` 的 `features.sudoElevation`（默认 `true`）；关闭后 `/elevate` 返回 `403 提权功能未启用`，文件操作也不进入提权流程。
- 凭据有效期：`config.yml` 的 `auth.elevationTtlMinutes`（默认 `5`，单位分钟；修改后无需重启即热加载生效）。过期 / 后端进程重启 / 前端登出即失效。
- 仅 Linux 且已安装 `sudo` 的环境可用；密码仅存内存、不落盘。
- 提权创建/重命名的文件默认归还属主给应用启动用户（对话框「提权后归还属主」勾选项，默认勾选），否则文件会属 root 导致应用后续无法读写。

#### 4.1 校验并缓存凭据

- **接口**: `POST /api/auth/elevate`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **请求体**:
  ```json
  {
    "username": "ubuntu",
    "password": "你的密码",
    "chownBack": true
  }
  ```
- **响应示例（成功）**: `{ "success": true }`
- **错误响应**:
  - `400` - 缺少用户名或密码
  - `401` - 用户名或密码错误 / 系统不支持 sudo
  - `403` - 提权功能未启用（`features.sudoElevation=false`）

#### 4.2 清除凭据

- **接口**: `POST /api/auth/elevate-clear`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **响应示例**: `{ "success": true }`

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
    "storageRoot": "/home/user/data",
    "npmRegistry": {
      "url": "https://registry.npmmirror.com",
      "enabled": true
    }
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

### 4. 测试 npm 镜像源连通性

测试指定 npm 镜像源的连通性和延迟，用于在启用镜像源前验证其可用性。

- **接口**: `POST /api/config/test-registry`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **请求体**:
  ```json
  {
    "url": "https://registry.npmmirror.com"
  }
  ```
- **响应示例**（成功）:
  ```json
  {
    "ok": true,
    "latency": 120
  }
  ```
- **响应示例**（失败）:
  ```json
  {
    "ok": false,
    "latency": 10000,
    "error": "The operation was aborted"
  }
  ```
- **说明**：
  - `ok` 表示连通性测试是否成功
  - `latency` 为响应延迟（毫秒）
  - `error` 仅在失败时返回，描述失败原因
  - 超时时间为 10 秒

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

### 4. 压缩（compress 插件）

> 压缩功能已由内置能力提取为独立插件 `@mqn00/file-manager-plugin-compress`（短名 `compress`）。
> 接口统一挂在 `/api/plugin/compress` 下，需登录访问。支持**多选文件/文件夹**压缩为单个 zip，
> **指定输出文件夹**（默认当前浏览文件夹），压缩前**预检源读取权限与输出目录写入权限**。

#### 4.1 权限预检

压缩前确认：每个源条目可读（`R_OK`）、输出文件夹存在且可写（`W_OK`）、输出文件夹未落在任一选中文件夹内部。

- **接口**: `POST /api/plugin/compress/check`
- **请求体**:
  ```json
  {
    "paths": ["docs", "readme.md"],
    "outputDir": "backup"
  }
  ```
- **响应示例**:
  ```json
  {
    "ok": true,
    "items": [
      { "path": "docs", "name": "docs", "kind": "dir", "exists": true, "readable": true },
      { "path": "readme.md", "name": "readme.md", "kind": "file", "exists": true, "readable": true }
    ],
    "output": { "path": "backup", "exists": true, "isDir": true, "writable": true },
    "targetPath": "docs 等 2 项.zip",
    "forbidden": false
  }
  ```

- **事件/字段说明**:
  | 字段 | 说明 |
  |------|------|
  | `items[].readable` | 源条目是否可读；`exists:false` 表示条目已不存在 |
  | `output.writable` | 输出文件夹是否可写 |
  | `targetPath` | 计划生成的 zip 相对路径（已考虑冲突自动加 `(n)` 后缀） |
  | `forbidden` | 输出文件夹是否位于某个选中文件夹内部（禁止） |

#### 4.2 创建压缩后台任务

压缩任务创建后推入**主项目后台任务系统**：进度、取消、完成事件统一走任务系统
（`GET /api/tasks`、`GET /api/tasks/:id/stream`、`POST /api/tasks/:id/cancel`），
前端在后台任务面板（TaskPanel）展示并可取消；任务条目持久化于 `tasks.json`，
页面刷新/重开后运行中任务继续跟踪。

- **接口**: `POST /api/plugin/compress/zip`
- **请求体**:
  ```json
  {
    "paths": ["docs", "readme.md"],
    "outputDir": "backup"
  }
  ```
- **响应示例**:
  ```json
  {
    "taskId": "5f9c1e2a-..."
  }
  ```
  创建成功即返回 `taskId`（压缩在后台执行）；`409` 表示与运行中任务路径冲突
  （同源或同输出 zip）。

- **任务信息**: 任务类型 `compress`，阶段 `compress`，元数据含 `paths` / `names` /
  `outputDir` / `targetPath`（输出 zip 相对路径，完成时回写最终值）。
- **命名规则**: 单项 → `<名称>.zip`；多项 → `<首项名称> 等 N 项.zip`；目标已存在时自动追加 ` (1)`、` (2)`… 后缀，不覆盖已有文件。
- **取消**: `POST /api/tasks/:id/cancel`（压缩阶段可取消，取消后自动清理半成品 zip）。
- **服务器重启**: 运行中的压缩任务恢复为 `failed`（与移动任务一致）。

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

## 系统信息（system-info 插件）

> 系统信息功能已抽取为独立插件 `@mqn00/file-manager-plugin-system-info`（短名 `system-info`）。
> 插件前端注册 `/plugin/system-info` 页面路由与顶栏导航入口（主应用 `__fm_nav_actions` 挂载点）；
> 后端接口挂在 `/api/plugin/system-info` 下，需登录访问。

### 1. 获取系统信息

获取当前服务器的系统和硬件信息。

- **接口**: `GET /api/plugin/system-info/info`
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
  | `disk` | object | 默认磁盘（与存储根目录或 `/` 匹配） |
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
      "frontendPath": "/plugins-assets/smb/dist/frontend.js",
      "frontendPage": "/plugin/smb"
    },
    {
      "name": "my-plugin",
      "enabled": false,
      "local": false,
      "frontendPath": null,
      "frontendPage": null
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
  | `frontendPage` | string/null | 插件声明的前端配置页路由路径，未声明（无独立页面）时为 `null` |

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
    "frontendPath": "/plugins-assets/smb/dist/frontend.js",
    "frontendPage": "/plugin/smb"
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

### 4. 安装 / 重新安装插件

安装（或切换版本）一个 npm 插件到统一安装目录。

- **接口**: `POST /api/plugins/install`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **请求体**:

  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `packageName` | string | npm 包名（如 `@mqn00/file-manager-plugin-compress`） |
  | `version` | string? | 精确版本或 npm tag；缺省为 latest |
  | `force` | boolean? | 追加 `npm --force`（强制覆盖/绕过校验） |
  | `taskId` | string? | 前端预生成的任务 id（仅 `[A-Za-z0-9_-]{8,64}`），用于请求发出后立即轮询安装日志 |

- **安装语义**:
  - 安装命令恒为 `npm install <pkg>@<ver> --prefix <prefix> --save-exact --legacy-peer-deps`（`force` 时追加 `--force`）。默认 `--legacy-peer-deps`：插件声明的 peer（宿主 `@mqn00/file-manager`）由运行时提供，**不会自动安装进插件 store**，避免把整个宿主（约 180 个包）复制进 store；插件所需真实第三方库应声明为普通 `dependencies`。
  - **不设自动超时**：请求同步挂起直到 npm 结束，期间通过「安装任务日志」接口实时观察进度，可手动终止。
  - npm 退出 0 但插件不可解析时，自动删除残缺包目录并重装一次（自愈）。
  - 所有 npm 操作（安装/卸载/回滚）共用互斥队列：同一 store 上永远只有一个 npm 进程，杜绝并发 reify 互相撕扯（`ENOTEMPTY` 等问题）。

- **响应示例**（成功）：

  ```json
  {
    "name": "compress",
    "enabled": true,
    "local": false,
    "source": "npm",
    "taskId": "task-abc-00000001"
  }
  ```

- **错误响应**：
  - `400` — 包名/版本/taskId 非法，或 taskId 已被同名字的进行中任务占用
  - `500` — npm 安装失败 / 安装后插件不可解析（响应携带 `taskId` 供拉取完整日志）

### 5. 安装任务：日志 / 终止

安装全程不生杀进程、不设超时，进度通过任务日志暴露，用户可自行决定等待或手动终止。

- **查询进行中/近期任务**: `GET /api/plugins/install-tasks`

  ```json
  [
    { "id": "task-abc-00000001", "packageName": "file-manager-plugin-compress", "status": "running", "startedAt": 1788317847000 }
  ]
  ```

  `status`: `running` / `success` / `failed` / `terminated`。页面刷新后前端据此恢复安装面板。

- **增量拉取日志**: `GET /api/plugins/install-log/:id?offset=<已读行数>`

  ```json
  { "id": "task-abc-00000001", "status": "running", "exitCode": null, "offset": 42, "lines": ["npm warn deprecated ...", "added 87 packages"] }
  ```

  前端按返回的 `offset` 继续轮询（建议 1s 间隔）。任务结束后日志保留 10 分钟。

- **手动终止**: `POST /api/plugins/install-log/:id/terminate`

  ```json
  { "success": true }
  ```

  以 SIGTERM 结束 npm，任务状态置为 `terminated`，挂起的安装请求以"terminated by user"返回 500。终止可能留下不完整的安装目录，重试安装会自动自愈。

- **错误响应**：
  - `404` — 任务不存在或已过期
  - `409` — 任务不在运行中（终止语义）

### 6. 获取 npm 包版本列表

获取 npm 插件包已发布的全部版本（semver 降序）及 latest 版本，用于前端版本下拉选择。

- **接口**: `GET /api/plugins/versions?name=<packageName>`
- **请求头**: `Authorization: Bearer <sessionToken>`
- **URL 参数**: `name` — npm 包名（如 `file-manager-plugin-smb`）

- **响应示例**:

  ```json
  {
    "versions": ["0.1.2", "0.1.1", "0.1.0"],
    "latest": "0.1.2"
  }
  ```

- **错误响应**:
  - `400` — 包名格式非法
  - `404` — 包不存在
  - `502` — npm registry 请求失败
  - `504` — 请求超时

### 7. 前端插件平台契约（v3.0.0）

前端插件 ctx 新增以下平台能力（类型入口 `@mqn00/file-manager/plugin/frontend`，完整规范见 [plugin-design.md](./plugin-design.md)）：

| 能力 | 说明 |
|---|---|
| `ctx.platform.fileOpen` | 文件打开注册表（`window.__fm_file_open`）：插件注册 `{ id, canOpen(file), open(file) }`，主应用渲染期打 `is-openable` 标记、单击文件名时按注册序分发调用；插件不再劫持 DOM 点击事件 |
| `ctx.router.push` | 编程式导航（适配 history / hash 双模式），替代插件自造的 `history.pushState + PopStateEvent` hack |
| `ctx.router.replace` | 编程式替换当前路由（查看器"上一张/下一张"等原地切换场景，避免历史栈膨胀） |
| 前端生命周期 | `install(ctx)` 可返回 teardown 函数；平台自动收集 `addRoute` 路由、`registerTheme` 主题与 `platform.fileOpen.register` 的 handler，卸载/重载时统一清理（`unloadPluginFrontend`） |

> **window 注册表类型契约（v3.0.0）**：批量操作注册表（`window.__fm_bulk_actions`）与页面导航注册表（`window.__fm_nav_actions`）
> 的类型已由类型入口发布：`BulkActionVisibility` / `BulkActionContext` / `BulkAction` / `BulkActionsApi`、
> `NavAction` / `NavActionsApi`（见 [plugin-design.md](./plugin-design.md)「平台挂载点」）。插件直接
> `import type { BulkAction, BulkActionsApi } from '@mqn00/file-manager/plugin/frontend'` 使用即可，
> 无需本地重复声明；两处入口与真实实现经 `frontend/test/types-sync.test-d.ts` 双向断言防漂移。

### 8. 插件数据目录（v3.0.0）

插件经 `ctx.storage`（后端）/ `ctx.pluginData`（前端）访问按**插件短名隔离、跨重启保留**的 KV 存储。前端调用最终落到以下 HTTP 接口（均需在请求头携带 `Authorization: Bearer <sessionToken>`）：

- **读取全部键值**
  - `GET /api/plugins/:name/data`
  - **响应**: `Record<string, unknown>`（JSON 对象）
- **读取单个键值**
  - `GET /api/plugins/:name/data/:key`
  - **响应**: `{ "key": "<key>", "value": <任意 JSON 值> }`
  - **错误**: `404` — 键不存在
- **写入单个键值**
  - `PUT /api/plugins/:name/data/:key`
  - **请求体**: 任意 JSON 值（即存储值本身，非包裹对象）
  - **响应**: `{ "success": true }`
  - **错误**: `400` — 键含路径分隔符 / 值不可 JSON 序列化
- **删除单个键值**
  - `DELETE /api/plugins/:name/data/:key`
  - **响应**: `{ "success": true }`
- **清空插件全部数据**
  - `DELETE /api/plugins/:name/data`
  - **响应**: `{ "success": true }`

> 约束：`:name` 必须是已在 `config.yml` 配置或可解析到安装目录的插件，否则返回 `404`（防止为任意名称创建数据目录）。KV 键禁止 `/` `\` `.` `..`；值必须可 JSON 序列化。数据存于 `<pluginDataBase>/<name>/store.json`，`pluginDataBase` 默认 `<插件安装 prefix>/data`（生产 = `~/.file-manager/data`），可由环境变量 `FILE_MANAGER_PLUGIN_DATA_DIR` 覆盖。卸载插件时默认保留数据；仅当 `DELETE /api/plugins/:name?clearData=1` 才一并删除数据目录。

---

## 错误响应

所有接口在发生错误时返回统一格式：

```json
{
  "message": "错误描述信息"
}
```

### 常见错误码

| HTTP 状态码 | `code` | 说明 |
|------------|--------|------|
| `400` | - | 请求参数错误 |
| `401` | - | 未认证或令牌错误 |
| `404` | - | 文件/文件夹不存在 |
| `403` | `ELEVATION_REQUIRED` | 权限不足，需 sudo 提权（见「sudo 提权」小节） |
| `500` | - | 服务器内部错误 |

---

## 安全说明

1. **令牌认证**: 除登录接口外，所有 API 请求需携带 `Authorization: Bearer <sessionToken>` 头部，未认证请求返回 401
2. **Session 管理**: 基于内存的 Session 机制，有效期由 `config.yml` 中 `tokenExpiryHours` 控制；令牌修改后所有会话立即失效
3. **配置安全**: 令牌通过 `config.yml` 管理，API 返回时自动脱敏（仅显示首尾 2 位字符）；配置文件支持热加载，修改无需重启
4. **路径安全检查**: 所有路径操作都会验证是否在 `storageRoot`（优先于 `FILE_MANAGER_BASE_DIR`）目录下，防止路径遍历攻击
5. **静态文件服务**: 生产环境下，后端会自动提供前端打包的静态文件（`backend/dist` 目录）
6. **SPA 路由支持**: 所有未匹配的路由会返回 `index.html`，支持前端路由
