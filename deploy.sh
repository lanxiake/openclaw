#!/bin/bash

# MtBot 快速部署脚本
# 用于在远程服务器上快速部署 MtBot 系统
#
# 使用方式:
#   chmod +x deploy.sh
#   ./deploy.sh [command]
#
# 命令:
#   init      - 初始化环境（首次部署）
#   start     - 启动所有服务
#   stop      - 停止所有服务
#   restart   - 重启所有服务
#   status    - 查看服务状态
#   logs      - 查看日志
#   backup    - 备份数据库
#   update    - 更新代码并重启
#   clean     - 清理所有数据（危险！）
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装，请先安装"
        exit 1
    fi
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."
    check_command docker
    check_command docker-compose
    check_command git

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 未运行，请启动 Docker"
        exit 1
    fi

    log_info "前置条件检查通过"
}

# 初始化环境
init_environment() {
    log_info "初始化部署环境..."

    # 检查前置条件
    check_prerequisites

    # 创建必要的目录
    log_info "创建数据目录..."
    mkdir -p ./docker-data/mtbot-config
    mkdir -p ./docker-data/mtbot-workspace
    mkdir -p ./logs/api-server
    mkdir -p ./logs/gateway
    mkdir -p ./backups

    # 检查环境变量文件
    if [ ! -f .env.production ]; then
        log_warn ".env.production 不存在，从模板创建..."
        if [ -f .env.production.example ]; then
            cp .env.production.example .env.production
            log_warn "请编辑 .env.production 文件，修改所有 CHANGE_ME 标记的值"
            log_warn "特别注意修改以下配置:"
            log_warn "  - POSTGRES_PASSWORD"
            log_warn "  - REDIS_PASSWORD"
            log_warn "  - MINIO_SECRET_KEY"
            log_warn "  - GATEWAY_TOKEN"
            log_warn "  - JWT_SECRET"
            log_warn "  - ADMIN_PASSWORD"
            read -p "按回车键继续编辑配置文件..."
            ${EDITOR:-nano} .env.production
        else
            log_error ".env.production.example 不存在，无法创建配置文件"
            exit 1
        fi
    fi

    # 创建 Docker 网络
    log_info "创建 Docker 网络..."
    docker network create mtbot-network 2>/dev/null || log_info "网络已存在"

    # 启动基础设施
    log_info "启动基础设施服务..."
    docker-compose -f docker-compose.infra.yml up -d

    # 等待服务就绪
    log_info "等待服务启动（约 30 秒）..."
    sleep 30

    # 检查服务健康状态
    log_info "检查服务健康状态..."
    docker-compose -f docker-compose.infra.yml ps

    # 运行数据库迁移
    log_info "运行数据库迁移..."
    if command -v pnpm &> /dev/null; then
        pnpm db:migrate
        log_info "创建初始管理员账户..."
        pnpm db:seed
    else
        log_warn "pnpm 未安装，跳过数据库迁移"
        log_warn "请手动运行: pnpm db:migrate && pnpm db:seed"
    fi

    log_info "初始化完成！"
    log_info "下一步: ./deploy.sh start"
}

# 启动服务
start_services() {
    log_info "启动应用服务..."

    # 检查基础设施是否运行
    if ! docker ps | grep -q mtbot-postgres; then
        log_warn "基础设施未运行，正在启动..."
        docker-compose -f docker-compose.infra.yml up -d
        sleep 10
    fi

    # 启动应用服务
    docker-compose -f docker-compose.prod.yml up -d

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10

    # 显示服务状态
    show_status

    log_info "服务启动完成！"
    log_info "API Server: http://localhost:3000"
    log_info "Gateway: ws://localhost:18789"
    log_info "Web Admin: http://localhost:3001"
}

# 停止服务
stop_services() {
    log_info "停止应用服务..."
    docker-compose -f docker-compose.prod.yml down

    log_info "停止基础设施服务..."
    docker-compose -f docker-compose.infra.yml down

    log_info "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    stop_services
    sleep 5
    start_services
}

# 显示服务状态
show_status() {
    log_info "=== 基础设施服务状态 ==="
    docker-compose -f docker-compose.infra.yml ps

    echo ""
    log_info "=== 应用服务状态 ==="
    docker-compose -f docker-compose.prod.yml ps

    echo ""
    log_info "=== 资源使用情况 ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# 查看日志
show_logs() {
    log_info "查看服务日志（Ctrl+C 退出）..."
    docker-compose -f docker-compose.prod.yml logs -f --tail=100
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."

    BACKUP_DIR="./backups"
    DATE=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/postgres-$DATE.sql.gz"

    # 创建备份目录
    mkdir -p $BACKUP_DIR

    # 备份 PostgreSQL
    docker exec mtbot-postgres pg_dump -U mtbot_admin mtbot_prod | gzip > $BACKUP_FILE

    if [ $? -eq 0 ]; then
        log_info "备份成功: $BACKUP_FILE"

        # 显示备份文件大小
        SIZE=$(du -h $BACKUP_FILE | cut -f1)
        log_info "备份大小: $SIZE"

        # 清理旧备份（保留最近 7 天）
        find $BACKUP_DIR -name "postgres-*.sql.gz" -mtime +7 -delete
        log_info "已清理 7 天前的旧备份"
    else
        log_error "备份失败"
        exit 1
    fi
}

# 更新代码并重启
update_services() {
    log_info "更新代码..."

    # 拉取最新代码
    git pull

    # 重新构建镜像
    log_info "重新构建镜像..."
    docker-compose -f docker-compose.prod.yml build

    # 重启服务
    restart_services

    log_info "更新完成"
}

# 清理所有数据
clean_all() {
    log_warn "警告：此操作将删除所有数据，包括数据库、文件等"
    read -p "确认删除所有数据？(yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "操作已取消"
        exit 0
    fi

    log_info "停止所有服务..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.infra.yml down -v

    log_info "删除数据目录..."
    rm -rf ./docker-data
    rm -rf ./logs

    log_info "清理完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    # API Server
    if curl -f http://localhost:3000/health &> /dev/null; then
        log_info "✓ API Server 健康"
    else
        log_error "✗ API Server 不健康"
    fi

    # Gateway
    if curl -f http://localhost:18789/health &> /dev/null; then
        log_info "✓ Gateway 健康"
    else
        log_error "✗ Gateway 不健康"
    fi

    # PostgreSQL
    if docker exec mtbot-postgres pg_isready -U mtbot_admin &> /dev/null; then
        log_info "✓ PostgreSQL 健康"
    else
        log_error "✗ PostgreSQL 不健康"
    fi

    # Redis
    if docker exec mtbot-redis redis-cli -a "${REDIS_PASSWORD:-Oc@2026!Rd#Secure}" ping &> /dev/null; then
        log_info "✓ Redis 健康"
    else
        log_error "✗ Redis 不健康"
    fi

    # MinIO
    if curl -f http://localhost:22003/minio/health/live &> /dev/null; then
        log_info "✓ MinIO 健康"
    else
        log_error "✗ MinIO 不健康"
    fi
}

# 主函数
main() {
    case "${1:-}" in
        init)
            init_environment
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        backup)
            backup_database
            ;;
        update)
            update_services
            ;;
        clean)
            clean_all
            ;;
        health)
            health_check
            ;;
        *)
            echo "MtBot 部署脚本"
            echo ""
            echo "使用方式: $0 [command]"
            echo ""
            echo "命令:"
            echo "  init      - 初始化环境（首次部署）"
            echo "  start     - 启动所有服务"
            echo "  stop      - 停止所有服务"
            echo "  restart   - 重启所有服务"
            echo "  status    - 查看服务状态"
            echo "  logs      - 查看日志"
            echo "  backup    - 备份数据库"
            echo "  update    - 更新代码并重启"
            echo "  health    - 健康检查"
            echo "  clean     - 清理所有数据（危险！）"
            echo ""
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
