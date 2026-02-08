---
title: "Docker Compose 服务端部署指南"
description: "使用 Docker Compose 部署 OpenClaw 完整服务端环境"
---

# Docker Compose 服务端部署指南

本文档详细介绍如何使用 Docker Compose 部署 OpenClaw 完整服务端环境，包括基础设施服务和核心应用服务。

## 目录

- [架构概览](#架构概览)
- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [基础设施服务](#基础设施服务)
- [核心服务部署](#核心服务部署)
- [环境变量配置](#环境变量配置)
- [服务管理](#服务管理)
- [监控与日志](#监控与日志)
- [数据备份与恢复](#数据备份与恢复)
- [故障排查](#故障排查)
- [生产环境建议](#生产环境建议)

---

## 架构概览

OpenClaw 服务端由两部分组成：

```
┌─────────────────────────────────────────────────────────────────┐
│                      OpenClaw 服务端架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              核心服务 (docker-compose.yml)                │   │
│  │  ┌─────────────────┐    ┌─────────────────┐             │   │
│  │  │ openclaw-gateway│    │  openclaw-cli   │             │   │
│  │  │   (端口 18789)   │    │   (交互式 CLI)   │             │   │
│  │  └─────────────────┘    └─────────────────┘             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          基础设施 (docker-compose.infra.yml)              │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │PostgreSQL│ │  Redis   │ │  MinIO   │ │ Milvus   │   │   │
│  │  │  :22001  │ │  :22002  │ │  :22003  │ │  :22005  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  Neo4j   │ │ RabbitMQ │ │Prometheus│ │ Grafana  │   │   │
│  │  │  :22007  │ │  :22009  │ │  :22011  │ │  :22012  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 端口规划 (22000 系列)

| 端口  | 服务             | 用途               |
| ----- | ---------------- | ------------------ |
| 18789 | OpenClaw Gateway | 网关 API           |
| 18790 | OpenClaw Bridge  | Bridge 服务        |
| 22001 | PostgreSQL       | 主数据库           |
| 22002 | Redis            | 缓存/会话存储      |
| 22003 | MinIO API        | 对象存储 API       |
| 22004 | MinIO Console    | MinIO 管理界面     |
| 22005 | Milvus           | 向量数据库         |
| 22006 | Milvus gRPC      | Milvus gRPC 接口   |
| 22007 | Neo4j HTTP       | 图数据库 HTTP      |
| 22008 | Neo4j Bolt       | 图数据库 Bolt 协议 |
| 22009 | RabbitMQ         | 消息队列           |
| 22010 | RabbitMQ UI      | RabbitMQ 管理界面  |
| 22011 | Prometheus       | 监控指标收集       |
| 22012 | Grafana          | 监控仪表盘         |
| 22013 | Loki             | 日志聚合           |
| 22014 | pgAdmin          | PostgreSQL 管理    |
| 22015 | Redis Commander  | Redis 管理界面     |
| 22016 | Milvus Attu      | Milvus 管理界面    |

---

## 前置要求

### 硬件要求

| 配置项 | 最低要求  | 推荐配置    |
| ------ | --------- | ----------- |
| CPU    | 2 核      | 4 核及以上  |
| 内存   | 4 GB      | 8 GB 及以上 |
| 磁盘   | 20 GB SSD | 50 GB SSD   |

### 软件要求

- Docker Engine 24.0+
- Docker Compose v2.20+
- Git

### 验证 Docker 环境

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker compose version

# 确保 Docker 服务运行中
docker info
```

---

## 快速开始

### 一键部署 (推荐)

```bash
# 1. 克隆仓库
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# 2. 复制环境变量配置文件
cp .env.example .env
cp .env.infra.example .env.infra

# 3. 启动基础设施服务
docker compose -f docker-compose.infra.yml --env-file .env.infra up -d

# 4. 等待服务就绪 (约 30 秒)
sleep 30

# 5. 运行自动化部署脚本
./docker-setup.sh
```

### 验证部署

```bash
# 检查所有容器状态
docker compose -f docker-compose.infra.yml ps
docker compose ps

# 检查网关健康状态
curl http://localhost:18789/health
```

---

## 基础设施服务

### 服务组件说明

#### 核心数据库 - PostgreSQL

主数据库，存储用户数据、订阅信息、管理员账户、审计日志等。

```bash
# 单独启动 PostgreSQL
docker compose -f docker-compose.infra.yml up -d postgres

# 连接数据库
docker exec -it openclaw-postgres psql -U openclaw_admin -d openclaw_prod
```

#### 缓存服务 - Redis

用于会话缓存、工作记忆、速率限制、消息队列。

```bash
# 单独启动 Redis
docker compose -f docker-compose.infra.yml up -d redis

# 连接 Redis CLI
docker exec -it openclaw-redis redis-cli -a 'Oc@2026!Rd#Secure'
```

#### 对象存储 - MinIO

S3 兼容的对象存储，用于文件上传、多媒体存储、导出文件。

```bash
# 单独启动 MinIO
docker compose -f docker-compose.infra.yml up -d minio minio-init

# 访问 MinIO 控制台
# URL: http://localhost:22004
# 用户名: openclaw_minio
# 密码: Oc@2026!Mn#Secure
```

默认创建的存储桶：

- `openclaw-documents` - 文档存储
- `openclaw-media` - 媒体文件 (公开访问)
- `openclaw-temp` - 临时文件
- `openclaw-exports` - 导出文件

#### 向量数据库 - Milvus (可选)

用于知识记忆、语义搜索、相似度匹配。

```bash
# 启动 Milvus 及其依赖
docker compose -f docker-compose.infra.yml --profile knowledge up -d milvus-etcd milvus-minio milvus

# 访问 Milvus 管理界面 (Attu)
# URL: http://localhost:22016
```

#### 图数据库 - Neo4j (可选)

用于知识图谱、实体关系存储、图查询。

```bash
# 启动 Neo4j
docker compose -f docker-compose.infra.yml --profile knowledge up -d neo4j

# 访问 Neo4j 浏览器
# URL: http://localhost:22007
# 用户名: neo4j_admin
# 密码: Oc@2026!N4j#Secure
```

#### 消息队列 - RabbitMQ (可选)

用于异步任务处理、事件驱动架构。

```bash
# 启动 RabbitMQ
docker compose -f docker-compose.infra.yml --profile queue up -d rabbitmq

# 访问 RabbitMQ 管理界面
# URL: http://localhost:22010
# 用户名: openclaw_mq
# 密码: Oc@2026!Mq#Secure
```

### 启动模式

根据需求选择不同的启动模式：

```bash
# 模式 1: 仅核心服务 (PostgreSQL + Redis + MinIO)
docker compose -f docker-compose.infra.yml up -d

# 模式 2: 核心 + 知识图谱 (+ Milvus + Neo4j)
docker compose -f docker-compose.infra.yml --profile knowledge up -d

# 模式 3: 核心 + 消息队列 (+ RabbitMQ)
docker compose -f docker-compose.infra.yml --profile queue up -d

# 模式 4: 核心 + 监控 (+ Prometheus + Grafana + Loki)
docker compose -f docker-compose.infra.yml --profile monitoring up -d

# 模式 5: 核心 + 开发工具 (+ pgAdmin + Redis Commander + Attu)
docker compose -f docker-compose.infra.yml --profile dev-tools up -d

# 模式 6: 全部服务
docker compose -f docker-compose.infra.yml --profile all up -d
```

### 服务依赖关系

```
PostgreSQL ─────────────────────────────────────┐
Redis ──────────────────────────────────────────┤
MinIO ──────────────────────────────────────────┼──► OpenClaw Gateway
    └── minio-init (初始化存储桶)               │
                                                │
Milvus ─────────────────────────────────────────┤ (可选)
    ├── milvus-etcd                             │
    └── milvus-minio                            │
                                                │
Neo4j ──────────────────────────────────────────┤ (可选)
RabbitMQ ───────────────────────────────────────┘ (可选)
```

---

## 核心服务部署

### 方式一：使用自动化脚本 (推荐)

```bash
# 运行部署脚本
./docker-setup.sh
```

脚本执行流程：

1. 构建 OpenClaw Docker 镜像
2. 运行 onboard 初始化向导
3. 生成 Gateway Token 并写入 `.env`
4. 启动 Gateway 服务

### 方式二：手动部署

```bash
# 1. 构建镜像
docker build -t openclaw:local -f Dockerfile .

# 2. 设置环境变量
export OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
export OPENCLAW_WORKSPACE_DIR="$HOME/.openclaw/workspace"
export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)

# 3. 创建配置目录
mkdir -p "$OPENCLAW_CONFIG_DIR"
mkdir -p "$OPENCLAW_WORKSPACE_DIR"

# 4. 运行 onboard 初始化
docker compose run --rm openclaw-cli onboard --no-install-daemon

# 5. 启动 Gateway
docker compose up -d openclaw-gateway
```

### 配置 Channel (消息通道)

#### WhatsApp (QR 码登录)

```bash
docker compose run --rm openclaw-cli channels login
```

#### Telegram (Bot Token)

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<YOUR_BOT_TOKEN>"
```

#### Discord (Bot Token)

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<YOUR_BOT_TOKEN>"
```

### 健康检查

```bash
# 检查 Gateway 健康状态
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"

# 或使用 curl
curl -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" http://localhost:18789/health
```

---

## 环境变量配置

### 基础设施环境变量 (`.env.infra`)

```bash
# ==================== PostgreSQL ====================
POSTGRES_USER=openclaw_admin
POSTGRES_PASSWORD=Oc@2026!Pg#Secure    # 生产环境请修改
POSTGRES_DB=openclaw_prod
POSTGRES_PORT=22001

# ==================== Redis ====================
REDIS_PASSWORD=Oc@2026!Rd#Secure       # 生产环境请修改
REDIS_PORT=22002

# ==================== MinIO ====================
MINIO_ACCESS_KEY=openclaw_minio
MINIO_SECRET_KEY=Oc@2026!Mn#Secure     # 生产环境请修改
MINIO_API_PORT=22003
MINIO_CONSOLE_PORT=22004

# ==================== Milvus ====================
MILVUS_PORT=22005
MILVUS_GRPC_PORT=22006
ATTU_PORT=22016

# ==================== Neo4j ====================
NEO4J_USER=neo4j_admin
NEO4J_PASSWORD=Oc@2026!N4j#Secure      # 生产环境请修改
NEO4J_HTTP_PORT=22007
NEO4J_BOLT_PORT=22008

# ==================== RabbitMQ ====================
RABBITMQ_USER=openclaw_mq
RABBITMQ_PASSWORD=Oc@2026!Mq#Secure    # 生产环境请修改
RABBITMQ_PORT=22009
RABBITMQ_MANAGEMENT_PORT=22010

# ==================== 监控组件 ====================
PROMETHEUS_PORT=22011
GRAFANA_USER=grafana_admin
GRAFANA_PASSWORD=Oc@2026!Gf#Secure     # 生产环境请修改
GRAFANA_PORT=22012
GRAFANA_ROOT_URL=http://localhost:22012
LOKI_PORT=22013

# ==================== 开发工具 ====================
PGADMIN_EMAIL=admin@openclaw.ai
PGADMIN_PASSWORD=Oc@2026!Pga#Secure    # 生产环境请修改
PGADMIN_PORT=22014
REDIS_COMMANDER_PORT=22015
```

### 应用环境变量 (`.env`)

```bash
# ==================== 数据库连接 ====================
DATABASE_URL=postgresql://openclaw_admin:Oc@2026!Pg#Secure@localhost:22001/openclaw_prod
DATABASE_MAX_CONNECTIONS=10
DATABASE_CONNECTION_TIMEOUT_MS=10000
DATABASE_IDLE_TIMEOUT_MS=300000
DATABASE_SSL=false

# ==================== Redis 连接 ====================
REDIS_URL=redis://:Oc@2026!Rd#Secure@localhost:22002/0

# ==================== MinIO 连接 ====================
MINIO_ENDPOINT=localhost
MINIO_PORT=22003
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=openclaw_minio
MINIO_SECRET_KEY=Oc@2026!Mn#Secure

# ==================== Milvus 连接 ====================
MILVUS_ADDRESS=localhost:22005
MILVUS_TOKEN=
MILVUS_DATABASE=default

# ==================== Neo4j 连接 ====================
NEO4J_URI=bolt://localhost:22008
NEO4J_USER=neo4j_admin
NEO4J_PASSWORD=Oc@2026!N4j#Secure

# ==================== JWT 配置 ====================
JWT_SECRET=Oc@2026!JwtSecret#32CharMinimumRequired  # 生产环境请修改
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ==================== Embedding 模型 ====================
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
# EMBEDDING_API_KEY=your_api_key

# ==================== OpenClaw Gateway ====================
OPENCLAW_CONFIG_DIR=/path/to/.openclaw
OPENCLAW_WORKSPACE_DIR=/path/to/.openclaw/workspace
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_TOKEN=your_generated_token
OPENCLAW_IMAGE=openclaw:local
```

### 生产环境密码生成

```bash
# 生成安全的随机密码
openssl rand -base64 32

# 或使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 服务管理

### 常用命令

```bash
# 查看所有服务状态
docker compose -f docker-compose.infra.yml ps
docker compose ps

# 查看服务日志
docker compose -f docker-compose.infra.yml logs -f [service_name]
docker compose logs -f openclaw-gateway

# 重启服务
docker compose -f docker-compose.infra.yml restart [service_name]
docker compose restart openclaw-gateway

# 停止所有服务
docker compose -f docker-compose.infra.yml down
docker compose down

# 停止并删除数据卷 (危险操作!)
docker compose -f docker-compose.infra.yml down -v
```

### 服务扩缩容

```bash
# 扩展服务实例 (如果支持)
docker compose -f docker-compose.infra.yml up -d --scale redis=2
```

### 更新服务

```bash
# 拉取最新代码
git pull origin main

# 重新构建镜像
docker build -t openclaw:local -f Dockerfile .

# 重启服务
docker compose up -d openclaw-gateway
```

---

## 监控与日志

### Prometheus 监控

访问地址: `http://localhost:22011`

默认监控目标:

- Prometheus 自身
- (可扩展) PostgreSQL、Redis、MinIO、OpenClaw Gateway

### Grafana 仪表盘

访问地址: `http://localhost:22012`

默认凭据:

- 用户名: `grafana_admin`
- 密码: `Oc@2026!Gf#Secure`

预配置数据源:

- Prometheus (默认)
- Loki (日志)
- PostgreSQL

### Loki 日志聚合

访问地址: `http://localhost:22013`

日志保留策略: 30 天

### 查看容器日志

```bash
# 实时查看 Gateway 日志
docker compose logs -f openclaw-gateway

# 查看最近 100 行日志
docker compose logs --tail=100 openclaw-gateway

# 查看所有基础设施服务日志
docker compose -f docker-compose.infra.yml logs -f
```

---

## 数据备份与恢复

### PostgreSQL 备份

```bash
# 创建备份
docker exec openclaw-postgres pg_dump -U openclaw_admin openclaw_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复备份
docker exec -i openclaw-postgres psql -U openclaw_admin openclaw_prod < backup_20240101_120000.sql
```

### Redis 备份

```bash
# 触发 RDB 快照
docker exec openclaw-redis redis-cli -a 'Oc@2026!Rd#Secure' BGSAVE

# 复制备份文件
docker cp openclaw-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

### MinIO 备份

```bash
# 使用 mc 客户端备份
docker run --rm -v $(pwd)/minio-backup:/backup \
  --network openclaw-network \
  minio/mc sh -c "
    mc alias set myminio http://minio:9000 openclaw_minio 'Oc@2026!Mn#Secure' && \
    mc mirror myminio/openclaw-documents /backup/documents && \
    mc mirror myminio/openclaw-media /backup/media
  "
```

### 数据卷备份

```bash
# 备份所有数据卷
for vol in $(docker volume ls -q | grep openclaw); do
  docker run --rm -v $vol:/data -v $(pwd)/backups:/backup alpine \
    tar czf /backup/${vol}_$(date +%Y%m%d).tar.gz -C /data .
done
```

---

## 故障排查

### 常见问题

#### 1. 容器启动失败

```bash
# 查看容器日志
docker compose -f docker-compose.infra.yml logs [service_name]

# 检查容器状态
docker inspect [container_name]
```

#### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker compose -f docker-compose.infra.yml ps postgres

# 测试连接
docker exec -it openclaw-postgres pg_isready -U openclaw_admin -d openclaw_prod
```

#### 3. Redis 连接失败

```bash
# 检查 Redis 是否运行
docker compose -f docker-compose.infra.yml ps redis

# 测试连接
docker exec -it openclaw-redis redis-cli -a 'Oc@2026!Rd#Secure' ping
```

#### 4. 端口冲突

```bash
# 检查端口占用
netstat -tlnp | grep 22001
# 或
ss -tlnp | grep 22001

# 修改 .env.infra 中的端口配置
```

#### 5. 磁盘空间不足

```bash
# 检查 Docker 磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a --volumes
```

#### 6. 内存不足

```bash
# 检查容器内存使用
docker stats

# 调整容器内存限制 (在 docker-compose.yml 中)
```

### 健康检查命令

```bash
# PostgreSQL
docker exec openclaw-postgres pg_isready -U openclaw_admin

# Redis
docker exec openclaw-redis redis-cli -a 'Oc@2026!Rd#Secure' ping

# MinIO
docker exec openclaw-minio mc ready local

# Milvus
curl -f http://localhost:22006/healthz

# Neo4j
curl -f http://localhost:22007

# RabbitMQ
docker exec openclaw-rabbitmq rabbitmq-diagnostics check_port_connectivity
```

---

## 生产环境建议

### 安全加固

1. **修改所有默认密码**

   ```bash
   # 生成强密码
   openssl rand -base64 32
   ```

2. **启用 SSL/TLS**
   - 配置 PostgreSQL SSL
   - 配置 Redis TLS
   - 配置 MinIO HTTPS

3. **网络隔离**
   - 仅暴露必要端口
   - 使用防火墙规则

4. **定期更新**
   ```bash
   # 更新基础镜像
   docker compose -f docker-compose.infra.yml pull
   docker compose -f docker-compose.infra.yml up -d
   ```

### 高可用配置

1. **PostgreSQL 主从复制**
2. **Redis Sentinel 或 Cluster**
3. **MinIO 分布式模式**
4. **负载均衡器 (Nginx/HAProxy)**

### 资源限制

在 `docker-compose.infra.yml` 中添加资源限制:

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2G
        reservations:
          cpus: "1"
          memory: 1G
```

### 日志管理

1. 配置日志轮转
2. 集中日志收集 (Loki/ELK)
3. 设置日志保留策略

### 监控告警

1. 配置 Prometheus 告警规则
2. 集成告警通知 (邮件/Slack/钉钉)
3. 设置关键指标阈值

---

## 附录

### 文件结构

```
openclaw/
├── docker-compose.yml           # 核心服务配置
├── docker-compose.infra.yml     # 基础设施配置
├── docker-compose.extra.yml     # 额外挂载配置 (自动生成)
├── Dockerfile                   # 主镜像构建文件
├── Dockerfile.sandbox           # 沙箱镜像
├── Dockerfile.sandbox-browser   # 浏览器沙箱镜像
├── docker-setup.sh              # 自动化部署脚本
├── .env                         # 应用环境变量
├── .env.example                 # 应用环境变量示例
├── .env.infra                   # 基础设施环境变量
├── .env.infra.example           # 基础设施环境变量示例
└── docker-init/                 # 初始化配置
    ├── postgres/
    │   └── 01-init.sql          # PostgreSQL 初始化脚本
    ├── prometheus/
    │   └── prometheus.yml       # Prometheus 配置
    ├── loki/
    │   └── loki-config.yml      # Loki 配置
    └── grafana/
        └── provisioning/
            └── datasources/
                └── datasources.yml  # Grafana 数据源配置
```

---

## Windows 客户端部署

### 概述

OpenClaw Windows 客户端是一个基于 Electron 的桌面应用，可以作为 Gateway 的远程控制终端。它提供了：

- **图形化界面**: 系统托盘常驻，随时唤起
- **远程命令执行**: 可替代 `openclaw-cli` 执行脚本和命令
- **文件操作**: 支持文件读写、目录浏览
- **系统监控**: 查看进程、磁盘、内存等系统信息
- **设备配对**: 通过配对码安全连接到 Gateway

### 功能对比：Windows 客户端 vs openclaw-cli

| 功能         | Windows 客户端       | openclaw-cli |
| ------------ | -------------------- | ------------ |
| 命令执行     | ✅ 支持 (白名单限制) | ✅ 完整支持  |
| 文件操作     | ✅ 支持 (路径限制)   | ✅ 完整支持  |
| 系统信息     | ✅ 支持              | ✅ 支持      |
| 进程管理     | ✅ 支持              | ✅ 支持      |
| Channel 配置 | ❌ 不支持            | ✅ 支持      |
| Gateway 管理 | ❌ 不支持            | ✅ 支持      |
| 交互式终端   | ❌ 不支持            | ✅ 支持      |
| 图形界面     | ✅ 支持              | ❌ 不支持    |
| 系统托盘     | ✅ 支持              | ❌ 不支持    |
| 自动更新     | ✅ 支持              | ❌ 需手动    |

**结论**: Windows 客户端**不能完全替代** `openclaw-cli`，但可以作为日常使用的图形化辅助工具。对于 Channel 配置、Gateway 管理等高级操作，仍需使用 CLI。

### 安全机制

Windows 客户端实现了多层安全保护：

1. **命令白名单**: 仅允许执行预定义的命令

   ```typescript
   allowedCommands: ["powershell", "cmd", "tasklist", "taskkill", "systeminfo", "wmic"];
   ```

2. **路径访问限制**: 仅允许访问用户目录
   - `%USERPROFILE%` (用户主目录)
   - `%USERPROFILE%\Desktop`
   - `%USERPROFILE%\Documents`
   - `%USERPROFILE%\Downloads`
   - `%TEMP%`

3. **禁止访问的路径**:
   - `C:\Windows`
   - `C:\Program Files`
   - `C:\ProgramData`
   - `.ssh`, `.gnupg`, `.aws`, `.azure` 等敏感目录

4. **用户确认机制**: 高风险操作需要用户手动确认

### 构建 Windows 客户端

```bash
# 进入 Windows 客户端目录
cd apps/windows

# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 构建生产版本
pnpm build

# 打包为安装程序 (NSIS)
pnpm package:nsis:x64

# 打包为便携版 (Portable)
pnpm package:portable

# 打包为 ZIP
pnpm package:zip
```

### 打包输出

构建完成后，安装包位于 `apps/windows/release/` 目录：

| 文件                                    | 说明             |
| --------------------------------------- | ---------------- |
| `OpenClaw-Assistant-Setup-x.x.x.exe`    | NSIS 安装程序    |
| `OpenClaw-Assistant-x.x.x-portable.exe` | 便携版           |
| `OpenClaw-Assistant-x.x.x-win.zip`      | ZIP 压缩包       |
| `win-unpacked/`                         | 未打包的应用目录 |

### 配置与连接

1. **启动应用**: 运行安装程序或便携版
2. **系统托盘**: 应用启动后常驻系统托盘
3. **配对连接**:
   - 点击托盘图标打开主窗口
   - 输入 Gateway 地址 (如 `ws://192.168.1.100:18789`)
   - 使用配对码完成设备配对
4. **Token 认证**: 配对成功后自动保存 Token

### 远程命令执行流程

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Gateway   │ ◄─────────────────► │  Windows    │
│   Server    │                     │  Client     │
└─────────────┘                     └─────────────┘
       │                                   │
       │  1. command.execute.request       │
       │ ─────────────────────────────────►│
       │                                   │
       │                            2. 白名单验证
       │                            3. 用户确认 (可选)
       │                            4. 执行命令
       │                                   │
       │  5. assistant.command.result      │
       │ ◄─────────────────────────────────│
       │                                   │
```

### 开发模式

```bash
# 启动开发服务器
cd apps/windows
pnpm dev

# 开发模式会自动打开 DevTools
# 热重载支持，修改代码后自动刷新
```

### 注意事项

1. **Gateway 必须先启动**: Windows 客户端是 Gateway 的客户端，需要先部署 Gateway
2. **网络连通性**: 确保 Windows 客户端能访问 Gateway 的 WebSocket 端口 (默认 18789)
3. **防火墙配置**: 可能需要在 Windows 防火墙中允许应用访问网络
4. **Token 安全**: 配对 Token 保存在本地，请勿泄露

---

## 完整部署流程示例

### 场景：服务器 + Windows 客户端

```bash
# === 服务器端 (Linux/Docker) ===

# 1. 启动基础设施
docker compose -f docker-compose.infra.yml up -d

# 2. 构建并启动 Gateway
./docker-setup.sh

# 3. 记录 Gateway Token
echo $OPENCLAW_GATEWAY_TOKEN

# 4. 确保防火墙开放端口
# - 18789 (Gateway WebSocket)
# - 18790 (Bridge)

# === Windows 客户端 ===

# 1. 构建客户端
cd apps/windows
pnpm install
pnpm package:nsis:x64

# 2. 安装并运行
# 双击 release/OpenClaw-Assistant-Setup-x.x.x.exe

# 3. 配置连接
# - Gateway URL: ws://<服务器IP>:18789
# - 使用配对码或 Token 认证
```

### 相关文档

- [Docker 安装指南](/install/docker)
- [Gateway 配置](/gateway/configuration)
- [沙箱配置](/gateway/sandboxing)
- [Channel 配置](/channels)
- [故障排查](/gateway/troubleshooting)
