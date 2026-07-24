# file-manager-plugin-smb

File Manager 插件——在局域网内共享文件，通过 Samba (SMB) 协议让其他设备访问。

## 功能

- **一键启停**：在 Web 界面中启动/停止 SMB 服务，无需手动操作终端
- **共享目录管理**：新增、编辑、删除共享文件夹，支持只读/匿名访问配置
- **用户管理**：配置 SMB 用户名和密码，支持密码认证模式
- **终端安装**：未安装 Samba 时自动检测包管理器并执行安装命令
- **xterm.js 终端**：启动/安装过程通过 WebSocket 终端实时查看输出

## 前置要求

- **File Manager** >= 2.8.0
- **Node.js** >= 22
- **Linux** 系统（需要 `sudo` 权限以启动 `smbd`）
- 系统需安装 **samba**（`smbd`），或通过插件内置的终端安装功能完成安装

## 安装

```bash
npm install file-manager-plugin-smb
```

然后在 File Manager 的 `config.yml` 中启用：

```yaml
plugins:
  smb:
    enabled: true
    port: 1445
    workgroup: WORKGROUP
    serverString: File Manager
    shares: []
    users: []
```

## 配置项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 是否启用插件 |
| `port` | number | `1445` | SMB 监听端口（大于 1024 无需 root） |
| `workgroup` | string | `WORKGROUP` | Windows 工作组名 |
| `serverString` | string | `File Manager` | 服务器描述字符串 |
| `shares` | array | `[]` | 共享文件夹列表 |
| `users` | array | `[]` | SMB 用户列表（空时使用匿名访问） |

### 共享文件夹 (shares)

```yaml
shares:
  - name: 文档
    path: /home/user/Documents
    readOnly: false
    guestOk: true
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 共享名称 |
| `path` | string | 文件夹绝对路径 |
| `readOnly` | boolean | 是否只读 |
| `guestOk` | boolean | 是否允许匿名访问 |

### 用户 (users)

```yaml
users:
  - username: alice
    password: mypassword
```

## 使用方式

1. 在插件页面启用 SMB 插件并点击"加载"
2. 进入 SMB 管理页，添加共享文件夹
3. （可选）添加用户以启用密码认证
4. 点击"启动"，局域网内设备即可通过 `smb://<本机IP>:1445` 访问

## 许可证

MIT
