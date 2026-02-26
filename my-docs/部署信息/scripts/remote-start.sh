#!/usr/bin/env bash
# MtBot 远程启停脚本（在服务器上运行）
#
# 用法:
#   ./remote-start.sh start [target]          # 启动服务
#   ./remote-start.sh stop [target]           # 停止服务
#   ./remote-start.sh restart [target]        # 重启服务
#   ./remote-start.sh status                  # 查看状态
#   ./remote-start.sh deploy-frontend         # 部署前端静态文件到 Nginx
#   ./remote-start.sh setup-nginx             # 配置 Nginx
#
set -euo pipefail

# ==================== 配置 ====================

DEPLOY_DIR="${DEPLOY_DIR:-/opt/mtbot}"
SRC_DIR="${DEPLOY_DIR}/src"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
ENV_FILE="${DEPLOY_DIR}/.env.production"

# Docker Compose 命令
DC_CMD="docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"

# ==================== 工具函数 ====================

log_info() {
    echo -e "\033[36m[start $(date +%H:%M:%S)]\033[0m $*"
}

log_success() {
    echo -e "\033[32m[start $(date +%H:%M:%S)]\033[0m $*"
}

log_error() {
    echo -e "\033[31m[start $(date +%H:%M:%S)]\033[0m $*" >&2
}

# ==================== 服务管理 ====================

# 启动服务
start_service() {
    local target="${1:-all}"
    log_info "启动服务: ${target} ..."

    case "${target}" in
        all)
            ${DC_CMD} up -d
            ;;
        gateway|api-server)
            ${DC_CMD} up -d "${target}"
            ;;
        *)
            log_error "未知服务: ${target}"
            exit 1
            ;;
    esac

    log_success "服务已启动: ${target}"
}

# 停止服务
stop_service() {
    local target="${1:-all}"
    log_info "停止服务: ${target} ..."

    case "${target}" in
        all)
            ${DC_CMD} down
            ;;
        gateway|api-server)
            ${DC_CMD} stop "${target}"
            ${DC_CMD} rm -f "${target}"
            ;;
        *)
            log_error "未知服务: ${target}"
            exit 1
            ;;
    esac

    log_success "服务已停止: ${target}"
}

# 重启服务
restart_service() {
    local target="${1:-all}"
    log_info "重启服务: ${target} ..."

    case "${target}" in
        all)
            ${DC_CMD} down
            ${DC_CMD} up -d
            ;;
        gateway|api-server)
            ${DC_CMD} stop "${target}" 2>/dev/null || true
            ${DC_CMD} rm -f "${target}" 2>/dev/null || true
            ${DC_CMD} up -d "${target}"
            ;;
        *)
            log_error "未知服务: ${target}"
            exit 1
            ;;
    esac

    log_success "服务已重启: ${target}"
}

# 查看状态
show_status() {
    log_info "=== 基础设施服务 ==="
    docker compose -f ${DEPLOY_DIR}/docker-compose.infra.yml \
        --env-file ${DEPLOY_DIR}/.env.infra \
        --profile minimal --profile knowledge \
        ps 2>/dev/null | grep -v 'level=warning' || echo "基础设施未运行"

    echo ""
    log_info "=== 应用服务 ==="
    ${DC_CMD} ps 2>/dev/null | grep -v 'level=warning' || echo "应用服务未运行"

    echo ""
    log_info "=== 资源使用 ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -20

    echo ""
    log_info "=== 磁盘空间 ==="
    df -h / | tail -1
}

# ==================== 前端部署 ====================

# 部署前端静态文件到 Nginx
deploy_frontend() {
    log_info "部署前端静态文件 ..."

    # 创建 Web 目录
    mkdir -p /var/www/mtbot-website
    mkdir -p /var/www/mtbot-admin

    # 部署 Website（纯静态 HTML）
    if [ -d "${SRC_DIR}/apps/website" ]; then
        cp -rf "${SRC_DIR}/apps/website/"* /var/www/mtbot-website/
        log_info "Website 已部署到 /var/www/mtbot-website/"
    fi

    # 部署 Admin Console（Vite 构建产物）
    if [ -d "${SRC_DIR}/apps/admin-console/dist" ]; then
        cp -rf "${SRC_DIR}/apps/admin-console/dist/"* /var/www/mtbot-admin/
        log_info "Admin Console 已部署到 /var/www/mtbot-admin/"
    else
        log_error "Admin Console 未构建，请先运行: remote-build.sh admin"
    fi

    # 设置权限
    chown -R nginx:nginx /var/www/mtbot-website 2>/dev/null || chown -R nobody:nobody /var/www/mtbot-website
    chown -R nginx:nginx /var/www/mtbot-admin 2>/dev/null || chown -R nobody:nobody /var/www/mtbot-admin

    # 重载 Nginx
    if command -v nginx &>/dev/null; then
        nginx -t && systemctl reload nginx
        log_success "Nginx 已重载"
    fi

    log_success "前端部署完成"
}

# 配置 Nginx
setup_nginx() {
    log_info "配置 Nginx ..."

    # 复制 Nginx 配置
    if [ -f /tmp/mtbot-nginx.conf ]; then
        # 替换域名占位符
        sed -i 's/your-domain.com/mtbot.top/g' /tmp/mtbot-nginx.conf
        # 修正 SSL 证书路径（使用 bundle 证书）
        sed -i 's/mtbot.top.crt/mtbot.top_bundle.crt/g' /tmp/mtbot-nginx.conf
        cp /tmp/mtbot-nginx.conf /etc/nginx/conf.d/mtbot.conf
        log_info "Nginx 配置已安装到 /etc/nginx/conf.d/mtbot.conf"
    fi

    # 部署 SSL 证书
    if [ -d "${DEPLOY_DIR}/mtbot.top_nginx" ]; then
        chmod 600 "${DEPLOY_DIR}/mtbot.top_nginx/"*.key 2>/dev/null || true
        chmod 644 "${DEPLOY_DIR}/mtbot.top_nginx/"*.crt 2>/dev/null || true
        chmod 644 "${DEPLOY_DIR}/mtbot.top_nginx/"*.pem 2>/dev/null || true
        log_info "SSL 证书权限已设置"
    fi

    # 创建 Web 目录（如果不存在）
    mkdir -p /var/www/mtbot-website
    mkdir -p /var/www/mtbot-admin

    # 测试并重载 Nginx
    nginx -t
    systemctl reload nginx

    log_success "Nginx 配置完成"
}

# ==================== 主入口 ====================

show_usage() {
    cat <<'EOF'
用法: remote-start.sh <command> [target]

命令:
  start [target]       启动服务（gateway|api-server|all）
  stop [target]        停止服务
  restart [target]     重启服务
  status               查看所有服务状态
  deploy-frontend      部署前端静态文件到 Nginx
  setup-nginx          配置 Nginx（安装配置文件 + SSL 证书）
EOF
}

case "${1:-}" in
    start)           shift; start_service "${1:-all}" ;;
    stop)            shift; stop_service "${1:-all}" ;;
    restart)         shift; restart_service "${1:-all}" ;;
    status)          show_status ;;
    deploy-frontend) deploy_frontend ;;
    setup-nginx)     setup_nginx ;;
    -h|--help|"")    show_usage ;;
    *)               log_error "未知命令: $1"; show_usage; exit 1 ;;
esac
