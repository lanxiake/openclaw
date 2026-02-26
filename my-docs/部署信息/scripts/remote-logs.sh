#!/usr/bin/env bash
# MtBot 统一日志查看脚本（在服务器上运行）
#
# 用法:
#   ./remote-logs.sh all                      # 查看所有应用服务日志
#   ./remote-logs.sh gateway                  # 查看 Gateway 日志
#   ./remote-logs.sh api                      # 查看 API Server 日志
#   ./remote-logs.sh nginx                    # 查看 Nginx 日志
#   ./remote-logs.sh infra                    # 查看基础设施日志
#   ./remote-logs.sh all --follow             # 实时跟踪日志
#   ./remote-logs.sh all --tail 100           # 查看最近 100 行
#   ./remote-logs.sh all --since 1h           # 查看最近 1 小时
#
set -euo pipefail

# ==================== 配置 ====================

DEPLOY_DIR="${DEPLOY_DIR:-/opt/mtbot}"
COMPOSE_PROD="${DEPLOY_DIR}/docker-compose.prod.yml"
COMPOSE_INFRA="${DEPLOY_DIR}/docker-compose.infra.yml"
ENV_PROD="${DEPLOY_DIR}/.env.production"
ENV_INFRA="${DEPLOY_DIR}/.env.infra"

# ==================== 工具函数 ====================

log_info() {
    echo -e "\033[36m[logs]\033[0m $*" >&2
}

# 解析参数
parse_args() {
    FOLLOW=""
    TAIL=""
    SINCE=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --follow|-f)
                FOLLOW="--follow"
                shift
                ;;
            --tail|-n)
                shift
                TAIL="--tail ${1:-100}"
                shift
                ;;
            --since)
                shift
                SINCE="--since ${1:-1h}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    # 默认显示最近 50 行
    if [ -z "${TAIL}" ] && [ -z "${FOLLOW}" ] && [ -z "${SINCE}" ]; then
        TAIL="--tail 50"
    fi
}

# ==================== 日志查看 ====================

# 查看应用服务日志（docker compose 管理的）
view_app_logs() {
    local service="${1:-}"
    shift || true

    parse_args "$@"

    if [ -f "${COMPOSE_PROD}" ] && [ -f "${ENV_PROD}" ]; then
        local dc_cmd="docker compose -f ${COMPOSE_PROD} --env-file ${ENV_PROD}"
        if [ -n "${service}" ]; then
            ${dc_cmd} logs ${TAIL} ${FOLLOW} ${SINCE} "${service}" 2>/dev/null || true
        else
            ${dc_cmd} logs ${TAIL} ${FOLLOW} ${SINCE} 2>/dev/null || true
        fi
    else
        log_info "应用服务未配置"
    fi
}

# 查看基础设施日志
view_infra_logs() {
    shift || true
    parse_args "$@"

    if [ -f "${COMPOSE_INFRA}" ] && [ -f "${ENV_INFRA}" ]; then
        docker compose -f ${COMPOSE_INFRA} --env-file ${ENV_INFRA} \
            --profile minimal --profile knowledge \
            logs ${TAIL} ${FOLLOW} ${SINCE} 2>/dev/null || true
    else
        log_info "基础设施未配置"
    fi
}

# 查看 Nginx 日志
view_nginx_logs() {
    shift || true
    parse_args "$@"

    log_info "=== Nginx Access Log ==="
    if [ -n "${FOLLOW}" ]; then
        tail -f /var/log/nginx/mtbot-access.log /var/log/nginx/mtbot-error.log 2>/dev/null || \
        tail -f /var/log/nginx/access.log /var/log/nginx/error.log 2>/dev/null || \
        log_info "Nginx 日志文件不存在"
    else
        local n="${TAIL##*--tail }"
        n="${n:-50}"
        echo "--- access ---"
        tail -n "${n}" /var/log/nginx/mtbot-access.log 2>/dev/null || \
        tail -n "${n}" /var/log/nginx/access.log 2>/dev/null || true
        echo ""
        echo "--- error ---"
        tail -n "${n}" /var/log/nginx/mtbot-error.log 2>/dev/null || \
        tail -n "${n}" /var/log/nginx/error.log 2>/dev/null || true
    fi
}

# 查看应用文件日志
view_file_logs() {
    local service="${1:-all}"
    shift || true
    parse_args "$@"

    local n="${TAIL##*--tail }"
    n="${n:-50}"

    case "${service}" in
        gateway)
            log_info "=== Gateway 文件日志 ==="
            ls -la "${DEPLOY_DIR}/logs/gateway/" 2>/dev/null || log_info "无日志文件"
            for f in "${DEPLOY_DIR}/logs/gateway/"*.log; do
                [ -f "$f" ] && echo "--- $(basename $f) ---" && tail -n "${n}" "$f"
            done
            ;;
        api)
            log_info "=== API Server 文件日志 ==="
            ls -la "${DEPLOY_DIR}/logs/api-server/" 2>/dev/null || log_info "无日志文件"
            for f in "${DEPLOY_DIR}/logs/api-server/"*.log; do
                [ -f "$f" ] && echo "--- $(basename $f) ---" && tail -n "${n}" "$f"
            done
            ;;
        all)
            view_file_logs gateway "$@"
            echo ""
            view_file_logs api "$@"
            ;;
    esac
}

# ==================== 主入口 ====================

show_usage() {
    cat <<'EOF'
用法: remote-logs.sh <target> [options]

目标:
  all            所有应用服务（docker 日志）
  gateway        Gateway 日志
  api            API Server 日志
  nginx          Nginx 日志
  infra          基础设施日志
  files [svc]    应用文件日志（gateway|api|all）

选项:
  --follow, -f     实时跟踪日志
  --tail N, -n N   显示最近 N 行（默认 50）
  --since TIME     显示指定时间后的日志（如 1h, 30m, 2h30m）
EOF
}

TARGET="${1:-}"

case "${TARGET}" in
    all)       view_app_logs "" "${@:2}" ;;
    gateway)   view_app_logs "gateway" "${@:2}" ;;
    api)       view_app_logs "api-server" "${@:2}" ;;
    nginx)     view_nginx_logs "${@}" ;;
    infra)     view_infra_logs "${@}" ;;
    files)     shift; view_file_logs "${@}" ;;
    -h|--help|"") show_usage ;;
    *)         log_info "未知目标: ${TARGET}"; show_usage; exit 1 ;;
esac
