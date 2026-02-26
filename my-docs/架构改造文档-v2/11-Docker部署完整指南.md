# MtBot Docker 部署完整指南

> 版本: 1.0 | 创建日期: 2026-02-17 | 状态: 生产就绪

---

## 📋 目录

1. [系统架构](#系统架构)
2. [前置要求](#前置要求)
3. [快速开始](#快速开始)
4. [详细配置](#详细配置)
5. [服务管理](#服务管理)
6. [数据初始化](#数据初始化)
7. [监控与日志](#监控与日志)
8. [故障排查](#故障排查)
9. [安全加固](#安全加固)
10. [备份与恢复](#备份与恢复)

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        MtBot 系统架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Windows 客户端│    │  Web 管理端  │    │  移动端应用  │     │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             │                                  │
│         ┌───────────────────▼───────────────────┐              │
│         │      Nginx 反向代理 (可选)             │              │
│         └───────────────────┬───────────────────┘              │
│                             │                                  │
│         ┌───────────────────┼───────────────────┐              │
│         │                   │                   │              │
│    ┌────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐       │
│    │ Gateway  │      │ API Server  │    │ Web Admin   │       │
│    │ :18789   │      │ :3000       │    │ :3001       │       │
│    └────┬─────┘      └──────┬──────┘    └─────────────┘       │
│         │                   │                                  │
│         └───────────────────┼───────────────────┐              │
│                             │                   │              │
│         ┌───────────────────▼───────────────────▼──────┐       │
│         │           基础设施层 (docker-compose)          │       │
│         ├──────────────────────────────────────────────┤       │
│         │ PostgreSQL  Redis  MinIO  (Milvus  Neo4j)   │       │
│         │   :22001    :22002  :22003   :22005  :22007  │       │
│         └──────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 前置要求

### 硬件要求

| 配置项 | 最小配置 | 推荐配置 | 生产环境 |
| ------ | -------- | -------- | -------- |
| CPU    | 2 核     | 4 核     | 8 核+    |
| 内存   | 4 GB     | 8 GB     | 16 GB+   |
| 磁盘   | 20 GB    | 50 GB    | 100 GB+  |
| 网络   | 10 Mbps  | 100 Mbps | 1 Gbps   |

### 软件要求

- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- **Docker**: 20.10+ (推荐 24.0+)
- **Docker Compose**: 2.0+ (推荐 2.20+)
- **Git**: 2.30+
- **Node.js**: 22.12.0+ (用于构建)
- **pnpm**: 10.23.0+ (用于构建)

### 端口要求

确保以下端口未被占用：

| 服务          | 端口  | 说明           |
| ------------- | ----- | -------------- |
| API Server    | 3000  | HTTP API 服务  |
| Web Admin     | 3001  | 管理后台       |
| Gateway       | 18789 | WebSocket 网关 |
| PostgreSQL    | 22001 | 数据库         |
| Redis         | 22002 | 缓存           |
| MinIO API     | 22003 | 对象存储 API   |
| MinIO Console | 22004 | MinIO 管理界面 |

---

## 快速开始

### 1. 克隆项目

```bash
# 克隆代码仓库
git clone https://github.com/your-org/mtbot.git
cd mtbot

# 切换到部署分支
git checkout feat/ai-assistant-platform
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.production

# 编辑环境变量（重要！）
nano .env.production
```

### 3. 启动基础设施

```bash
# 启动核心服务（PostgreSQL + Redis + MinIO）
docker-compose -f docker-compose.infra.yml up -d

# 等待服务健康检查通过
docker-compose -f docker-compose.infra.yml ps
```

### 4. 初始化数据库

```bash
# 运行数据库迁移
pnpm db:migrate

# 创建初始管理员账户
pnpm db:seed
```

### 5. 构建并启动应用

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build

# 启动 API Server
cd apps/api-server
pnpm start &

# 启动 Gateway
cd ../..
pnpm gateway:dev &
```

### 6. 验证部署

```bash
# 检查 API Server 健康状态
curl http://localhost:3000/health

# 检查 Gateway 连接
wscat -c ws://localhost:18789

# 访问管理后台
open http://localhost:3001
```

---

## 详细配置

### 环境变量配置

创建 `.env.production` 文件：

```bash
# ==================== 应用配置 ====================

# 环境标识
NODE_ENV=production

# 应用名称
APP_NAME=MtBot

# 应用版本
APP_VERSION=2026.1.30

# ==================== 数据库配置 ====================

# PostgreSQL 连接
DATABASE_URL=postgresql://mtbot_admin:Oc@2026!Pg#Secure@localhost:22001/mtbot_prod

# 数据库连接池
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ==================== Redis 配置 ====================

# Redis 连接
REDIS_HOST=localhost
REDIS_PORT=22002
REDIS_PASSWORD=Oc@2026!Rd#Secure
REDIS_DB=0

# Redis 连接池
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10

# ==================== MinIO 配置 ====================

# MinIO 连接
MINIO_ENDPOINT=localhost
MINIO_PORT=22003
MINIO_ACCESS_KEY=mtbot_minio
MINIO_SECRET_KEY=Oc@2026!Mn#Secure
MINIO_USE_SSL=false

# MinIO 存储桶
MINIO_BUCKET_DOCUMENTS=mtbot-documents
MINIO_BUCKET_MEDIA=mtbot-media
MINIO_BUCKET_TEMP=mtbot-temp
MINIO_BUCKET_EXPORTS=mtbot-exports
MINIO_BUCKET_SKILLS=mtbot-skills

# ==================== API Server 配置 ====================

# API Server 监听地址
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=3000

# API Server 公网地址（用于生成链接）
API_SERVER_PUBLIC_URL=http://your-domain.com:3000

# CORS 配置
API_CORS_ORIGINS=http://localhost:3001,http://your-domain.com:3001

# ==================== Gateway 配置 ====================

# Gateway 监听地址
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=18789

# Gateway 认证令牌（重要！请修改）
GATEWAY_TOKEN=your-secure-gateway-token-change-me

# ==================== JWT 配置 ====================

# JWT 密钥（重要！请修改为随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-me-to-random-string

# JWT 过期时间
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# ==================== 管理员配置 ====================

# 初始管理员账户
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@2026!Secure
ADMIN_EMAIL=admin@mtbot.top

# ==================== 日志配置 ====================

# 日志级别 (debug, info, warn, error)
LOG_LEVEL=info

# 日志输出格式 (json, pretty)
LOG_FORMAT=json

# 日志文件路径
LOG_FILE_PATH=./logs/mtbot.log

# ==================== 安全配置 ====================

# 速率限制
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# 会话配置
SESSION_SECRET=your-session-secret-change-me
SESSION_MAX_AGE=86400000

# ==================== 第三方服务 ====================

# Claude AI (可选)
CLAUDE_AI_SESSION_KEY=

# OpenAI (可选)
OPENAI_API_KEY=

# ==================== 监控配置 (可选) ====================

# Prometheus
PROMETHEUS_ENABLED=false
PROMETHEUS_PORT=9090

# Grafana
GRAFANA_ENABLED=false
GRAFANA_PORT=22012
```

### Docker Compose 配置

创建 `docker-compose.prod.yml`：

```yaml
version: "3.8"

services:
  # API Server
  api-server:
    build:
      context: .
      dockerfile: apps/api-server/Dockerfile
    container_name: mtbot-api-server
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "${API_SERVER_PORT:-3000}:3000"
    depends_on:
      - postgres
      - redis
      - minio
    networks:
      - mtbot-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - ./logs:/app/logs

  # Gateway
  gateway:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mtbot-gateway
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "${GATEWAY_PORT:-18789}:18789"
    depends_on:
      - postgres
      - redis
    networks:
      - mtbot-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - ./logs:/app/logs

  # Web Admin (可选)
  web-admin:
    build:
      context: .
      dockerfile: apps/web-admin/Dockerfile
    container_name: mtbot-web-admin
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "3001:3001"
    depends_on:
      - api-server
    networks:
      - mtbot-network

networks:
  mtbot-network:
    external: true
    name: mtbot-network
```

---

## 服务管理

### 启动服务

```bash
# 1. 启动基础设施
docker-compose -f docker-compose.infra.yml up -d

# 2. 等待服务就绪（约 30 秒）
sleep 30

# 3. 启动应用服务
docker-compose -f docker-compose.prod.yml up -d

# 4. 查看服务状态
docker-compose -f docker-compose.prod.yml ps
```

### 停止服务

```bash
# 停止应用服务
docker-compose -f docker-compose.prod.yml down

# 停止基础设施（保留数据）
docker-compose -f docker-compose.infra.yml down

# 停止并删除所有数据（危险！）
docker-compose -f docker-compose.infra.yml down -v
```

### 重启服务

```bash
# 重启单个服务
docker-compose -f docker-compose.prod.yml restart api-server

# 重启所有服务
docker-compose -f docker-compose.prod.yml restart
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f api-server

# 查看最近 100 行日志
docker-compose -f docker-compose.prod.yml logs --tail=100 gateway
```

---

## 数据初始化

### 数据库迁移

```bash
# 运行所有迁移
pnpm db:migrate

# 回滚最后一次迁移
pnpm db:migrate:rollback

# 查看迁移状态
pnpm db:migrate:status
```

### 创建初始数据

```bash
# 创建管理员账户和基础数据
pnpm db:seed

# 仅创建管理员账户
pnpm db:seed --admin-only
```

### MinIO 存储桶初始化

MinIO 存储桶会在 `minio-init` 服务中自动创建，包括：

- `mtbot-documents` - 文档存储
- `mtbot-media` - 多媒体文件
- `mtbot-temp` - 临时文件
- `mtbot-exports` - 导出文件
- `mtbot-skills` - 技能包存储

如需手动创建：

```bash
# 进入 MinIO 容器
docker exec -it mtbot-minio mc alias set myminio http://localhost:9000 mtbot_minio 'Oc@2026!Mn#Secure'

# 创建存储桶
docker exec -it mtbot-minio mc mb myminio/mtbot-skills

# 设置公开访问（仅用于媒体文件）
docker exec -it mtbot-minio mc anonymous set download myminio/mtbot-media
```

---

## 监控与日志

### 健康检查

```bash
# API Server 健康检查
curl http://localhost:3000/health

# Gateway 健康检查
curl http://localhost:18789/health

# PostgreSQL 健康检查
docker exec mtbot-postgres pg_isready -U mtbot_admin

# Redis 健康检查
docker exec mtbot-redis redis-cli -a 'Oc@2026!Rd#Secure' ping

# MinIO 健康检查
curl http://localhost:22003/minio/health/live
```

### 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看特定服务资源使用
docker stats mtbot-api-server mtbot-gateway

# 查看数据库连接数
docker exec mtbot-postgres psql -U mtbot_admin -d mtbot_prod -c "SELECT count(*) FROM pg_stat_activity;"
```

### 日志收集

应用日志位置：

- API Server: `./logs/api-server.log`
- Gateway: `./logs/gateway.log`
- PostgreSQL: `docker logs mtbot-postgres`
- Redis: `docker logs mtbot-redis`

---

## 故障排查

### 常见问题

#### 1. 数据库连接失败

**症状**: `ECONNREFUSED` 或 `Connection timeout`

**解决方案**:

```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 检查 PostgreSQL 日志
docker logs mtbot-postgres

# 测试数据库连接
docker exec mtbot-postgres psql -U mtbot_admin -d mtbot_prod -c "SELECT 1;"

# 检查防火墙规则
sudo ufw status
```

#### 2. MinIO 上传失败

**症状**: `SignatureDoesNotMatch` 或 `Access Denied`

**解决方案**:

```bash
# 检查 MinIO 配置
docker exec mtbot-minio mc admin info myminio

# 验证访问密钥
echo $MINIO_ACCESS_KEY
echo $MINIO_SECRET_KEY

# 重新创建存储桶
docker exec mtbot-minio mc mb --ignore-existing myminio/mtbot-skills
```

#### 3. Gateway 连接断开

**症状**: WebSocket 连接频繁断开

**解决方案**:

```bash
# 检查 Gateway 日志
docker logs mtbot-gateway

# 检查 Redis 连接
docker exec mtbot-redis redis-cli -a 'Oc@2026!Rd#Secure' ping

# 重启 Gateway
docker-compose -f docker-compose.prod.yml restart gateway
```

#### 4. 内存不足

**症状**: 容器频繁重启，OOM 错误

**解决方案**:

```bash
# 查看内存使用
free -h
docker stats --no-stream

# 增加 swap 空间
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 限制容器内存
# 在 docker-compose.prod.yml 中添加:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

---

## 安全加固

### 1. 修改默认密码

```bash
# 修改 PostgreSQL 密码
docker exec -it mtbot-postgres psql -U mtbot_admin -d mtbot_prod
ALTER USER mtbot_admin WITH PASSWORD 'new-secure-password';

# 修改 Redis 密码
# 编辑 docker-compose.infra.yml 中的 REDIS_PASSWORD

# 修改 MinIO 密码
docker exec -it mtbot-minio mc admin user add myminio newuser newsecurepassword
```

### 2. 启用 HTTPS

使用 Nginx 反向代理：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # API Server
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Gateway WebSocket
    location /ws {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. 防火墙配置

```bash
# 仅允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# 限制数据库访问（仅本地）
sudo ufw deny 22001/tcp
```

### 4. 定期更新

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 更新 Docker 镜像
docker-compose -f docker-compose.infra.yml pull
docker-compose -f docker-compose.prod.yml pull

# 重启服务
docker-compose -f docker-compose.prod.yml up -d
```

---

## 备份与恢复

### 数据库备份

```bash
# 创建备份目录
mkdir -p ./backups

# 备份 PostgreSQL
docker exec mtbot-postgres pg_dump -U mtbot_admin mtbot_prod > ./backups/postgres-$(date +%Y%m%d-%H%M%S).sql

# 自动化备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

# PostgreSQL 备份
docker exec mtbot-postgres pg_dump -U mtbot_admin mtbot_prod | gzip > $BACKUP_DIR/postgres-$DATE.sql.gz

# 保留最近 7 天的备份
find $BACKUP_DIR -name "postgres-*.sql.gz" -mtime +7 -delete

echo "Backup completed: postgres-$DATE.sql.gz"
EOF

chmod +x backup.sh

# 添加到 crontab（每天凌晨 2 点备份）
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

### 数据库恢复

```bash
# 恢复 PostgreSQL
docker exec -i mtbot-postgres psql -U mtbot_admin mtbot_prod < ./backups/postgres-20260217-020000.sql

# 或从压缩文件恢复
gunzip -c ./backups/postgres-20260217-020000.sql.gz | docker exec -i mtbot-postgres psql -U mtbot_admin mtbot_prod
```

### MinIO 备份

```bash
# 备份 MinIO 数据
docker exec mtbot-minio mc mirror myminio/mtbot-skills ./backups/minio-skills

# 恢复 MinIO 数据
docker exec mtbot-minio mc mirror ./backups/minio-skills myminio/mtbot-skills
```

---

## 附录

### A. 完整端口列表

| 服务          | 端口  | 协议      | 说明         |
| ------------- | ----- | --------- | ------------ |
| API Server    | 3000  | HTTP      | REST API     |
| Web Admin     | 3001  | HTTP      | 管理后台     |
| Gateway       | 18789 | WebSocket | 实时通信     |
| PostgreSQL    | 22001 | TCP       | 数据库       |
| Redis         | 22002 | TCP       | 缓存         |
| MinIO API     | 22003 | HTTP      | 对象存储     |
| MinIO Console | 22004 | HTTP      | MinIO 管理   |
| Milvus        | 22005 | gRPC      | 向量数据库   |
| Neo4j HTTP    | 22007 | HTTP      | 图数据库     |
| Neo4j Bolt    | 22008 | TCP       | 图数据库协议 |
| Prometheus    | 22011 | HTTP      | 监控         |
| Grafana       | 22012 | HTTP      | 仪表盘       |
| pgAdmin       | 22014 | HTTP      | 数据库管理   |

### B. 环境变量完整列表

参见 `.env.production` 配置文件。

### C. 故障排查检查清单

- [ ] 所有容器都在运行 (`docker ps`)
- [ ] 健康检查全部通过 (`docker-compose ps`)
- [ ] 数据库连接正常
- [ ] Redis 连接正常
- [ ] MinIO 存储桶已创建
- [ ] 日志无错误信息
- [ ] 端口未被占用
- [ ] 防火墙规则正确
- [ ] 磁盘空间充足 (`df -h`)
- [ ] 内存使用正常 (`free -h`)

---

## 联系支持

如遇到问题，请：

1. 查看日志文件
2. 参考故障排查章节
3. 提交 Issue: https://github.com/your-org/mtbot/issues
4. 联系技术支持: support@mtbot.top

---

**文档版本**: 1.0
**最后更新**: 2026-02-17
**维护者**: MtBot Team
