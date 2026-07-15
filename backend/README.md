# @mqn00/file-manager

全栈文件管理系统的 CLI 工具。

## 安装

```bash
npm i -g @mqn00/file-manager
```

## 使用

```bash
# 默认启动 (端口 3000，配置存于 ~/.file-manager/)
file-manager

# 指定端口
file-manager --port 8080
file-manager -p 8080

# 指定配置文件
file-manager --config /etc/file-manager.yml

# 指定文件管理根目录
file-manager --dir /home/user/data

# 后台运行
file-manager --daemon --port 8080

# 查看版本
file-manager --version
```

## 配置

- 配置文件默认存储于 `~/.file-manager/config.yml`
- 日志文件存储于 `~/.file-manager/logs/`
- 首次启动自动生成默认配置文件
- 可通过 `--config` 选项指定其他路径

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 监听端口 |
| `CONFIG_PATH` | 配置文件路径 |
| `FILE_MANAGER_BASE_DIR` | 文件管理根目录 |
