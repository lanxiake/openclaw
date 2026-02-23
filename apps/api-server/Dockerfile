# API Server Dockerfile
# 用于构建 OpenClaw API Server 的生产镜像

# ==================== 构建阶段 ====================
FROM node:22.12.0-alpine AS builder

# 设置工作目录
WORKDIR /build

# 安装 pnpm（先升级 corepack 以修复签名验证问题）
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@10.23.0 --activate

# 复制 package.json 和 lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-server/package.json ./apps/api-server/

# 安装依赖（包含 devDependencies，tsx 运行时需要）
RUN pnpm install --frozen-lockfile --ignore-scripts

# 复制源代码（API Server 通过相对路径引用主项目模块）
COPY apps/api-server ./apps/api-server
COPY tsconfig.json ./
COPY src ./src
COPY packages ./packages

# ==================== 运行阶段 ====================
FROM node:22.12.0-alpine

# 安装必要的系统工具
RUN apk add --no-cache \
    curl \
    tini

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录（保持 monorepo 结构，因为 API Server 通过相对路径引用主项目模块）
WORKDIR /app

# 从构建阶段复制完整项目结构
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build/apps/api-server ./apps/api-server
COPY --from=builder --chown=nodejs:nodejs /build/src ./src
COPY --from=builder --chown=nodejs:nodejs /build/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /build/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nodejs:nodejs /build/package.json ./package.json

# 创建日志目录
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用（从 apps/api-server 目录运行）
WORKDIR /app/apps/api-server
CMD ["node", "--import", "tsx", "src/app.ts"]
