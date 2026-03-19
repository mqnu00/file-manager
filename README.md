# File Manager - 文件管理系统

## 项目概述

一个全栈文件管理应用，支持文件的上传、下载、预览、压缩等操作。

## 第一版目标

- [x] 文件目录查看
- [x] 创建文件夹
- [x] 移动文件
- [x] 压缩文件夹 (zip)

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

## 核心功能

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

后端默认在 `files/` 目录下管理文件，可通过环境变量自定义：

```bash
# Linux/Mac
export FILE_MANAGER_BASE_DIR=/path/to/your/files

# Windows
set FILE_MANAGER_BASE_DIR=D:\path\to\your\files
```

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
# 构建前端
npm run build
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

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/files | 获取文件列表 |
| GET | /api/files/* | 下载文件 |
| POST | /api/files | 上传文件 |
| PUT | /api/files/* | 重命名/移动文件 |
| DELETE | /api/files/* | 删除文件 |
| POST | /api/files/:path/zip | 压缩文件 |
| POST | /api/files/:path/unzip | 解压文件 |
| GET | /api/files/:path/preview | 预览文件 |

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
