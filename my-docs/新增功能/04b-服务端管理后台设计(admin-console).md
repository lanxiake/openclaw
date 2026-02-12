# OpenClaw AI 个人助理平台 - 服务端管理后台设计 (admin-console)

> 版本: 1.0 | 创建日期: 2026-02-12 | 状态: 从 04 整合版拆分
>
> 本文档描述面向平台运营团队的管理后台设计

---

## 修订记录

| 版本 | 日期       | 修订内容                                                       |
| ---- | ---------- | -------------------------------------------------------------- |
| 1.0  | 2026-02-12 | 从 04-管理后台系统设计.md 拆分，补充 P1/P2 API、管理员管理功能 |

---

## 1. 概述

### 1.1 系统定位

| 项目     | 说明                               |
| -------- | ---------------------------------- |
| 目标用户 | 平台运营团队（管理员）             |
| 功能范围 | 管理所有用户、订阅、技能商店、系统 |
| 数据权限 | 可访问全平台数据                   |
| 认证方式 | 管理员账号登录（独立于用户系统）   |
| 部署路径 | `apps/admin-console`               |
| 开发端口 | `localhost:5174`                   |
| API 前缀 | `/api/admin/v1/`                   |

### 1.2 技术栈

| 技术            | 版本   | 说明      |
| --------------- | ------ | --------- |
| React           | 18+    | UI 框架   |
| TypeScript      | 5.x    | 类型安全  |
| Vite            | 5.x    | 构建工具  |
| React Router    | 6.x    | 路由      |
| TanStack Query  | 5.x    | 数据获取  |
| Zustand         | 4.x    | 状态管理  |
| shadcn/ui       | latest | UI 组件库 |
| Tailwind CSS    | 3.x    | 样式      |
| Recharts        | 2.x    | 图表      |
| React Hook Form | 7.x    | 表单      |
| Zod             | 3.x    | 验证      |

---

## 2. 角色权限

| 角色       | 权限范围                       | 典型操作                           |
| ---------- | ------------------------------ | ---------------------------------- |
| 超级管理员 | 全部权限                       | 系统配置、权限管理、所有运营操作   |
| 运营主管   | 用户管理 + 订阅管理 + 技能管理 | 处理用户投诉、调整订阅、上下架技能 |
| 运营专员   | 只读权限 + 有限写权限          | 查看数据、处理简单工单             |
| 技术支持   | 日志查看 + 设备管理            | 排查问题、查看日志                 |

### 权限矩阵

| 功能模块     | super_admin | admin   | operator | tech_support |
| ------------ | ----------- | ------- | -------- | ------------ |
| 仪表盘       | ✅ 读写     | ✅ 读写 | ✅ 只读  | ✅ 只读      |
| 用户管理     | ✅ 读写     | ✅ 读写 | ✅ 只读  | ❌           |
| 订阅管理     | ✅ 读写     | ✅ 读写 | ✅ 只读  | ❌           |
| 技能商店管理 | ✅ 读写     | ✅ 读写 | ✅ 只读  | ❌           |
| 系统监控     | ✅ 读写     | ✅ 只读 | ❌       | ✅ 只读      |
| 系统配置     | ✅ 读写     | ❌      | ❌       | ❌           |
| 管理员管理   | ✅ 读写     | ❌      | ❌       | ❌           |
| 操作日志     | ✅ 读写     | ✅ 只读 | ✅ 只读  | ✅ 只读      |
| 数据分析     | ✅ 读写     | ✅ 只读 | ✅ 只读  | ❌           |

---

## 3. 功能模块与优先级

### 第一期 (P0)

| 模块       | 功能                                  |
| ---------- | ------------------------------------- |
| 管理员认证 | 账号密码登录、MFA、会话管理、登录日志 |
| 仪表盘     | 关键指标、趋势图表、实时动态          |
| 用户管理   | 用户列表、详情、禁用/启用、调整订阅   |
| 订阅管理   | 计划管理、订阅列表、订单管理          |
| 操作日志   | 日志列表、筛选、导出                  |

### 第二期 (P1)

| 模块         | 功能                                   |
| ------------ | -------------------------------------- |
| 技能商店管理 | 技能审核、上下架、分类、推荐           |
| 系统监控     | 服务状态、API 监控、资源使用、实时日志 |
| 管理员管理   | 创建/编辑/禁用管理员、角色分配         |

### 第三期 (P2)

| 模块     | 功能                                     |
| -------- | ---------------------------------------- |
| 系统配置 | 基础配置、功能开关、安全配置、通知模板   |
| 数据分析 | 用户分析、收入分析、技能分析、自定义报表 |

---

## 4. 页面结构

```
apps/admin-console/
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── users/
│   │   │   ├── UserListPage.tsx
│   │   │   └── UserDetailPage.tsx
│   │   ├── subscriptions/
│   │   │   ├── PlanListPage.tsx
│   │   │   ├── SubscriptionListPage.tsx
│   │   │   └── OrderListPage.tsx
│   │   ├── skills/
│   │   │   ├── SkillsPage.tsx
│   │   │   ├── CategoriesPage.tsx
│   │   │   └── FeaturedPage.tsx
│   │   ├── admins/
│   │   │   ├── AdminListPage.tsx
│   │   │   └── AdminDetailPage.tsx
│   │   ├── monitor/
│   │   │   ├── MonitorPage.tsx
│   │   │   ├── LogsPage.tsx
│   │   │   └── AlertsPage.tsx
│   │   ├── config/
│   │   │   ├── SiteConfigPage.tsx
│   │   │   ├── FeaturesConfigPage.tsx
│   │   │   └── SecurityConfigPage.tsx
│   │   ├── analytics/
│   │   │   ├── UsersAnalyticsPage.tsx
│   │   │   ├── RevenueAnalyticsPage.tsx
│   │   │   └── SkillsAnalyticsPage.tsx
│   │   └── logs/
│   │       └── AuditLogPage.tsx
│   ├── components/
│   │   ├── ui/              # shadcn/ui 组件
│   │   ├── layout/          # 布局组件
│   │   └── common/          # 通用组件
│   ├── hooks/
│   ├── services/
│   └── stores/
```

---

## 5. 仪表盘设计

### 关键指标卡片

| 指标           | 说明                | 数据源                                     |
| -------------- | ------------------- | ------------------------------------------ |
| 总用户数       | 平台注册用户总数    | users 表 COUNT                             |
| 今日新增       | 今日注册用户数      | users 表 WHERE created_at >= today         |
| 活跃用户 (7日) | 近 7 天有登录的用户 | users 表 WHERE last_login_at >= 7 days ago |
| 付费用户       | 有有效订阅的用户数  | subscriptions 表 WHERE status = 'active'   |
| 本月收入       | 当月订阅收入        | orders 表 WHERE status = 'paid'            |
| 在线设备       | 当前在线设备数      | devices 表 WHERE status = 'online'         |

### 图表

| 图表         | 类型   | 说明                 |
| ------------ | ------ | -------------------- |
| 用户增长趋势 | 折线图 | 近 30 天每日新增用户 |
| 订阅分布     | 饼图   | 按计划类型分布       |
| 收入趋势     | 柱状图 | 近 12 个月收入       |

---

## 6. API 设计

### 6.1 管理员认证 API (P0)

```
POST /api/admin/v1/auth/login       # 管理员登录
POST /api/admin/v1/auth/mfa/verify  # MFA 验证
POST /api/admin/v1/auth/refresh     # 刷新令牌
POST /api/admin/v1/auth/logout      # 登出
GET  /api/admin/v1/auth/profile     # 获取当前管理员信息
PATCH /api/admin/v1/auth/profile    # 更新当前管理员信息（昵称、邮箱）
POST /api/admin/v1/auth/change-password  # 修改自己的密码
```

### 6.2 仪表盘 API (P0)

```
GET /api/admin/v1/dashboard/stats       # 统计概览
GET /api/admin/v1/dashboard/trends      # 趋势数据（用户增长、收入、订阅）
GET /api/admin/v1/dashboard/activities  # 实时动态（最近操作）
```

### 6.3 用户管理 API (P0)

```
GET    /api/admin/v1/users                       # 用户列表（分页、搜索、筛选）
GET    /api/admin/v1/users/:id                   # 用户详情
PATCH  /api/admin/v1/users/:id/status            # 更新用户状态（启用/禁用）
POST   /api/admin/v1/users/:id/reset-password    # 重置用户密码
POST   /api/admin/v1/users/:id/subscription      # 调整用户订阅
POST   /api/admin/v1/users/:id/force-logout      # 强制用户登出
POST   /api/admin/v1/users/export                # 导出用户列表（CSV）
```

### 6.4 订阅管理 API (P0)

```
GET    /api/admin/v1/subscription-plans          # 订阅计划列表
POST   /api/admin/v1/subscription-plans          # 创建订阅计划
PUT    /api/admin/v1/subscription-plans/:id      # 更新订阅计划
DELETE /api/admin/v1/subscription-plans/:id      # 删除订阅计划（软删除）
GET    /api/admin/v1/subscriptions               # 订阅列表（分页、筛选）
GET    /api/admin/v1/orders                      # 订单列表（分页、筛选）
GET    /api/admin/v1/orders/:id                  # 订单详情
POST   /api/admin/v1/orders/:id/refund           # 处理退款
```

### 6.5 操作日志 API (P0)

```
GET  /api/admin/v1/audit-logs                    # 日志列表（分页、筛选：管理员/操作类型/时间范围）
GET  /api/admin/v1/audit-logs/:id                # 日志详情（含 before/after 数据）
POST /api/admin/v1/audit-logs/export             # 导出日志（CSV）
```

### 6.6 技能商店管理 API (P1)

```
GET    /api/admin/v1/skills                      # 技能列表（分页、状态筛选）
GET    /api/admin/v1/skills/:id                  # 技能详情
PATCH  /api/admin/v1/skills/:id/status           # 技能上下架（published/unpublished/rejected）
POST   /api/admin/v1/skills/:id/review           # 技能审核（通过/拒绝 + 审核意见）
GET    /api/admin/v1/skill-categories            # 分类列表
POST   /api/admin/v1/skill-categories            # 创建分类
PUT    /api/admin/v1/skill-categories/:id        # 更新分类
DELETE /api/admin/v1/skill-categories/:id        # 删除分类
GET    /api/admin/v1/skills/featured             # 推荐技能列表
PUT    /api/admin/v1/skills/featured             # 更新推荐技能（批量设置排序）
```

### 6.7 系统监控 API (P1)

```
GET /api/admin/v1/monitor/services               # 服务状态列表（Gateway/DB/Redis 等）
GET /api/admin/v1/monitor/services/:name/health  # 单个服务健康检查
GET /api/admin/v1/monitor/metrics                # 系统指标（CPU/内存/连接数/请求数）
GET /api/admin/v1/monitor/api-stats              # API 调用统计（按端点、状态码、响应时间）
GET /api/admin/v1/monitor/logs                   # 实时日志流（支持 SSE）
GET /api/admin/v1/monitor/alerts                 # 告警列表
PATCH /api/admin/v1/monitor/alerts/:id           # 处理告警（确认/静默）
```

### 6.8 管理员管理 API (P1)

```
GET    /api/admin/v1/admins                      # 管理员列表
GET    /api/admin/v1/admins/:id                  # 管理员详情
POST   /api/admin/v1/admins                      # 创建管理员
PATCH  /api/admin/v1/admins/:id                  # 更新管理员信息（角色、状态）
POST   /api/admin/v1/admins/:id/reset-password   # 重置管理员密码
PATCH  /api/admin/v1/admins/:id/status           # 启用/禁用管理员
POST   /api/admin/v1/admins/:id/force-logout     # 强制管理员登出
```

### 6.9 系统配置 API (P2)

```
GET    /api/admin/v1/config/site                 # 获取站点配置（名称、Logo、公告）
PATCH  /api/admin/v1/config/site                 # 更新站点配置
GET    /api/admin/v1/config/features             # 获取功能开关列表
PATCH  /api/admin/v1/config/features/:key        # 更新功能开关
GET    /api/admin/v1/config/security             # 获取安全配置（密码策略、IP 白名单等）
PATCH  /api/admin/v1/config/security             # 更新安全配置
GET    /api/admin/v1/config/notifications        # 获取通知模板列表
PUT    /api/admin/v1/config/notifications/:id    # 更新通知模板
```

### 6.10 数据分析 API (P2)

```
GET /api/admin/v1/analytics/users                # 用户分析（注册趋势、留存率、活跃度）
GET /api/admin/v1/analytics/revenue              # 收入分析（MRR、ARR、ARPU、流失率）
GET /api/admin/v1/analytics/skills               # 技能分析（安装排名、使用频率、评分分布）
GET /api/admin/v1/analytics/custom               # 自定义报表（灵活查询参数）
POST /api/admin/v1/analytics/export              # 导出分析报表
```

---

## 7. 数据库设计

### 7.1 管理员表

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  role VARCHAR(20) NOT NULL DEFAULT 'operator',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(100),
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);
```

### 7.2 管理员会话表

```sql
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 管理员操作日志表

```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id),
  admin_name VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.4 每日统计表

```sql
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_subscriptions INTEGER DEFAULT 0,
  revenue INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  online_devices INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.5 技能分类表（P1 新增）

```sql
CREATE TABLE skill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.6 推荐技能表（P1 新增）

```sql
CREATE TABLE featured_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL,
  sort_order INTEGER DEFAULT 0,
  featured_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);
```

### 7.7 系统配置表（P2 新增）

```sql
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id)
);
```

---

## 8. 安全设计

### 8.1 认证安全

| 安全措施     | 说明                                       |
| ------------ | ------------------------------------------ |
| 独立认证系统 | 管理员账号与用户账号完全隔离               |
| 强密码策略   | 最少 12 位，包含大小写字母、数字、特殊字符 |
| MFA 二次验证 | 支持 TOTP，超级管理员强制启用              |
| 会话超时     | 1 小时无操作自动登出                       |
| 登录尝试限制 | 5 次失败后锁定 30 分钟                     |
| IP 白名单    | 可选的 IP 白名单限制                       |

### 8.2 数据脱敏

| 字段   | 脱敏规则       | 示例                      |
| ------ | -------------- | ------------------------- |
| 手机号 | 隐藏中间 4 位  | 138\*\*\*\*8000           |
| 邮箱   | 隐藏 @ 前部分  | u\*\*\*@example.com       |
| 身份证 | 隐藏中间 10 位 | 110\*\*\*\*\*\*\*\*\*1234 |

### 8.3 审计日志

所有敏感操作记录审计日志：

| 操作类型                 | 说明         |
| ------------------------ | ------------ |
| admin.login              | 管理员登录   |
| admin.logout             | 管理员登出   |
| admin.create             | 创建管理员   |
| admin.update             | 更新管理员   |
| admin.disable            | 禁用管理员   |
| user.view                | 查看用户详情 |
| user.suspend             | 禁用用户     |
| user.activate            | 启用用户     |
| user.password_reset      | 重置用户密码 |
| user.subscription_adjust | 调整用户订阅 |
| plan.create              | 创建订阅计划 |
| plan.update              | 更新订阅计划 |
| plan.delete              | 删除订阅计划 |
| order.refund             | 处理退款     |
| skill.review             | 审核技能     |
| skill.publish            | 上架技能     |
| skill.unpublish          | 下架技能     |
| config.update            | 更新系统配置 |
| export.users             | 导出用户数据 |
| export.logs              | 导出操作日志 |

---

## 9. TypeScript 类型定义

### 9.1 管理员类型

```typescript
interface Admin {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role: "super_admin" | "admin" | "operator" | "tech_support";
  status: "active" | "disabled";
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}
```

### 9.2 审计日志类型

```typescript
interface AuditLog {
  id: string;
  admin: {
    id: string;
    displayName: string;
  };
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ipAddress: string;
  createdAt: string;
}
```

### 9.3 统计类型

```typescript
interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  activeUsers7d: number;
  paidUsers: number;
  revenueThisMonth: number;
  onlineDevices: number;
  apiCallsToday: number;
}

interface TrendData {
  labels: string[];
  values: number[];
}
```

---

## 10. 业务闭环分析

### 10.1 闭环状态总览

| 业务流程     | 闭环状态 | 说明                                                           |
| ------------ | -------- | -------------------------------------------------------------- |
| 管理员认证   | ✅ 闭环  | 登录 → MFA → 刷新令牌 → 修改信息 → 修改密码 → 登出             |
| 仪表盘       | ✅ 闭环  | 统计概览 + 趋势图 + 实时动态，数据源明确                       |
| 用户管理     | ✅ 闭环  | 列表 → 详情 → 状态变更 → 重置密码 → 调整订阅 → 强制登出 → 导出 |
| 订阅管理     | ✅ 闭环  | 计划 CRUD → 订阅列表 → 订单列表 → 退款                         |
| 操作日志     | ✅ 闭环  | 列表 → 详情 → 筛选 → 导出                                      |
| 技能商店管理 | ✅ 闭环  | 列表 → 审核 → 上下架 → 分类管理 → 推荐管理                     |
| 系统监控     | ✅ 闭环  | 服务状态 → 健康检查 → 指标 → API 统计 → 日志 → 告警处理        |
| 管理员管理   | ✅ 闭环  | 列表 → 创建 → 编辑 → 重置密码 → 启用/禁用 → 强制登出           |
| 系统配置     | ✅ 闭环  | 站点配置 + 功能开关 + 安全配置 + 通知模板 均有读写 API         |
| 数据分析     | ✅ 闭环  | 用户/收入/技能分析 + 自定义报表 + 导出                         |

### 10.2 待确认项

1. **告警规则配置**：当前只有告警查看和处理，告警规则创建/编辑未展开（可在 P2 补充）
2. **管理员操作审批流**：敏感操作（如退款、删除计划）是否需要多人审批，当前为单人直接执行
3. **数据分析自定义报表**：`/analytics/custom` 的查询参数设计需根据实际数据模型进一步细化

---

## 11. 部署架构

### 开发环境

```
┌─────────────────────────────────────────────────────┐
│                     开发环境                          │
├─────────────────────────────────────────────────────┤
│                                                       │
│   ┌─────────────────┐         ┌─────────────────┐    │
│   │   Vite Dev      │  proxy  │   Gateway       │    │
│   │   localhost:5174 │ ──────► │   localhost:18789│   │
│   └─────────────────┘         └─────────────────┘    │
│                                       │               │
│                                       ▼               │
│                               ┌─────────────────┐    │
│                               │   PostgreSQL    │    │
│                               │   localhost:5432│    │
│                               └─────────────────┘    │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 生产环境

```
┌─────────────────────────────────────────────────────────────────┐
│                        生产环境                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────┐         ┌─────────────────┐                │
│   │   CDN/Nginx     │         │   API Gateway   │                │
│   │   admin.xxx.com │ ──────► │   api.xxx.com   │                │
│   └─────────────────┘         └────────┬────────┘                │
│                                        │                          │
│                                        ▼                          │
│                               ┌─────────────────┐                │
│                               │   Gateway 服务   │                │
│                               │   (内网)         │                │
│                               └────────┬────────┘                │
│                                        │                          │
│            ┌───────────────────────────┼───────────────────┐     │
│            ▼                           ▼                   ▼     │
│   ┌─────────────────┐         ┌─────────────────┐ ┌──────────┐  │
│   │   PostgreSQL    │         │   Redis         │ │ 日志存储  │  │
│   └─────────────────┘         └─────────────────┘ └──────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. 环境变量

```bash
# apps/admin-console/.env
VITE_API_BASE_URL=http://localhost:18789
VITE_APP_TITLE=OpenClaw Admin
```

---

_— 文档结束 —_
