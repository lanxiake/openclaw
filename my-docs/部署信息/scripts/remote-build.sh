#!/usr/bin/env bash
# OpenClaw 远程构建脚本（在服务器上运行）
#
# 用法:
#   ./remote-build.sh all        # 构建所有服务
#   ./remote-build.sh gateway    # 构建 Gateway 镜像
#   ./remote-build.sh api        # 构建 API Server 镜像
#   ./remote-build.sh admin      # 构建 Admin Console 静态文件
#   ./remote-build.sh migrate    # 运行数据库迁移
#
set -euo pipefail

# ==================== 配置 ====================

DEPLOY_DIR="${DEPLOY_DIR:-/opt/mtbot}"
SRC_DIR="${DEPLOY_DIR}/src"
ENV_FILE="${DEPLOY_DIR}/.env.production"

# 启用 BuildKit 加速构建（利用缓存挂载）
export DOCKER_BUILDKIT=1

# ==================== 工具函数 ====================

log_info() {
    echo -e "\033[36m[build $(date +%H:%M:%S)]\033[0m $*"
}

log_success() {
    echo -e "\033[32m[build $(date +%H:%M:%S)]\033[0m $*"
}

log_error() {
    echo -e "\033[31m[build $(date +%H:%M:%S)]\033[0m $*" >&2
}

# 加载环境变量
load_env() {
    if [ -f "${ENV_FILE}" ]; then
        set -a
        source "${ENV_FILE}"
        set +a
        log_info "已加载环境变量: ${ENV_FILE}"
    else
        log_error "环境变量文件不存在: ${ENV_FILE}"
        exit 1
    fi
}

# ==================== 构建函数 ====================

# 构建 Gateway Docker 镜像
build_gateway() {
    log_info "构建 Gateway Docker 镜像 ..."

    cd "${SRC_DIR}"
    docker build \
        -t openclaw-gateway:latest \
        -f Dockerfile \
        .

    log_success "Gateway 镜像构建完成"
}

# 构建 API Server Docker 镜像
build_api() {
    log_info "构建 API Server Docker 镜像 ..."

    cd "${SRC_DIR}"
    docker build \
        -t openclaw-api-server:latest \
        -f apps/api-server/Dockerfile \
        .

    log_success "API Server 镜像构建完成"
}

# 构建 Admin Console 静态文件
build_admin() {
    log_info "构建 Admin Console 静态文件 ..."

    cd "${SRC_DIR}"

    # 安装依赖（如果需要）
    if [ ! -d "node_modules" ]; then
        log_info "安装项目依赖 ..."
        pnpm install --frozen-lockfile
    fi

    # 安装 admin-console 依赖
    cd "${SRC_DIR}/apps/admin-console"
    if [ ! -d "node_modules" ]; then
        log_info "安装 admin-console 依赖 ..."
        pnpm install --frozen-lockfile
    fi

    # 配置生产环境变量
    cat > .env.production <<EOF
VITE_API_SERVER_URL=/api
VITE_GATEWAY_WS_URL=wss://mtbot.top/ws
VITE_GATEWAY_AUTH_TOKEN=${GATEWAY_TOKEN:-}
EOF

    # 构建
    pnpm build

    log_success "Admin Console 构建完成: ${SRC_DIR}/apps/admin-console/dist/"
}

# 运行数据库迁移
run_migrate() {
    log_info "运行数据库迁移 ..."

    load_env

    cd "${SRC_DIR}"

    # 确保依赖已安装
    if [ ! -d "node_modules" ]; then
        log_info "安装项目依赖 ..."
        pnpm install --frozen-lockfile
    fi

    # 使用 localhost:22001 连接（主机网络）
    export DATABASE_URL="postgresql://${POSTGRES_USER:-openclaw_admin}:${POSTGRES_PASSWORD:-Oc%402026!Pg%23Secure}@localhost:22001/${POSTGRES_DB:-openclaw_prod}"

    log_info "数据库连接: localhost:22001/${POSTGRES_DB:-openclaw_prod}"

    # 先构建（迁移脚本需要 dist/）
    pnpm build 2>/dev/null || true

    # 运行迁移
    node --import tsx scripts/db-migrate.ts

    log_success "数据库迁移完成"
}

# 构建所有服务
build_all() {
    build_gateway
    build_api
    build_admin
    run_migrate
}

# ==================== 主入口 ====================

show_usage() {
    cat <<'EOF'
用法: remote-build.sh <target>

目标:
  all        构建所有服务 + 数据库迁移
  gateway    构建 Gateway Docker 镜像
  api        构建 API Server Docker 镜像
  admin      构建 Admin Console 静态文件
  migrate    运行数据库迁移
EOF
}

case "${1:-}" in
    all)      build_all ;;
    gateway)  build_gateway ;;
    api)      build_api ;;
    admin)    load_env; build_admin ;;
    migrate)  run_migrate ;;
    -h|--help|"") show_usage ;;
    *)        log_error "未知目标: $1"; show_usage; exit 1 ;;
esac
