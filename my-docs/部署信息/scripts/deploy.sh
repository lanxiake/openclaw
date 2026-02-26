#!/usr/bin/env bash
# MtBot 部署脚本（本地运行）
#
# 功能: rsync 源码到远程服务器 → 触发远程构建和部署
#
# 用法:
#   ./deploy.sh all                    # 完整部署（rsync + 构建 + 启动）
#   ./deploy.sh gateway                # 仅部署 Gateway
#   ./deploy.sh api                    # 仅部署 API Server
#   ./deploy.sh admin                  # 仅部署 Admin Console + Website
#   ./deploy.sh sync                   # 仅同步源码，不构建
#   ./deploy.sh build [target]         # 仅构建（不启动）
#   ./deploy.sh restart [target]       # 仅重启服务
#   ./deploy.sh logs [target] [--tail N] [--follow]  # 查看日志
#   ./deploy.sh status                 # 查看服务状态
#   ./deploy.sh migrate                # 运行数据库迁移
#   ./deploy.sh nginx                  # 部署 Nginx 配置
#
set -euo pipefail

# ==================== 配置 ====================

# 获取脚本所在目录（部署信息目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="$(cd "${DEPLOY_DIR}/../.." && pwd)"

# 服务器连接信息
REMOTE_HOST="${REMOTE_HOST:-1.14.110.155}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-${DEPLOY_DIR}/mtbot.pem}"
REMOTE_DIR="${REMOTE_DIR:-/opt/mtbot}"

# SSH 公共参数
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no -p ${REMOTE_PORT}"
SSH_CMD="ssh ${SSH_OPTS} ${REMOTE_USER}@${REMOTE_HOST}"
SCP_CMD="scp ${SSH_OPTS}"

# ==================== 工具函数 ====================

# 日志输出函数
log_info() {
    echo -e "\033[36m[deploy $(date +%H:%M:%S)]\033[0m $*"
}

log_success() {
    echo -e "\033[32m[deploy $(date +%H:%M:%S)]\033[0m $*"
}

log_error() {
    echo -e "\033[31m[deploy $(date +%H:%M:%S)]\033[0m $*" >&2
}

# 远程执行命令
remote_exec() {
    ${SSH_CMD} "$@"
}

# ==================== rsync 同步 ====================

# 同步项目源码到远程服务器
sync_source() {
    log_info "同步项目源码到 ${REMOTE_HOST}:${REMOTE_DIR}/src ..."

    # 确保远程目录存在
    remote_exec "mkdir -p ${REMOTE_DIR}/src"

    # rsync 同步（排除不需要的文件）
    rsync -avz --delete \
        -e "ssh ${SSH_OPTS}" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='*.log' \
        --exclude='.env.local' \
        --exclude='my-docs' \
        --exclude='AI-workspace*' \
        --exclude='apps/macos' \
        --exclude='apps/ios' \
        --exclude='apps/android' \
        --exclude='apps/windows' \
        --exclude='apps/admin-console/node_modules' \
        --exclude='apps/admin-console/dist' \
        --exclude='ui/node_modules' \
        --exclude='ui/dist' \
        --exclude='extensions/*/node_modules' \
        --exclude='.claude' \
        --exclude='coverage' \
        --exclude='.turbo' \
        "${PROJECT_DIR}/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/src/"

    log_success "源码同步完成"
}

# 同步部署配置文件
sync_deploy_configs() {
    log_info "同步部署配置文件 ..."

    # 同步 docker-compose.prod.yml
    ${SCP_CMD} "${DEPLOY_DIR}/docker-compose.prod.yml" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.prod.yml"

    # 同步 .env.production（如果不存在则从 example 创建）
    remote_exec "test -f ${REMOTE_DIR}/.env.production || echo 'WARN: .env.production not found'"

    # 同步远程脚本
    ${SCP_CMD} "${SCRIPT_DIR}/remote-build.sh" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/remote-build.sh"
    ${SCP_CMD} "${SCRIPT_DIR}/remote-start.sh" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/remote-start.sh"
    ${SCP_CMD} "${SCRIPT_DIR}/remote-logs.sh" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/remote-logs.sh"

    remote_exec "chmod +x ${REMOTE_DIR}/remote-*.sh"

    log_success "部署配置同步完成"
}

# ==================== 命令实现 ====================

# 完整部署
deploy_all() {
    sync_source
    sync_deploy_configs
    remote_exec "${REMOTE_DIR}/remote-build.sh all"
    remote_exec "${REMOTE_DIR}/remote-start.sh start all"
    log_success "完整部署完成"
}

# 部署 Gateway
deploy_gateway() {
    sync_source
    sync_deploy_configs
    remote_exec "${REMOTE_DIR}/remote-build.sh gateway"
    remote_exec "${REMOTE_DIR}/remote-start.sh restart gateway"
    log_success "Gateway 部署完成"
}

# 部署 API Server
deploy_api() {
    sync_source
    sync_deploy_configs
    remote_exec "${REMOTE_DIR}/remote-build.sh api"
    remote_exec "${REMOTE_DIR}/remote-start.sh restart api-server"
    log_success "API Server 部署完成"
}

# 部署 Admin Console + Website
deploy_admin() {
    sync_source
    sync_deploy_configs
    remote_exec "${REMOTE_DIR}/remote-build.sh admin"
    remote_exec "${REMOTE_DIR}/remote-start.sh deploy-frontend"
    log_success "Admin Console + Website 部署完成"
}

# 仅同步
deploy_sync() {
    sync_source
    sync_deploy_configs
    log_success "同步完成（未构建和启动）"
}

# 仅构建
deploy_build() {
    local target="${1:-all}"
    sync_deploy_configs
    remote_exec "${REMOTE_DIR}/remote-build.sh ${target}"
    log_success "构建完成: ${target}"
}

# 仅重启
deploy_restart() {
    local target="${1:-all}"
    remote_exec "${REMOTE_DIR}/remote-start.sh restart ${target}"
    log_success "重启完成: ${target}"
}

# 查看日志
deploy_logs() {
    remote_exec "${REMOTE_DIR}/remote-logs.sh $*"
}

# 查看状态
deploy_status() {
    remote_exec "${REMOTE_DIR}/remote-start.sh status"
}

# 数据库迁移
deploy_migrate() {
    remote_exec "${REMOTE_DIR}/remote-build.sh migrate"
    log_success "数据库迁移完成"
}

# 部署 Nginx 配置
deploy_nginx() {
    log_info "部署 Nginx 配置 ..."

    # 上传 Nginx 配置
    ${SCP_CMD} "${DEPLOY_DIR}/nginx.conf.example" \
        "${REMOTE_USER}@${REMOTE_HOST}:/tmp/mtbot-nginx.conf"

    # 上传 SSL 证书
    ${SCP_CMD} -r "${DEPLOY_DIR}/mtbot.top_nginx/" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/mtbot.top_nginx/"

    remote_exec "${REMOTE_DIR}/remote-start.sh setup-nginx"
    log_success "Nginx 配置部署完成"
}

# ==================== 主入口 ====================

show_usage() {
    cat <<'EOF'
用法: deploy.sh <command> [options]

命令:
  all                完整部署（rsync + 构建 + 启动）
  gateway            仅部署 Gateway
  api                仅部署 API Server
  admin              仅部署 Admin Console + Website
  sync               仅同步源码（不构建）
  build [target]     仅构建（gateway|api|admin|all）
  restart [target]   仅重启（gateway|api-server|all）
  logs [target]      查看日志（gateway|api|nginx|all --tail N --follow）
  status             查看服务状态
  migrate            运行数据库迁移
  nginx              部署 Nginx 配置和 SSL 证书

环境变量:
  REMOTE_HOST        服务器地址（默认: 1.14.110.155）
  REMOTE_PORT        SSH 端口（默认: 22）
  REMOTE_USER        SSH 用户（默认: root）
  SSH_KEY            SSH 密钥路径（默认: ../mtbot.pem）
  REMOTE_DIR         远程部署目录（默认: /opt/mtbot）
EOF
}

case "${1:-}" in
    all)         deploy_all ;;
    gateway)     deploy_gateway ;;
    api)         deploy_api ;;
    admin)       deploy_admin ;;
    sync)        deploy_sync ;;
    build)       shift; deploy_build "$@" ;;
    restart)     shift; deploy_restart "$@" ;;
    logs)        shift; deploy_logs "$@" ;;
    status)      deploy_status ;;
    migrate)     deploy_migrate ;;
    nginx)       deploy_nginx ;;
    -h|--help|"")show_usage ;;
    *)           log_error "未知命令: $1"; show_usage; exit 1 ;;
esac
