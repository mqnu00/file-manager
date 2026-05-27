FROM docker.1ms.run/library/node:22-alpine3.20

WORKDIR /app

# 复制并解压
COPY ./file-manager.tar.gz /app
RUN tar -xzvf file-manager.tar.gz && \
    rm file-manager.tar.gz && \
    # 处理可能的子目录
    (test -d backend && mv backend/* . && rmdir backend || true)

# 安装依赖
RUN npm install --production --registry=https://registry.npmmirror.com

# 暴露端口
EXPOSE 10000 3000

# 使用环境变量（可以在运行时覆盖）
ENV PORT=10000

# 启动应用
CMD ["node", "dist/app.js"]