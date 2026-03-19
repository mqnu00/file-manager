# File Manager - 文件管理系统

## 项目概述

一个全栈文件管理应用，支持文件的上传、下载、预览、压缩等操作。

## 技术栈

### 前端
- Vue 3 (组合式 API)
- TypeScript
- Vite
- Pinia (状态管理)
- Vue Router
- Element Plus (UI 组件库)
- Axios (HTTP 客户端)

### 后端
- Node.js
- Express.js
- Multer (文件上传)
- Archiver (压缩/解压)

## 项目结构

```
file-manager/
├── frontend/           # Vue 3 + TypeScript 前端
│   ├── src/
│   │   ├── components/   # 通用组件
│   │   │   ├── Toolbar.vue       # 工具栏组件
│   │   │   ├── FileTable.vue     # 文件列表组件
│   │   │   ├── Dialogs.vue       # 对话框组件
│   │   │   └── ContextMenu.vue   # 右键菜单组件
│   │   ├── views/        # 页面视图
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── api/          # API 接口
│   │   ├── types/        # TypeScript 类型定义
│   │   └── utils/        # 工具函数
│   ├── public/
│   └── package.json
├── backend/            # Express 后端
│   ├── src/
│   │   ├── routes/       # 路由定义
│   │   ├── middleware/   # 中间件
│   │   ├── services/     # 业务逻辑
│   │   └── utils/        # 工具函数
│   └── package.json
├── scripts/            # 构建和部署脚本
├── package.json        # 根 package.json (统一命令)
└── README.md
```

## 核心功能（规划中）

### 1. 文件操作
- 上传/下载文件
- 创建/删除/重命名文件和文件夹
- 移动/复制文件
- 批量操作

### 2. 预览功能
- 图片预览 (jpg, png, gif, webp 等)
- 文本文件预览 (txt, md, json, js 等)
- 音视频预览 (mp4, mp3 等)

### 3. 压缩支持
- 压缩文件为 zip
- 解压 zip 文件
- 批量打包下载

### 4. UI 功能
- 面包屑导航
- 右键上下文菜单
- 拖拽上传
- 搜索功能
- 列表/网格视图切换

## 安装与运行

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 一次性安装所有依赖（推荐）
npm run install:all

# 或者分别安装
# 安装根目录依赖
npm install --registry https://registry.npmmirror.com/

# 安装前端依赖
cd frontend && npm install --registry https://registry.npmmirror.com/

# 安装后端依赖
cd backend && npm install --registry https://registry.npmmirror.com/
```

### 配置文件目录

后端默认在系统根目录 `/` 下管理文件，可通过环境变量自定义：

```bash
# Linux/Mac
export FILE_MANAGER_BASE_DIR=/path/to/your/files

# Windows
set FILE_MANAGER_BASE_DIR=D:\path\to\your\files
```

**注意：** 使用系统根目录时请确保有足够的权限，并注意安全风险。

### 开发模式

```bash
# 在项目根目录执行
npm run dev
```

启动后：
- 前端开发服务器：http://localhost:5173
- 后端 API 服务器：http://localhost:3000

### 构建

```bash
# 构建前端（输出到 backend/dist）
npm run build

# 构建后目录结构
# backend/
# ├── dist/          # 前端构建产物
# ├── src/           # 后端代码
# └── package.json
```

### 生产环境部署

#### 方式一：直接部署整个项目

```bash
# 1. 构建项目
npm run build

# 2. 安装后端生产依赖
cd backend
npm install --production --registry https://registry.npmmirror.com/

# 3. 启动服务
npm start

# 服务运行在 http://localhost:3000
```

#### 方式二：部署到其他服务器

```bash
# 1. 在本地构建
npm run build

# 2. 打包文件（忽略 node_modules）
tar -czf file-manager.tar.gz --exclude='backend/node_modules' backend/

# 3. 传输到目标服务器
scp file-manager.tar.gz user@remote:/path/to/deploy

# 4. 在目标服务器解压并启动
ssh user@remote
cd /path/to/deploy
tar -xzf file-manager.tar.gz
cd backend
npm install --production --registry https://registry.npmmirror.com/
# 不能是3000，因为被后端占用了
PORT=10000 node src/app.js  
```

#### 方式三：使用 Docker（可选）（未验证）

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制后端
COPY backend/package*.json ./
RUN npm install --production --registry https://registry.npmmirror.com/

# 复制构建产物
COPY backend/dist ./dist
COPY backend/src ./src

EXPOSE 3000
CMD ["node", "src/app.js"]
```

```bash
# 构建镜像
docker build -t file-manager .

# 运行容器
docker run -d -p 3000:3000 \
  -v /path/to/files:/files \
  -e FILE_MANAGER_BASE_DIR=/files \
  file-manager
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `FILE_MANAGER_BASE_DIR` | 文件管理根目录 | `/` |

### 防火墙配置

确保目标服务器开放对应端口（默认 3000）：

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

### 生产环境启动

```bash
# 启动生产服务器
npm run start
```

### 版本发布

```bash
# 发布新版本
npm run release
```

## API 文档

详细 API 接口说明请参考 [API.md](./API.md)

## 开发说明

### 前端开发规范
- 使用 TypeScript 严格模式
- 组件使用 `<script setup>` 语法
- 状态管理使用 Pinia
- API 请求统一封装在 `src/api` 目录

### 后端开发规范
- 使用 Express 中间件架构
- 路由与业务逻辑分离
- 统一错误处理
- 支持 CORS

## License

MIT
