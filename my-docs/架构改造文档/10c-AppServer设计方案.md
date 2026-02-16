# 10c - App Server 设计方案

> 版本: 1.0 | 创建日期: 2026-02-12 | 状态: 规划中
>
> 上级文档: [10-多租户架构改造总体方案.md](./10-多租户架构改造总体方案.md)
>
> 参考文档: [04-管理后台系统设计.md](./04-管理后台系统设计.md)

---

## 1. 概述

### 1.1 目标

新建 `apps/api-server/` 独立 HTTP 服务，承接 Gateway 中的标准 CRUD 业务逻辑。将 Gateway 的职责从"全能网关"收窄为"实时控制面"。

### 1.2 核心原则

- **复用现有代码**：Drizzle DB 连接、Repository、Service 层直接引用 `src/db/` 和 `src/assistant/`
- **RESTful API 设计**：标准 HTTP 动词 + JSON 响应，便于前端对接和第三方集成
- **渐进式迁移**：Gateway 原有 RPC 方法暂不删除，双写期后再移除
- **统一认证**：复用现有 JWT 体系，Bearer Token 在 HTTP Header 中传递

---

## 2. 技术架构

### 2.1 技术选型

| 层级 | 技术                | 说明                                                          |
| ---- | ------------------- | ------------------------------------------------------------- |
| 框架 | Fastify 5.x         | 高性能 HTTP 框架，TypeScript 友好                             |
| ORM  | Drizzle ORM         | 复用现有 `src/db/` schema 和连接                              |
| 鉴权 | JWT (Bearer Token)  | 复用现有 `src/assistant/admin-auth/` 和 `src/gateway/auth.ts` |
| 校验 | Zod + TypeBox       | 请求参数校验（与现有项目一致）                                |
| 文档 | @fastify/swagger    | 自动生成 OpenAPI 3.0 文档                                     |
| CORS | @fastify/cors       | 跨域支持                                                      |
| 限流 | @fastify/rate-limit | API 限流保护                                                  |
| 日志 | Pino (Fastify 内置) | 结构化日志                                                    |

### 2.2 项目结构

```
apps/api-server/
├── src/
│   ├── server.ts                    # Fastify 实例创建与插件注册
│   ├── app.ts                       # 应用入口，启动 HTTP 服务
│   ├── config.ts                    # 环境变量和配置
│   ├── plugins/
│   │   ├── auth.ts                  # JWT 认证插件（装饰 request.user）
│   │   ├── admin-auth.ts            # 管理员认证插件（装饰 request.admin）
│   │   ├── error-handler.ts         # 全局错误处理
│   │   └── swagger.ts               # Swagger 文档配置
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── index.ts             # POST /api/auth/register, login, refresh
│   │   │   └── schemas.ts           # 请求/响应 schema
│   │   ├── users/
│   │   │   ├── index.ts             # 用户自服务 API
│   │   │   └── schemas.ts
│   │   ├── conversations/
│   │   │   ├── index.ts             # 对话 CRUD API
│   │   │   └── schemas.ts
│   │   ├── memories/
│   │   │   ├── index.ts             # 记忆管理 API
│   │   │   └── schemas.ts
│   │   ├── files/
│   │   │   ├── index.ts             # 文件上传/下载 API
│   │   │   └── schemas.ts
│   │   ├── skills/
│   │   │   ├── index.ts             # 用户技能 + 技能商店 API
│   │   │   └── schemas.ts
│   │   ├── assistant-config/
│   │   │   ├── index.ts             # AI 助手配置 API
│   │   │   └── schemas.ts
│   │   ├── admin/
│   │   │   ├── users.ts             # 管理员用户管理
│   │   │   ├── subscriptions.ts     # 管理员订阅管理
│   │   │   ├── plans.ts             # 管理员套餐管理
│   │   │   ├── skills.ts            # 管理员技能管理
│   │   │   ├── audit.ts             # 审计日志查询
│   │   │   ├── config.ts            # 系统配置
│   │   │   ├── dashboard.ts         # 仪表盘统计
│   │   │   ├── monitor.ts           # 系统监控
│   │   │   ├── analytics.ts         # 数据分析
│   │   │   └── admins.ts            # 管理员管理
│   │   └── health.ts                # 健康检查
│   └── middleware/
│       ├── audit-log.ts             # 操作审计中间件
│       └── rate-limit.ts            # 限流配置
├── package.json
├── tsconfig.json
└── .env.example
```

### 2.3 运行时架构

```
                    ┌─────────────────────────────────────┐
                    │        App Server (:3000)            │
                    │                                     │
 HTTP Request ─────►│  Fastify                            │
                    │  ├── Auth Plugin (JWT 校验)         │
                    │  ├── Route Handler                  │
                    │  ├── Service Layer (复用 src/assistant/) │
                    │  └── Repository (复用 src/db/)      │
                    │         │                           │
                    └─────────┼───────────────────────────┘
                              │
                    ┌─────────▼───────────────────────────┐
                    │  PostgreSQL │ Redis │ MinIO          │
                    └─────────────────────────────────────┘
```

---

## 3. 认证与授权设计

### 3.1 双认证体系

| 身份类型 | Header 格式                        | 解码方式                         |
| -------- | ---------------------------------- | -------------------------------- |
| 普通用户 | `Authorization: Bearer <userJwt>`  | JWT decode → `{ userId, role }`  |
| 管理员   | `Authorization: Bearer <adminJwt>` | JWT decode → `{ adminId, role }` |

### 3.2 Fastify Auth Plugin 设计

```typescript
// apps/api-server/src/plugins/auth.ts

/**
 * 用户认证插件
 *
 * 从 Authorization header 提取 Bearer Token，校验 JWT，
 * 将用户信息注入 request.user
 */
async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", async (request, reply) => {
    // 跳过公开路由
    if (isPublicRoute(request.url)) return;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401).send({ success: false, error: "Missing token" });
      return;
    }

    const payload = verifyAccessToken(token);
    request.user = {
      userId: payload.userId,
      role: payload.role,
    };
  });
}
```

### 3.3 公开路由（无需认证）

| 路由                       | 说明       |
| -------------------------- | ---------- |
| `POST /api/auth/register`  | 用户注册   |
| `POST /api/auth/login`     | 用户登录   |
| `POST /api/auth/refresh`   | Token 刷新 |
| `POST /api/auth/send-code` | 发送验证码 |
| `GET  /api/health`         | 健康检查   |

### 3.4 管理员路由权限

| 角色        | 可访问路由前缀       | 说明            |
| ----------- | -------------------- | --------------- |
| operator    | `/api/admin/*` (GET) | 只读查询        |
| admin       | `/api/admin/*` (ALL) | 增删改查        |
| super_admin | `/api/admin/*` (ALL) | 全部 + 危险操作 |

---

## 4. API 路由设计

### 4.1 统一响应格式

```typescript
/**
 * 成功响应
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
}

/**
 * 错误响应
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}
```

### 4.2 用户认证 API

| 方法 | 路径                  | 说明       | 来源 RPC 方法                   |
| ---- | --------------------- | ---------- | ------------------------------- |
| POST | `/api/auth/register`  | 用户注册   | `assistant.auth.register`       |
| POST | `/api/auth/login`     | 用户登录   | `assistant.auth.login`          |
| POST | `/api/auth/refresh`   | 刷新 Token | `assistant.auth.refreshToken`   |
| POST | `/api/auth/send-code` | 发送验证码 | `assistant.auth.sendCode`       |
| POST | `/api/auth/logout`    | 用户登出   | `assistant.auth.logout`         |
| POST | `/api/auth/password`  | 修改密码   | `assistant.auth.changePassword` |

### 4.3 用户自服务 API（需用户认证）

| 方法   | 路径                         | 说明             | 来源 RPC 方法                 |
| ------ | ---------------------------- | ---------------- | ----------------------------- |
| GET    | `/api/users/me`              | 获取当前用户信息 | `assistant.auth.me`           |
| PUT    | `/api/users/me`              | 更新用户资料     | 新增                          |
| GET    | `/api/users/me/devices`      | 用户设备列表     | `assistant.device.list`       |
| DELETE | `/api/users/me/devices/:id`  | 解绑设备         | `assistant.device.unbind`     |
| GET    | `/api/users/me/subscription` | 当前订阅信息     | `assistant.subscription.info` |
| GET    | `/api/users/me/skills`       | 已安装技能       | `assistant.skills.installed`  |

### 4.4 对话管理 API（需用户认证）

> 对应 10b-核心数据表设计.md §2.1 conversations + messages

| 方法   | 路径                              | 说明                   |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/conversations`              | 对话列表（分页）       |
| POST   | `/api/conversations`              | 创建对话               |
| GET    | `/api/conversations/:id`          | 对话详情               |
| PUT    | `/api/conversations/:id`          | 更新对话（标题、状态） |
| DELETE | `/api/conversations/:id`          | 删除对话               |
| GET    | `/api/conversations/:id/messages` | 消息列表（分页）       |

**设计说明**：

- 实际的 AI 对话消息收发仍在 Gateway（WebSocket `chat.send`）
- App Server 提供的是对话历史的 CRUD 管理
- 前端展示对话列表、搜索历史对话等场景使用 App Server API

### 4.5 记忆管理 API（需用户认证）

> 对应 10b-核心数据表设计.md §2.2 user_memories

| 方法   | 路径                   | 说明                   |
| ------ | ---------------------- | ---------------------- |
| GET    | `/api/memories`        | 记忆列表（分页、过滤） |
| GET    | `/api/memories/:id`    | 记忆详情               |
| PUT    | `/api/memories/:id`    | 编辑记忆               |
| DELETE | `/api/memories/:id`    | 删除记忆               |
| POST   | `/api/memories/search` | 语义搜索记忆           |

### 4.6 文件管理 API（需用户认证）

> 对应 10b-核心数据表设计.md §2.3 user_files

| 方法   | 路径                      | 说明                            |
| ------ | ------------------------- | ------------------------------- |
| POST   | `/api/files/upload`       | 上传文件（multipart/form-data） |
| GET    | `/api/files`              | 文件列表（分页）                |
| GET    | `/api/files/:id`          | 文件元数据                      |
| GET    | `/api/files/:id/download` | 下载文件（presigned URL）       |
| DELETE | `/api/files/:id`          | 删除文件                        |

### 4.7 用户自建技能 API（需用户认证）

> 对应 10b-核心数据表设计.md §2.4 user_custom_skills

| 方法   | 路径                             | 说明           |
| ------ | -------------------------------- | -------------- |
| GET    | `/api/custom-skills`             | 自建技能列表   |
| POST   | `/api/custom-skills`             | 创建技能       |
| GET    | `/api/custom-skills/:id`         | 技能详情       |
| PUT    | `/api/custom-skills/:id`         | 更新技能       |
| DELETE | `/api/custom-skills/:id`         | 删除技能       |
| POST   | `/api/custom-skills/:id/test`    | 触发测试       |
| POST   | `/api/custom-skills/:id/publish` | 提交到技能商店 |

### 4.8 AI 助手配置 API（需用户认证）

> 对应 10b-核心数据表设计.md §2.5 user_assistant_configs

| 方法   | 路径                                  | 说明     |
| ------ | ------------------------------------- | -------- |
| GET    | `/api/assistant-configs`              | 配置列表 |
| POST   | `/api/assistant-configs`              | 创建配置 |
| GET    | `/api/assistant-configs/:id`          | 配置详情 |
| PUT    | `/api/assistant-configs/:id`          | 更新配置 |
| DELETE | `/api/assistant-configs/:id`          | 删除配置 |
| POST   | `/api/assistant-configs/:id/activate` | 设为默认 |

### 4.9 技能商店 API（公开 + 用户认证混合）

| 方法   | 路径                            | 认证 | 说明         |
| ------ | ------------------------------- | ---- | ------------ |
| GET    | `/api/store/skills`             | 可选 | 商店技能浏览 |
| GET    | `/api/store/skills/:id`         | 可选 | 技能详情     |
| GET    | `/api/store/categories`         | 无   | 技能分类列表 |
| GET    | `/api/store/featured`           | 无   | 推荐技能     |
| POST   | `/api/store/skills/:id/install` | 必须 | 安装技能     |
| DELETE | `/api/store/skills/:id/install` | 必须 | 卸载技能     |
| POST   | `/api/store/skills/:id/review`  | 必须 | 提交评价     |

### 4.10 管理员 API（需管理员认证）

#### 管理员认证

| 方法 | 路径                       | 说明       | 来源 RPC 方法          |
| ---- | -------------------------- | ---------- | ---------------------- |
| POST | `/api/admin/auth/login`    | 管理员登录 | `admin.login`          |
| POST | `/api/admin/auth/refresh`  | 刷新 Token | `admin.refreshToken`   |
| POST | `/api/admin/auth/logout`   | 管理员登出 | `admin.logout`         |
| POST | `/api/admin/auth/password` | 修改密码   | `admin.changePassword` |

#### 用户管理

| 方法 | 路径                                  | 说明     | 来源 RPC 方法               |
| ---- | ------------------------------------- | -------- | --------------------------- |
| GET  | `/api/admin/users`                    | 用户列表 | `admin.users.list`          |
| GET  | `/api/admin/users/:id`                | 用户详情 | `admin.users.get`           |
| POST | `/api/admin/users/:id/suspend`        | 停用用户 | `admin.users.suspend`       |
| POST | `/api/admin/users/:id/activate`       | 激活用户 | `admin.users.activate`      |
| POST | `/api/admin/users/:id/reset-password` | 重置密码 | `admin.users.resetPassword` |
| POST | `/api/admin/users/:id/force-logout`   | 强制登出 | `admin.users.forceLogout`   |
| GET  | `/api/admin/users/stats`              | 用户统计 | `admin.users.stats`         |

#### 订阅与套餐管理

| 方法 | 路径                                       | 说明     | 来源 RPC 方法                    |
| ---- | ------------------------------------------ | -------- | -------------------------------- |
| GET  | `/api/admin/subscriptions`                 | 订阅列表 | `admin.subscriptions.list`       |
| GET  | `/api/admin/subscriptions/:id`             | 订阅详情 | `admin.subscriptions.get`        |
| POST | `/api/admin/subscriptions/:id/cancel`      | 取消订阅 | `admin.subscriptions.cancel`     |
| POST | `/api/admin/subscriptions/:id/extend`      | 延长订阅 | `admin.subscriptions.extend`     |
| POST | `/api/admin/subscriptions/:id/change-plan` | 变更套餐 | `admin.subscriptions.changePlan` |
| GET  | `/api/admin/subscriptions/stats`           | 订阅统计 | `admin.subscriptions.stats`      |
| GET  | `/api/admin/plans`                         | 套餐列表 | `admin.plans.list`               |
| POST | `/api/admin/plans`                         | 创建套餐 | `admin.plans.create`             |
| PUT  | `/api/admin/plans/:id`                     | 更新套餐 | `admin.plans.update`             |

#### 技能管理

| 方法   | 路径                               | 说明      | 来源 RPC 方法                    |
| ------ | ---------------------------------- | --------- | -------------------------------- |
| GET    | `/api/admin/skills`                | 技能列表  | `admin.skills.list`              |
| GET    | `/api/admin/skills/:id`            | 技能详情  | `admin.skills.get`               |
| POST   | `/api/admin/skills`                | 创建技能  | `admin.skills.create`            |
| POST   | `/api/admin/skills/:id/review`     | 审核技能  | `admin.skills.review`            |
| POST   | `/api/admin/skills/:id/publish`    | 发布/下架 | `admin.skills.publish`           |
| POST   | `/api/admin/skills/:id/featured`   | 设为推荐  | `admin.skills.setFeatured`       |
| GET    | `/api/admin/skills/categories`     | 分类列表  | `admin.skills.categories.list`   |
| POST   | `/api/admin/skills/categories`     | 创建分类  | `admin.skills.categories.create` |
| PUT    | `/api/admin/skills/categories/:id` | 更新分类  | `admin.skills.categories.update` |
| DELETE | `/api/admin/skills/categories/:id` | 删除分类  | `admin.skills.categories.delete` |
| GET    | `/api/admin/skills/stats`          | 技能统计  | `admin.skills.stats`             |

#### 系统管理

| 方法 | 路径                           | 说明         | 来源 RPC 方法             |
| ---- | ------------------------------ | ------------ | ------------------------- |
| GET  | `/api/admin/dashboard`         | 仪表盘统计   | `admin.dashboard.*`       |
| GET  | `/api/admin/audit-logs`        | 审计日志     | `admin.audit.list`        |
| GET  | `/api/admin/monitor/stats`     | 监控统计     | `admin.monitor.stats`     |
| GET  | `/api/admin/monitor/health`    | 服务健康     | `admin.monitor.health`    |
| GET  | `/api/admin/monitor/api`       | API 监控     | `admin.monitor.api`       |
| GET  | `/api/admin/monitor/resources` | 资源监控     | `admin.monitor.resources` |
| GET  | `/api/admin/config`            | 系统配置列表 | `admin.config.list`       |
| PUT  | `/api/admin/config/:key`       | 更新配置     | `admin.config.update`     |
| GET  | `/api/admin/analytics`         | 数据分析     | `admin.analytics.*`       |

---

## 5. Gateway → App Server 迁移策略

### 5.1 双写期

迁移期间 Gateway 和 App Server 同时提供接口，前端逐步切换：

```
阶段 1: App Server 启动，提供新 REST API
         ├── Gateway RPC 方法保留（前端仍调用 Gateway）
         └── App Server 复用相同的 Service 和 Repository

阶段 2: 前端逐模块切换到 App Server REST API
         ├── admin-console 首先迁移（管理后台，影响面小）
         ├── web-admin 其次迁移
         └── Windows 客户端最后迁移（仅 CRUD 部分）

阶段 3: Gateway RPC 方法标记为 deprecated
         └── 确认所有前端已迁移后移除
```

### 5.2 迁移优先级

| 优先级 | 模块              | 理由                                  |
| ------ | ----------------- | ------------------------------------- |
| P0     | 管理员认证 + 管理 | admin-console 完全是 CRUD，最适合迁移 |
| P1     | 用户认证          | 注册/登录/Token 刷新是基础            |
| P1     | 用户自服务        | 设备管理、订阅查询等                  |
| P2     | 对话/记忆管理     | 新功能，直接在 App Server 实现        |
| P2     | 文件管理          | 依赖 MinIO（Phase 5）                 |
| P3     | 技能商店          | 复杂度较高，最后迁移                  |

### 5.3 Gateway 保留方法

以下方法因实时性要求，**永久保留**在 Gateway：

| 方法前缀         | 保留原因                            |
| ---------------- | ----------------------------------- |
| `chat.send`      | 流式 AI 对话，依赖 WebSocket 长连接 |
| `chat.abort`     | 中止正在运行的 Agent                |
| `agent.*`        | Agent 运行时调度                    |
| `sessions.*`     | Agent 会话管理（与运行时紧耦合）    |
| `nodes.*`        | 设备节点实时管理、心跳、状态感知    |
| `skills.execute` | 技能实时下发执行到设备              |
| `send.*`         | 消息推送到各渠道                    |
| `browser.*`      | 浏览器自动化控制                    |
| `connect`        | WebSocket 握手                      |

---

## 6. Gateway ↔ App Server 通信

### 6.1 通信场景

| 场景                 | 方向                 | 方式           |
| -------------------- | -------------------- | -------------- |
| 用户配置变更通知设备 | App Server → Gateway | Redis Pub/Sub  |
| 技能上传后同步到设备 | App Server → Gateway | Redis Pub/Sub  |
| AI 对话产生记忆/文件 | Gateway → PostgreSQL | 直接写入数据库 |
| 配额检查             | Gateway → Redis      | 读取缓存值     |
| 用户信息查询         | 双方 → PostgreSQL    | 共享数据库     |

### 6.2 Redis Pub/Sub 事件设计

```typescript
/**
 * App Server → Gateway 的事件通道
 */
const CHANNELS = {
  /** 用户助手配置变更，Gateway 需要更新运行时 */
  CONFIG_CHANGED: "openclaw:config:changed",

  /** 技能上传/更新，Gateway 需要通知已连接设备 */
  SKILL_SYNCED: "openclaw:skill:synced",

  /** 用户被停用，Gateway 需要断开其连接 */
  USER_SUSPENDED: "openclaw:user:suspended",

  /** 配额耗尽，Gateway 需要限制用户操作 */
  QUOTA_EXHAUSTED: "openclaw:quota:exhausted",
};

/**
 * 事件消息结构
 */
interface PubSubMessage {
  /** 事件类型 */
  type: string;
  /** 目标用户 ID */
  userId: string;
  /** 事件负载 */
  payload: Record<string, unknown>;
  /** 发送时间 */
  timestamp: string;
}
```

---

## 7. 部署配置

### 7.1 环境变量

```bash
# App Server 配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# 数据库（与 Gateway 共享）
DATABASE_URL=postgresql://localhost:5432/openclaw

# Redis（Phase 5 引入）
REDIS_URL=redis://localhost:6379

# MinIO（Phase 5 引入）
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=openclaw
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=openclaw-media

# JWT 密钥（与 Gateway 共享）
JWT_SECRET=<shared-secret>
JWT_ADMIN_SECRET=<shared-admin-secret>

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# 日志
LOG_LEVEL=info
```

### 7.2 Nginx 反向代理

```nginx
# /etc/nginx/conf.d/openclaw.conf

upstream app_server {
    server 127.0.0.1:3000;
}

upstream gateway {
    server 127.0.0.1:18789;
}

server {
    listen 443 ssl;
    server_name api.openclaw.example.com;

    # App Server REST API
    location /api/ {
        proxy_pass http://app_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gateway WebSocket
    location /ws {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Swagger 文档
    location /docs {
        proxy_pass http://app_server;
    }
}
```

---

## 8. 实施步骤

### Step 1: 项目脚手架

- 创建 `apps/api-server/` 目录
- 初始化 `package.json`，引用 workspace 共享依赖
- 配置 `tsconfig.json`，paths 映射到 `src/db/`、`src/assistant/`
- 实现 Fastify 服务启动 + 健康检查端点

### Step 2: 认证插件

- 实现 `plugins/auth.ts`（用户 JWT 认证）
- 实现 `plugins/admin-auth.ts`（管理员 JWT 认证）
- 实现 `plugins/error-handler.ts`（统一错误处理）
- 单元测试验证 Token 校验逻辑

### Step 3: 管理员 API 迁移

- 按模块从 Gateway RPC 迁移为 REST API
- 迁移顺序：auth → users → subscriptions → skills → audit → config → monitor
- 每迁移一个模块就编写集成测试
- 保持 Gateway 原有 RPC 不变（双写期）

### Step 4: 用户 API 实现

- 实现用户自服务 API（profile、devices、subscription 查询）
- 实现新功能 API（conversations、memories、files、custom-skills、assistant-configs）
- 新功能直接在 App Server 实现，不需要 Gateway 双写

### Step 5: Swagger 文档

- 配置 `@fastify/swagger` 自动生成 OpenAPI 文档
- 部署 Swagger UI 到 `/docs` 路径

---

## 9. 验收标准

| #   | 标准                               | 验证方式 |
| --- | ---------------------------------- | -------- |
| 1   | App Server 启动并通过健康检查      | 端点测试 |
| 2   | 管理员 API 功能与 Gateway RPC 一致 | 集成测试 |
| 3   | JWT 认证正确区分用户和管理员       | 单元测试 |
| 4   | 用户 API 自动附带 userId 过滤      | 集成测试 |
| 5   | 统一错误响应格式                   | 集成测试 |
| 6   | Swagger 文档可访问且准确           | 手动验证 |
| 7   | Gateway 原有功能不受影响           | 回归测试 |

---

_— 文档结束 —_
