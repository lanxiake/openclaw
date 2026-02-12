# OpenClaw AI 个人助理平台 - 用户端管理面板设计 (web-admin)

> 版本: 1.0 | 创建日期: 2026-02-12 | 状态: 从 04 整合版拆分
>
> 本文档描述面向最终用户的管理面板设计

---

## 修订记录

| 版本 | 日期       | 修订内容                                               |
| ---- | ---------- | ------------------------------------------------------ |
| 1.0  | 2026-02-12 | 从 04-管理后台系统设计.md 拆分，补充认证和个人设置 API |

---

## 1. 概述

### 1.1 系统定位

| 项目     | 说明                       |
| -------- | -------------------------- |
| 目标用户 | 平台最终用户               |
| 功能范围 | 管理自己的设备、技能、订阅 |
| 数据权限 | 仅能访问自己的数据         |
| 认证方式 | 用户账号登录               |
| 部署路径 | `apps/web-admin`           |
| 开发端口 | `localhost:5173`           |
| API 前缀 | `/api/v1/`                 |

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
| React Hook Form | 7.x    | 表单      |
| Zod             | 3.x    | 验证      |

---

## 2. 功能模块

| 模块     | 功能                            | 优先级 |
| -------- | ------------------------------- | ------ |
| 用户认证 | 登录、注册、忘记密码            | P0     |
| 设备管理 | 查看/管理已配对设备、添加新设备 | P0     |
| 技能管理 | 已安装技能、技能商店、技能配置  | P0     |
| 订阅管理 | 当前订阅、升级/续费、账单历史   | P0     |
| 个人设置 | 账号信息、安全设置、偏好设置    | P1     |
| 使用统计 | 使用量统计、操作历史            | P2     |

---

## 3. 页面结构

```
apps/web-admin/
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── devices/
│   │   │   ├── DeviceListPage.tsx
│   │   │   └── DevicePairPage.tsx
│   │   ├── skills/
│   │   │   ├── SkillListPage.tsx
│   │   │   ├── SkillStorePage.tsx
│   │   │   └── SkillDetailPage.tsx
│   │   ├── subscription/
│   │   │   ├── SubscriptionPage.tsx
│   │   │   └── BillingHistoryPage.tsx
│   │   ├── settings/
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── SecurityPage.tsx
│   │   │   └── PreferencesPage.tsx
│   │   └── stats/
│   │       └── UsageStatsPage.tsx
│   ├── components/
│   │   ├── ui/              # shadcn/ui 组件
│   │   ├── layout/          # 布局组件 (Sidebar, Header, Footer)
│   │   └── common/          # 通用组件 (Loading, ErrorBoundary)
│   ├── hooks/
│   ├── services/            # API 调用封装
│   └── stores/              # Zustand 状态管理
```

---

## 4. 路由配置

```typescript
const routes = [
  // 公开路由
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },

  // 受保护路由
  {
    path: '/',
    element: <ProtectedRoute><UserLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'devices', element: <DeviceListPage /> },
      { path: 'devices/pair', element: <DevicePairPage /> },
      { path: 'skills', element: <SkillListPage /> },
      { path: 'skills/store', element: <SkillStorePage /> },
      { path: 'skills/:skillId', element: <SkillDetailPage /> },
      { path: 'subscription', element: <SubscriptionPage /> },
      { path: 'billing', element: <BillingHistoryPage /> },
      { path: 'settings', element: <ProfilePage /> },
      { path: 'settings/security', element: <SecurityPage /> },
      { path: 'settings/preferences', element: <PreferencesPage /> },
      { path: 'stats', element: <UsageStatsPage /> },
    ],
  },
];
```

---

## 5. API 设计

### 5.1 用户认证 API

```
POST   /api/v1/auth/register       # 用户注册
POST   /api/v1/auth/login          # 用户登录
POST   /api/v1/auth/logout         # 用户登出
POST   /api/v1/auth/refresh        # 刷新令牌
POST   /api/v1/auth/forgot-password    # 发送重置密码邮件
POST   /api/v1/auth/reset-password     # 重置密码（携带 token）
```

### 5.2 设备管理 API

```
GET    /api/v1/devices              # 获取设备列表（含在线/离线状态）
POST   /api/v1/devices/pair         # 配对新设备
GET    /api/v1/devices/:id          # 获取设备详情
PATCH  /api/v1/devices/:id          # 更新设备信息（别名等）
DELETE /api/v1/devices/:id          # 解绑设备
POST   /api/v1/devices/:id/revoke   # 撤销设备授权
```

### 5.3 技能管理 API

```
GET    /api/v1/skills               # 获取已安装技能
GET    /api/v1/skills/store         # 技能商店列表（支持分页、搜索、分类筛选）
GET    /api/v1/skills/:id           # 技能详情
POST   /api/v1/skills/:id/install   # 安装技能
DELETE /api/v1/skills/:id           # 卸载技能
PATCH  /api/v1/skills/:id/config    # 更新技能配置
```

### 5.4 订阅管理 API

```
GET    /api/v1/subscription         # 获取当前订阅
GET    /api/v1/subscription/plans   # 获取可用订阅计划列表
POST   /api/v1/subscription/upgrade # 升级订阅
POST   /api/v1/subscription/renew   # 续费订阅
POST   /api/v1/subscription/cancel  # 取消订阅
GET    /api/v1/billing/history      # 账单历史
GET    /api/v1/billing/invoices/:id # 下载发票
```

### 5.5 个人设置 API

```
GET    /api/v1/profile              # 获取个人信息
PATCH  /api/v1/profile              # 更新个人信息（昵称、头像等）
POST   /api/v1/profile/change-password  # 修改密码（需验证旧密码）
GET    /api/v1/profile/sessions     # 获取活跃会话列表
DELETE /api/v1/profile/sessions/:id # 注销指定会话
GET    /api/v1/preferences          # 获取偏好设置
PATCH  /api/v1/preferences          # 更新偏好设置（语言、通知等）
```

### 5.6 使用统计 API

```
GET    /api/v1/stats/usage          # 使用量统计（消息数、API 调用等）
GET    /api/v1/stats/history        # 操作历史（分页）
```

---

## 6. 数据库依赖

用户端管理面板不引入新的数据库表，依赖平台已有的核心表：

| 表名            | 用途                     |
| --------------- | ------------------------ |
| `users`         | 用户基本信息、认证       |
| `devices`       | 用户设备列表             |
| `skills`        | 技能安装记录             |
| `subscriptions` | 用户订阅状态             |
| `orders`        | 订单/账单记录            |
| `user_sessions` | 用户会话管理             |
| `preferences`   | 用户偏好设置（如需新增） |

---

## 7. 业务闭环分析

### 7.1 闭环状态总览

| 业务流程 | 闭环状态  | 说明                                               |
| -------- | --------- | -------------------------------------------------- |
| 用户认证 | ✅ 闭环   | 注册 → 登录 → 忘记密码 → 重置密码 → 登出           |
| 设备管理 | ✅ 闭环   | 配对 → 查看列表 → 查看详情 → 更新 → 解绑/撤销      |
| 技能管理 | ✅ 闭环   | 浏览商店 → 安装 → 配置 → 查看已安装 → 卸载         |
| 订阅管理 | ✅ 闭环   | 查看计划 → 订阅 → 升级/续费 → 取消 → 查看账单/发票 |
| 个人设置 | ✅ 闭环   | 查看资料 → 修改资料 → 改密码 → 管理会话 → 偏好设置 |
| 使用统计 | ⚠️ 半闭环 | 可查看统计和历史，但无导出功能（P2 可补充）        |

### 7.2 待确认项

1. **支付集成**：订阅升级/续费涉及支付网关对接（支付宝/微信/Stripe），具体支付流程未在本文档展开
2. **邮件服务**：忘记密码需要邮件发送能力，依赖外部邮件服务
3. **设备在线状态**：需要 Gateway WebSocket 实时推送设备上下线事件

---

## 8. 环境变量

```bash
# apps/web-admin/.env
VITE_API_BASE_URL=http://localhost:18789
VITE_APP_TITLE=OpenClaw
```

---

## 9. 部署架构

### 开发环境

```
┌─────────────────────────────────────────────────────┐
│                     开发环境                          │
├─────────────────────────────────────────────────────┤
│                                                       │
│   ┌─────────────────┐         ┌─────────────────┐    │
│   │   Vite Dev      │  proxy  │   Gateway       │    │
│   │   localhost:5173 │ ──────► │   localhost:18789│   │
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
用户浏览器 ──► CDN (静态资源) ──► user.xxx.com
                                      │
                                      ▼ (API 请求)
                               API Gateway (api.xxx.com)
                                      │
                                      ▼
                               Gateway 服务 (内网)
                                      │
                                      ▼
                               PostgreSQL
```

---

_— 文档结束 —_
