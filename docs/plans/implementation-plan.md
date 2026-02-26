# MtBot 三大问题实施计划

## 实施进度

| 问题                 | 阶段                             | 状态    | 完成日期   |
| -------------------- | -------------------------------- | ------- | ---------- |
| 问题一：多租户网关   | Phase 1: WebSocket 用户认证      | ✅ 完成 | 2026-02-08 |
| 问题一：多租户网关   | Phase 2: 请求管道用户上下文      | ✅ 完成 | 2026-02-08 |
| 问题一：多租户网关   | Phase 3: 配额检查中间件          | ✅ 完成 | 2026-02-08 |
| 问题一：多租户网关   | Phase 4: 模型访问过滤            | ✅ 完成 | 2026-02-08 |
| 问题二：客户端 Skill | Phase 1: 技能执行协议            | ✅ 完成 | 2026-02-08 |
| 问题二：客户端 Skill | Phase 2: 客户端 Skill Runtime    | ✅ 完成 | 2026-02-08 |
| 问题二：客户端 Skill | Phase 3: Gateway-Client 技能通道 | ✅ 完成 | 2026-02-08 |
| 问题二：客户端 Skill | Phase 4: 沙箱隔离                | ✅ 完成 | 2026-02-08 |
| 问题三：快速验证     | Phase 1: 最小化测试环境          | ✅ 完成 | 2026-02-08 |
| 问题三：快速验证     | Phase 2: Docker Compose Profile  | ✅ 完成 | 2026-02-08 |
| 问题三：快速验证     | Phase 3: Seed 数据脚本           | ✅ 完成 | 2026-02-08 |
| 问题三：快速验证     | Phase 4: 快速验证脚本            | ✅ 完成 | 2026-02-08 |
| 问题三：快速验证     | Phase 5: Mock Provider           | ✅ 完成 | 2026-02-08 |

---

## 概述

本计划针对以下三个核心问题制定详细实施方案：

1. **公共网关多租户改造** - 使网关支持多用户独立使用
2. **客户端 Skill 执行集成** - 使 Windows 客户端能执行本地技能
3. **快速验证测试方案** - 降低测试门槛，加速开发验证

---

## 问题一：公共网关多租户改造

### 1.1 现状分析

**已实现：**

- 用户认证系统 (`src/assistant/auth/`) - JWT Token 生成/验证
- 用户数据库 (`src/db/schema/users.ts`) - 完整的用户表结构
- 订阅系统 (`src/db/schema/subscriptions.ts`) - 套餐/订阅/配额
- 管理员系统 (`src/assistant/admin-auth/`) - RBAC 权限控制

**缺失：**

- 网关 WebSocket 连接层未与用户认证打通
- RPC 请求处理管道缺少用户上下文
- 配额检查中间件未实现
- 模型访问按用户套餐过滤未实现

### 1.2 实施方案

#### Phase 1: WebSocket 连接层用户认证 (预计 16h)

**目标：** 在 WebSocket 握手时验证用户 JWT Token

**修改文件：**

- `src/gateway/server/ws-connection/message-handler.ts`
- `src/gateway/protocol/connect.ts`

**新增文件：**

- `src/gateway/user-context.ts`

#### Phase 2: 请求管道用户上下文传递 (预计 8h)

**修改文件：**

- `src/gateway/server-methods/types.ts`
- `src/gateway/server-methods.ts`

#### Phase 3: 配额检查中间件 (预计 12h)

**新增文件：**

- `src/gateway/middleware/quota-check.ts`

#### Phase 4: 模型访问过滤 (预计 8h)

**修改文件：**

- `src/gateway/server-methods/models.ts`
- `src/db/schema/subscriptions.ts`

---

## 问题二：客户端 Skill 执行集成

### 2.1 现状分析

**已实现：**

- Agent 框架 Skill 系统 (`src/agents/skills/`) - 服务端技能加载
- Assistant Skill 框架 (`src/assistant/skills/`) - 新的技能执行器（部分实现）
- 命令执行通道 (`apps/windows/src/main/`) - Gateway→Client 命令下发
- SystemService - 本地文件/进程/系统操作

**缺失：**

- 客户端无 Skill Registry
- 客户端无 Skill Executor
- 无双向技能执行协议
- 无沙箱隔离机制

### 2.2 实施方案

#### Phase 1: 技能执行协议定义 (预计 4h)

**新增文件：**

- `src/gateway/protocol/skill-execution.ts`

#### Phase 2: 客户端 Skill Runtime (预计 16h)

**新增文件：**

- `apps/windows/src/main/skill-runtime.ts`
- `apps/windows/src/main/skill-loader.ts`

#### Phase 3: Gateway-Client 技能通道 (预计 8h)

**修改文件：**

- `apps/windows/src/main/gateway-client.ts`
- `apps/windows/src/main/index.ts`
- `src/gateway/server-methods/assistant-skills.ts`

#### Phase 4: 沙箱隔离（可选）(预计 16h)

**新增依赖：** `isolated-vm`

**新增文件：**

- `apps/windows/src/main/skill-sandbox.ts`

---

## 问题三：快速验证测试方案

### 3.1 现状分析

**已实现：**

- Vitest 测试框架 + 多配置文件
- Docker Compose 基础设施
- 测试隔离机制 (test/setup.ts)
- 端口分配工具 (src/test-utils/ports.ts)

**痛点：**

- 需要启动多个 Docker 服务
- 数据库测试依赖 PostgreSQL
- 无 Seed 数据脚本
- 无最小化验证路径

### 3.2 实施方案

#### Phase 1: 最小化测试环境 (预计 8h)

**新增文件：**

- `src/db/mock-connection.ts`

#### Phase 2: Docker Compose Profile 优化 (预计 4h)

**修改文件：**

- `docker-compose.infra.yml`

#### Phase 3: Seed 数据脚本 (预计 8h)

**新增文件：**

- `scripts/seed-dev.ts`

#### Phase 4: 快速验证脚本 (预计 4h)

**新增文件：**

- `scripts/quick-verify.sh`
- `scripts/quick-verify.ps1`

#### Phase 5: Mock Provider 集成 (预计 8h)

**新增文件：**

- `src/providers/mock-provider.ts`

---

## 实施优先级

| 优先级 | 问题                 | 预计工时 | 依赖   |
| ------ | -------------------- | -------- | ------ |
| P0     | 问题三：快速验证     | 32h      | 无     |
| P1     | 问题一：多租户网关   | 44h      | 问题三 |
| P2     | 问题二：客户端 Skill | 44h      | 问题一 |

## 推荐实施顺序

```
Week 1: 问题三 Phase 1-3 (快速验证基础)
Week 2: 问题三 Phase 4-5 + 问题一 Phase 1
Week 3: 问题一 Phase 2-3
Week 4: 问题一 Phase 4 + 问题二 Phase 1-2
Week 5: 问题二 Phase 3-4
```

---

## 实施进度

### 已完成 ✅

#### 问题三：快速验证测试方案

- [x] Phase 1: 内存数据库 Mock (`src/db/mock-connection.ts`)
- [x] Phase 2: Docker Compose Profile 优化 (`docker-compose.infra.yml`)
- [x] Phase 3: Seed 数据脚本 (`scripts/seed-dev.ts`)
- [x] Phase 4: 快速验证脚本 (`scripts/quick-verify.sh`, `scripts/quick-verify.ps1`)
- [x] Phase 5: Mock LLM Provider (`src/providers/mock-provider.ts`)

#### 问题一：公共网关多租户改造

- [x] Phase 1-2: 用户上下文类型定义 (`src/gateway/user-context.ts`)
- [x] Phase 3: 配额检查中间件 (`src/gateway/middleware/quota-check.ts`)
- [x] Phase 4: 模型访问过滤 (`src/gateway/server-methods/models.ts`)
- [x] GatewayClient 类型扩展 (`src/gateway/server-methods/types.ts`)

#### 问题二：客户端 Skill 执行集成

- [x] Phase 1: 技能执行协议定义 (`src/gateway/protocol/skill-execution.ts`)
- [x] Phase 2: 客户端 Skill Runtime (`apps/windows/src/main/skill-runtime.ts`)

### 待集成 🔄

以下模块已创建，需要集成到现有代码中：

#### 问题一：网关认证集成

- [ ] 将 `user-context.ts` 集成到 `message-handler.ts` 的握手流程
- [ ] 将 `quota-check.ts` 集成到 `server-methods.ts` 的请求处理管道

#### 问题二：客户端集成

- [ ] 在 `gateway-client.ts` 中添加技能执行事件监听
- [ ] 在 `index.ts` 中初始化 SkillRuntime
- [ ] Phase 4: 沙箱隔离（可选）

---

## 新增文件清单

| 文件路径                                  | 说明                          |
| ----------------------------------------- | ----------------------------- |
| `src/db/mock-connection.ts`               | 内存数据库 Mock，用于单元测试 |
| `scripts/seed-dev.ts`                     | 开发环境 Seed 数据脚本        |
| `scripts/quick-verify.sh`                 | Linux/macOS 快速验证脚本      |
| `scripts/quick-verify.ps1`                | Windows 快速验证脚本          |
| `src/providers/mock-provider.ts`          | Mock LLM Provider             |
| `src/gateway/user-context.ts`             | 网关用户上下文类型定义        |
| `src/gateway/middleware/quota-check.ts`   | 配额检查中间件                |
| `src/gateway/protocol/skill-execution.ts` | 技能执行协议定义              |
| `apps/windows/src/main/skill-runtime.ts`  | 客户端技能运行时              |

## 修改文件清单

| 文件路径                               | 修改说明                                        |
| -------------------------------------- | ----------------------------------------------- |
| `docker-compose.infra.yml`             | 添加 minimal profile 支持                       |
| `package.json`                         | 添加 db:seed 脚本                               |
| `src/gateway/server-methods/types.ts`  | 扩展 GatewayClient 类型，添加用户认证和能力声明 |
| `src/gateway/server-methods/models.ts` | 添加按用户套餐过滤模型的逻辑                    |
