# 服务端管理后台 (admin-console) 开发计划

> 创建日期: 2026-02-12 | 状态: 待确认

---

## 1. 现状分析

### 1.1 前端实现状态 (apps/admin-console)

| 模块           | 页面数 | 实现状态    | 说明                          |
| -------------- | ------ | ----------- | ----------------------------- |
| 管理员认证     | 1      | ✅ 完成     | 登录、MFA、Token 刷新         |
| 仪表盘         | 1      | ✅ 完成     | 统计卡片、趋势图、活动列表    |
| 用户管理       | 2      | ✅ 完成     | 列表、详情、操作              |
| 订阅管理       | 3      | ✅ 完成     | 计划 CRUD、订阅列表、订单列表 |
| 技能商店       | 3      | ✅ 完成     | 技能审核、分类、推荐          |
| 监控告警       | 3      | ✅ 完成     | 系统监控、日志、告警          |
| 系统配置       | 5      | ✅ 完成     | 站点/功能/安全/通知配置       |
| 数据分析       | 5      | ✅ 完成     | 用户/收入/技能/漏斗分析       |
| 审计日志       | 1      | ✅ 完成     | 操作日志查询                  |
| **管理员管理** | **0**  | **❌ 缺失** | **设计文档有，但未实现**      |

**总结**: 23/23 页面 UI 已完成，但管理员管理模块完全缺失。

### 1.2 后端实现状态 (Gateway RPC)

| 模块文件               | 方法数 | 数据源      | 说明                                  |
| ---------------------- | ------ | ----------- | ------------------------------------- |
| admin-auth.ts          | 8      | ✅ 真实 DB  | 认证服务完整                          |
| admin-users.ts         | 8      | ✅ 真实 DB  | 用户管理完整                          |
| admin-subscriptions.ts | 15     | ✅ 真实 DB  | 订阅管理完整                          |
| admin-audit.ts         | 6      | ✅ 真实 DB  | 审计日志完整                          |
| admin-dashboard.ts     | 4      | ✅ 真实 DB  | 仪表盘完整                            |
| admin-skills.ts        | 13     | ✅ 真实 DB  | 技能管理完整                          |
| admin-monitor.ts       | 10     | ◐ 混合      | 核心指标真实，**日志/告警 mock**      |
| admin-config.ts        | 14+    | ◐ 混合      | 配置真实，**通知模板 mock**           |
| admin-analytics.ts     | 10     | ◐ 混合      | 部分真实，**留存/漏斗/收入细分 mock** |
| **admin-admins.ts**    | **0**  | **❌ 缺失** | **管理员管理完全缺失**                |

### 1.3 数据库层状态

| 层面        | 状态    | 说明                                                                |
| ----------- | ------- | ------------------------------------------------------------------- |
| Schema 定义 | ✅ 完成 | 所有表已在 src/db/schema/ 定义                                      |
| 迁移文件    | ✅ 完成 | drizzle-kit 已生成                                                  |
| Repository  | ◐ 部分  | admins/users/subscriptions/audit 有，skill-store/system-config 缺失 |
| 测试        | ◐ 部分  | admins.test.ts, users.test.ts 存在，其他缺失                        |

### 1.4 Mock 数据清单

| 位置               | Mock 内容      | 替换方案                              |
| ------------------ | -------------- | ------------------------------------- |
| admin-monitor.ts   | 8 条硬编码日志 | 从 auditLogs 表查询                   |
| admin-monitor.ts   | 3 条硬编码告警 | 新建 system_alerts 表或从日志聚合     |
| admin-config.ts    | 6 个通知模板   | 新建 notification_templates 表        |
| admin-analytics.ts | 用户留存数据   | 从 loginAttempts 计算 cohort          |
| admin-analytics.ts | 地区/活跃时段  | 从 auditLogs IP 聚合                  |
| admin-analytics.ts | 收入来源       | 从 paymentOrders 聚合                 |
| admin-analytics.ts | MRR/ARR/ARPU   | 从 subscriptions + paymentOrders 计算 |
| admin-analytics.ts | 漏斗数据       | 从 auditLogs 事件链计算               |

---

## 2. 开发计划

### 阶段 1: 管理员管理功能（核心缺失）

**目标**: 实现管理员 CRUD，补齐业务闭环

#### 1.1 后端开发

| 任务           | 文件                                                 | 说明               |
| -------------- | ---------------------------------------------------- | ------------------ |
| 新建 RPC 方法  | `src/gateway/server-methods/admin-admins.ts`         | 管理员 CRUD 方法   |
| 注册到 Gateway | `src/gateway/server-methods.ts`                      | 导入并注册         |
| 新建 Service   | `src/assistant/admin-console/admin-admin-service.ts` | 管理员管理业务逻辑 |

**RPC 方法清单**:

```
admin.admins.list          # 管理员列表（分页、搜索、角色筛选）
admin.admins.get           # 管理员详情
admin.admins.create        # 创建管理员（仅 super_admin）
admin.admins.update        # 更新管理员信息/角色（仅 super_admin）
admin.admins.resetPassword # 重置管理员密码（仅 super_admin）
admin.admins.updateStatus  # 启用/禁用管理员（仅 super_admin）
admin.admins.forceLogout   # 强制管理员登出（仅 super_admin）
```

#### 1.2 前端开发

| 任务          | 文件                                 | 说明                       |
| ------------- | ------------------------------------ | -------------------------- |
| 类型定义      | `src/types/admin-manage.ts`          | 管理员管理相关类型         |
| 数据 Hook     | `src/hooks/useAdmins.ts`             | 管理员列表/详情/操作 hooks |
| 列表页面      | `src/pages/admins/AdminListPage.tsx` | 管理员列表 + 操作          |
| 创建/编辑弹窗 | 集成在 AdminListPage                 | Dialog 组件                |
| 路由注册      | `src/routes/index.tsx`               | /admins 路由               |
| 侧边栏菜单    | `src/components/layout/Sidebar.tsx`  | 添加管理员管理入口         |

#### 1.3 测试

| 类型         | 文件                          | 覆盖内容                    |
| ------------ | ----------------------------- | --------------------------- |
| Service 测试 | `admin-admin-service.test.ts` | 创建/更新/禁用/重置密码逻辑 |
| Hook 测试    | `useAdmins.test.ts`           | 数据获取和 mutation         |

---

### 阶段 2: 消除 Monitor Mock 数据

**目标**: 日志和告警从真实数据源获取

#### 2.1 日志系统

| 任务                              | 说明                                 |
| --------------------------------- | ------------------------------------ |
| 修改 `admin.monitor.logs`         | 从 adminAuditLogs + auditLogs 表查询 |
| 修改 `admin.monitor.logs.sources` | 从数据库动态获取日志来源             |

#### 2.2 告警系统

| 任务                                            | 说明                                       |
| ----------------------------------------------- | ------------------------------------------ |
| 新建 Schema                                     | `system_alerts` 表（或利用 systemConfigs） |
| 新建 Repository                                 | 告警 CRUD                                  |
| 修改 `admin.monitor.alerts`                     | 从数据库读取                               |
| 修改 `admin.monitor.alerts.acknowledge/resolve` | 持久化状态变更                             |

#### 2.3 测试

| 类型         | 覆盖内容            |
| ------------ | ------------------- |
| Service 测试 | 日志查询、告警 CRUD |

---

### 阶段 3: 消除 Config 通知模板 Mock

**目标**: 通知模板从数据库管理

#### 3.1 后端

| 任务                                | 说明                        |
| ----------------------------------- | --------------------------- |
| 新建 Schema                         | `notification_templates` 表 |
| 新建 Repository                     | 模板 CRUD                   |
| 修改 `admin.config.notifications.*` | 连接数据库                  |

#### 3.2 测试

| 类型            | 覆盖内容  |
| --------------- | --------- |
| Repository 测试 | 模板 CRUD |

---

### 阶段 4: 消除 Analytics Mock 数据

**目标**: 分析数据从真实业务数据聚合计算

#### 4.1 后端

| 任务     | 说明                                               |
| -------- | -------------------------------------------------- |
| 用户留存 | 从 userSessions/loginAttempts 计算 cohort 留存率   |
| 收入来源 | 从 paymentOrders 按 paymentMethod 聚合             |
| 收入指标 | 从 subscriptions + paymentOrders 计算 MRR/ARR/ARPU |
| 漏斗分析 | 从 auditLogs 事件链计算转化率                      |
| 地区分布 | 从 loginAttempts/auditLogs IP 解析（需 GeoIP 库）  |

#### 4.2 测试

| 类型         | 覆盖内容     |
| ------------ | ------------ |
| Service 测试 | 聚合计算逻辑 |

---

### 阶段 5: 补充测试

**目标**: 关键路径测试覆盖

| 类型              | 覆盖范围                             |
| ----------------- | ------------------------------------ |
| 后端 Service 测试 | admin-admin-service, monitor-service |
| 前端 Hook 测试    | useAdmins, useMonitor                |
| 集成测试          | 管理员创建→登录→操作 流程            |

---

## 3. 实施原则

1. **小步快跑**: 每个阶段内部按功能点拆分，完成一个测试一个
2. **后端先行**: 先写 Service 测试 → 实现 Service → 写 RPC 方法 → 前端对接
3. **不破坏现有功能**: 新增文件为主，修改已有文件尽量小范围
4. **保持代码风格一致**: 参照已有的 admin-users.ts / useUsers.ts 等模式

---

_— 文档结束 —_
