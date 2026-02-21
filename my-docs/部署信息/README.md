# OpenClaw 部署信息目录

本目录包含 OpenClaw 生产环境的完整部署配置和文档。

## 文件说明

### 核心文档

- **[生产环境部署文档.md](生产环境部署文档.md)** - 完整的部署流程和配置说明
- **[部署检查清单.md](部署检查清单.md)** - 部署前后的检查清单
- **[数据库初始化说明.md](数据库初始化说明.md)** - 数据库初始化流程

### 配置文件

- **[docker-compose.infra.yml](docker-compose.infra.yml)** - 基础设施服务配置（PostgreSQL、Redis、MinIO 等）
- **[docker-compose.prod.yml](docker-compose.prod.yml)** - 应用服务配置（API Server、Gateway）
- **[nginx.conf.example](nginx.conf.example)** - Nginx 反向代理配置示例

### 配置目录

- **[docker-init/](docker-init/)** - Docker 容器初始化配置
  - `postgres/` - PostgreSQL 数据库初始化脚本
  - `prometheus/` - Prometheus 监控配置
  - `loki/` - Loki 日志聚合配置
  - `grafana/` - Grafana 仪表盘配置
- **[mtbot.top_nginx/](mtbot.top_nginx/)** - SSL/TLS 证书文件目录

详见 [配置目录说明](配置目录说明.md)

### 环境变量示例

- **[env.infra.example.txt](env.infra.example.txt)** - 基础设施环境变量配置示例
- **[env.production.example.txt](env.production.example.txt)** - 应用环境变量配置示例

**注意**: `.env` 文件被 `.gitignore` 忽略，不会提交到版本控制。部署时需要从示例文件创建实际的配置文件：

```bash
cp env.infra.example.txt .env.infra
cp env.production.example.txt .env.production
```

## 快速开始

### 1. 准备环境变量

```bash
# 复制环境变量示例文件
cp env.infra.example.txt .env.infra
cp env.production.example.txt .env.production

# 编辑并修改所有密码和配置
nano .env.infra
nano .env.production
```

### 2. 启动基础设施

```bash
# 启动核心服务
docker-compose -f docker-compose.infra.yml --profile minimal up -d

# 或启动所有基础设施服务
docker-compose -f docker-compose.infra.yml up -d
```

### 3. 初始化数据库

```bash
# 执行数据库迁移
export DATABASE_URL="postgresql://openclaw_admin:password@localhost:22001/openclaw_prod"
pnpm db:migrate
```

### 4. 启动应用服务

```bash
# 启动所有应用服务
docker-compose -f docker-compose.prod.yml up -d
```

### 5. 部署前端应用

参考 [生产环境部署文档.md](生产环境部署文档.md) 中的"部署前端应用"章节。

## 服务端口

| 服务          | 端口  | 说明           |
| ------------- | ----- | -------------- |
| Website       | 22888 | 官方网站       |
| Admin Console | 22176 | 管理后台       |
| API Server    | 22300 | REST API       |
| Gateway       | 22189 | WebSocket 网关 |
| PostgreSQL    | 22001 | 数据库         |
| Redis         | 22002 | 缓存           |
| MinIO API     | 22003 | 对象存储       |
| MinIO Console | 22004 | 对象存储控制台 |

## 目录结构

```
部署信息/
├── README.md                          # 本文件
├── 生产环境部署文档.md                  # 完整部署文档
├── 部署检查清单.md                      # 检查清单
├── 数据库初始化说明.md                  # 数据库初始化
├── docker-compose.infra.yml           # 基础设施配置
├── docker-compose.prod.yml            # 应用服务配置
├── nginx.conf.example                 # Nginx 配置示例
├── env.infra.example.txt              # 基础设施环境变量示例
└── env.production.example.txt         # 应用环境变量示例
```

## 相关文档

- [OpenClaw 主项目 README](../../README.md)
- [Gateway 配置文档](../../docs/gateway/configuration.md)
- [Docker 部署指南](../../docs/install/docker-compose-deploy.md)

## 安全提示

⚠️ **重要**: 生产环境部署前，请务必：

1. 修改所有默认密码
2. 使用强密码（至少 16 位）
3. 配置 SSL/TLS 证书
4. 配置防火墙规则
5. 定期备份数据库
6. 不要将 `.env` 文件提交到版本控制

## 获取帮助

如遇到问题，请参考：

- [生产环境部署文档](生产环境部署文档.md) 中的"故障排查"章节
- [部署检查清单](部署检查清单.md)
- 项目 Issue: https://github.com/openclaw/openclaw/issues

## 自动化发布

### 本地一键发布（PowerShell）

新增脚本：`deploy-remote.ps1`

首次部署（远程目录还没有 git 仓库）：

```powershell
.\my-docs\部署信息\deploy-remote.ps1 `
  -Host 1.14.110.155 `
  -Port 22 `
  -User root `
  -KeyPath .\my-docs\部署信息\mtbot.pem `
  -RemoteDir /opt/mtbot `
  -Branch main `
  -RepoUrl <你的仓库地址>
```

后续持续更新（一次命令远程拉取并重建服务）：

```powershell
.\my-docs\部署信息\deploy-remote.ps1 `
  -Host 1.14.110.155 `
  -Port 22 `
  -User root `
  -KeyPath .\my-docs\部署信息\mtbot.pem `
  -RemoteDir /opt/mtbot `
  -Branch main
```

### GitHub Actions 自动发布

新增工作流：`.github/workflows/deploy-production.yml`

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions -> Secrets` 配置：

- `DEPLOY_HOST`：`1.14.110.155`
- `DEPLOY_USER`：`root`
- `DEPLOY_SSH_KEY`：`mtbot.pem` 文件完整内容

触发方式：

- 推送到 `main` 自动发布
- 手动 `Run workflow` 指定分支发布
