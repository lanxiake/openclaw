# 积分订阅系统实施计划

> 创建日期：2026-02-25
> 基于设计文档：`my-docs/架构改造文档-v2/积分订阅系统/05-现状与待调整清单.md`

## 0. 变更范围总览

本实施计划将现有积分订阅系统从 **free/pro/team/enterprise 四级套餐体系** 调整为 **free/monthly/yearly 三级积分制**，并统一资源限制、补齐积分包管理、权限控制等功能。

**核心变更**：

- 积分参数：注册 300→600、邀请 200→300、上限 2000→3000
- 套餐体系：4 种 → 3 种（free/monthly/yearly）
- 资源限制：按套餐区分 → 统一（设备 5、技能 100、文件 50MB）
- 新增功能：免费用户积分上限、首月优惠、积分包管理、权限控制

**不涉及的改动**：

- 积分批次 FIFO 消费机制（已正确实现）
- 模型定价和成本计算公式（已正确实现）
- 过期清理任务（已正确实现）
- 支付提供商集成（保持预留状态）

---

## Phase 1：积分参数与系统配置更新

> 影响最小、风险最低的纯数值调整，无结构性变更。

### Task 1.1：更新 CreditService 默认常量

**文件**：`src/assistant/credits/credit-service.ts`

**变更**：

```
DEFAULT_REGISTER_BONUS: 300 → 600
DEFAULT_INVITE_BONUS:   200 → 300
DEFAULT_INVITE_MAX:    2000 → 3000
```

**测试**：更新 `src/assistant/credits/credit-service.test.ts`（如存在），验证三个默认值。

### Task 1.2：更新 initializeDefaultConfigs 中的配置默认值

**文件**：`src/assistant/config/config-service.ts`

**变更**（`initializeDefaultConfigs()` 函数中的默认值）：

```
CREDITS_REGISTER_BONUS:  300 → 600
CREDITS_INVITE_BONUS:    200 → 300
CREDITS_INVITE_MAX:     2000 → 3000
```

**注意**：此处改动仅影响**新部署**的默认值。已有部署的 `system_configs` 表中的值不会被自动更新，需通过 Admin Console 或 SQL 手动调整。

### Task 1.3：更新统一用户限制配置

**文件**：`src/assistant/config/config-service.ts`

**变更**（`initializeDefaultConfigs()` 中）：

```
LIMITS_MAX_DEVICES:       2 → 5
```

需新增以下配置项（如 CONFIG_KEYS 中已定义但 initializeDefaultConfigs 中未初始化）：

```typescript
{
  key: CONFIG_KEYS.LIMITS_MAX_SKILLS,
  value: 100,
  description: "用户最大技能安装数",
},
{
  key: CONFIG_KEYS.LIMITS_MAX_FILE_SIZE_MB,
  value: 50,
  description: "用户单文件上传大小限制(MB)",
},
```

**文件**：`src/db/schema/system-config.ts`

确认 `CONFIG_KEYS` 中已有 `LIMITS_MAX_DEVICES`、`LIMITS_MAX_SKILLS`、`LIMITS_MAX_FILE_SIZE_MB`（根据探索结果已存在）。

### Task 1.4：验证

- [ ] `pnpm build` 编译通过
- [ ] 积分常量 grep 确认无遗漏的旧值引用
- [ ] `pnpm test` 相关单元测试通过

---

## Phase 2：套餐体系重构

> 将 free/pro/team/enterprise 替换为 free/monthly/yearly。涉及类型定义、默认数据、seed 脚本。

### Task 2.1：更新订阅类型定义

**文件**：`src/assistant/subscription/types.ts`

**变更 1** — `SubscriptionPlanId` 类型：

```typescript
// 原
export type SubscriptionPlanId = "free" | "pro" | "team" | "enterprise";
// 新
export type SubscriptionPlanId = "free" | "monthly" | "yearly";
```

**变更 2** — `DEFAULT_SUBSCRIPTION_PLANS` 数组，从 4 个计划替换为 3 个：

```typescript
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "免费版",
    description: "注册赠送600积分，邀请好友获取更多",
    price: { monthly: 0, yearly: 0 },
    features: [
      { id: "credits", name: "注册赠送积分", included: true, limit: "600积分" },
      { id: "invite", name: "邀请奖励", included: true, limit: "每人300积分" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: false,
      prioritySupport: false,
      apiAccess: false,
    },
    sortOrder: 1,
  },
  {
    id: "monthly",
    name: "月付版",
    description: "30元/月，每月2000积分，首月仅3元",
    price: { monthly: 3000, yearly: 0 },
    features: [
      { id: "credits", name: "每月积分", included: true, limit: "2000积分/月" },
      { id: "first_month", name: "首月优惠", included: true, limit: "首月3元" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: true,
      prioritySupport: false,
      apiAccess: false,
    },
    recommended: true,
    sortOrder: 2,
  },
  {
    id: "yearly",
    name: "年付版",
    description: "300元/年，每月2000积分，等效25元/月",
    price: { monthly: 0, yearly: 30000 },
    features: [
      { id: "credits", name: "每月积分", included: true, limit: "2000积分/月" },
      { id: "packs", name: "积分包购买", included: true },
      { id: "devices", name: "设备数量", included: true, limit: "最多5台" },
      { id: "skills", name: "技能安装", included: true, limit: "最多100个" },
      { id: "upload", name: "文件上传", included: true, limit: "50MB" },
    ],
    quotas: {
      dailyConversations: -1,
      monthlyAiCalls: -1,
      maxSkills: 100,
      maxDevices: 5,
      storageQuotaMb: 50,
      premiumSkills: true,
      prioritySupport: true,
      apiAccess: false,
    },
    sortOrder: 3,
  },
];
```

**变更 3** — 删除不再使用的旧配额函数引用（`isPaidPlan`, `getPlanDisplayPrice` 等需根据新计划更新）。

### Task 2.2：更新 Seed 脚本

**文件**：`scripts/seed-dev.ts`

**变更** — `SEED_CONFIG.plans` 数组替换为：

```typescript
plans: [
  {
    code: "free",
    name: "免费版",
    description: "注册赠送600积分，邀请好友获取更多",
    priceMonthly: 0,
    priceYearly: 0,
    tokensPerMonth: 0,
    storageMb: 50,
    maxDevices: 5,
    features: { maxSkills: 100, maxFileSize: 50 },
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "monthly",
    name: "月付版",
    description: "30元/月，每月2000积分，首月3元",
    priceMonthly: 3000,
    priceYearly: 0,
    tokensPerMonth: 2000,
    storageMb: 50,
    maxDevices: 5,
    features: { maxSkills: 100, maxFileSize: 50, firstMonthPrice: 300 },
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "yearly",
    name: "年付版",
    description: "300元/年，每月2000积分",
    priceMonthly: 0,
    priceYearly: 30000,
    tokensPerMonth: 2000,
    storageMb: 50,
    maxDevices: 5,
    features: { maxSkills: 100, maxFileSize: 50 },
    isActive: true,
    sortOrder: 3,
  },
],
```

同时更新 `seedUsers()` 中的用户订阅关联：

- 用户 1（13800138000）→ free（无订阅）
- 用户 2（13900139000）→ monthly

### Task 2.3：清理旧套餐引用

全局搜索以下关键词，清理/替换所有引用：

- `"pro"` 作为 planId 的引用
- `"team"` 作为 planId 的引用
- `"enterprise"` 作为 planId 的引用
- `PRO_QUOTA`、`TEAM_QUOTA`、`ENTERPRISE_QUOTA` 配置引用

**可能涉及的文件**：

- `src/db/schema/system-config.ts` — CONFIG_KEYS 中的 `PRO_QUOTA`、`TEAM_QUOTA`、`ENTERPRISE_QUOTA`
- `src/assistant/config/config-service.ts` — 初始化配置中的旧配额
- Gateway RPC 方法中引用旧 planId 的代码
- Admin Console 中引用旧套餐的组件

### Task 2.4：验证

- [ ] `pnpm build` 编译通过
- [ ] TypeScript 类型检查通过（SubscriptionPlanId 缩窄后可能暴露类型错误）
- [ ] `pnpm test` 通过
- [ ] Seed 脚本执行成功：`pnpm db:seed`

---

## Phase 3：免费用户积分上限

> 新增业务规则：免费用户积分持有上限 3000。

### Task 3.1：添加积分上限常量和检查逻辑

**文件**：`src/assistant/credits/credit-service.ts`

**新增常量**：

```typescript
const FREE_USER_CREDIT_CAP = 3000;
```

**修改 `grantRegistrationBonus()`**：在创建账户后检查积分上限。

**修改 `grantInviteReward()`**：在发放前检查上限：

```typescript
// 在邀请积分上限检查之后，增加免费用户积分持有上限检查
const account = await this.accountRepo.getOrCreate(inviterUserId);
if (account.totalBalance + amount > FREE_USER_CREDIT_CAP) {
  // 计算实际可发放的积分
  const actualAmount = Math.max(0, FREE_USER_CREDIT_CAP - account.totalBalance);
  if (actualAmount === 0) {
    return { success: false, reason: "积分已达持有上限" };
  }
  // 用 actualAmount 替代 amount 继续发放
}
```

**注意**：此上限仅适用于**免费用户**。付费用户（有活跃 monthly/yearly 订阅）不受此限制。需要判断用户订阅状态。

### Task 3.2：编写测试

**文件**：新建 `src/assistant/credits/credit-service.test.ts`（如不存在）

测试用例：

1. 免费用户注册赠送 600，余额为 600
2. 免费用户余额 2800 + 邀请 300 → 实际只发放 200（上限 3000）
3. 免费用户余额 3000 + 邀请 → 拒绝发放
4. 付费用户不受 3000 上限限制

### Task 3.3：验证

- [ ] 单元测试全部通过
- [ ] `pnpm build` 通过

---

## Phase 4：首月优惠逻辑

> 月付首月 3 元（原价 30 元）。

### Task 4.1：更新创建订阅流程

**文件**：`apps/api-server/src/routes/subscriptions/index.ts`

在 `POST /api/subscriptions` 路由中：

1. 创建 monthly 订阅时检查是否为该用户的首次月付
2. 若是首月 → 订单金额设为 300 分（3 元），设置 `isFirstMonth = true`
3. 若非首月 → 订单金额为 3000 分（30 元）

**文件**：`src/assistant/subscription/service.ts`（或迁移后的 DB 版本）

创建订阅时设置 `isFirstMonth` 标记。

### Task 4.2：更新续费流程

续费时将 `isFirstMonth` 更新为 `false`，恢复正常价格。

### Task 4.3：编写测试

测试用例：

1. 首次创建月付订阅 → 金额 300 分，isFirstMonth=true
2. 续费月付订阅 → 金额 3000 分，isFirstMonth=false
3. 已有月付历史的用户重新订阅 → 金额 3000 分
4. 年付不受首月优惠影响

### Task 4.4：验证

- [ ] 测试通过
- [ ] `pnpm build` 通过

---

## Phase 5：订阅权限控制（仅管理员可修改/取消）

> 移除用户端的订阅修改和取消能力。

### Task 5.1：禁用用户端取消/修改 API

**文件**：`apps/api-server/src/routes/subscriptions/index.ts`

**方案**：将 `POST /api/subscriptions/:id/cancel` 和 `PUT /api/subscriptions/:id` 路由返回 403：

```typescript
return reply.code(403).send({
  success: false,
  error: "订阅修改和取消请联系管理员",
  code: "ADMIN_ONLY",
});
```

**保留**的用户端路由：

- `GET /api/subscriptions/overview` — 查看订阅状态（只读）
- `POST /api/subscriptions` — 创建/购买订阅（用户仍可主动购买）
- `POST /api/subscriptions/quota-check` — 配额检查

### Task 5.2：禁用 Gateway RPC 的用户端取消/修改

**文件**：`src/gateway/server-methods/assistant-subscription.ts`

将 `assistant.subscription.cancel` 和 `assistant.subscription.update` 方法返回错误提示。

### Task 5.3：确认管理员端不受影响

确认以下路由正常工作：

- `POST /api/admin/subscriptions/:id/cancel` — 管理员取消
- `POST /api/admin/subscriptions/:id/extend` — 管理员延长
- `admin.subscriptions.cancel` — Gateway RPC 管理员取消

### Task 5.4：验证

- [ ] 用户端调用取消/修改 API 返回 403
- [ ] 管理员端取消/延长正常工作
- [ ] `pnpm build` 通过

---

## Phase 6：积分包配置与管理

> 新增积分包产品定义、用户端列表 API、Admin 管理 API。

### Task 6.1：积分包配置初始化

**文件**：`src/assistant/config/config-service.ts`

在 `initializeDefaultConfigs()` 中新增积分包配置：

```typescript
{
  key: "credits.packs",
  value: [
    { code: "pack_basic", name: "基础包", price: 1000, credits: 600, expiryMonths: 3, recommended: false, sortOrder: 1, isActive: true },
    { code: "pack_standard", name: "标准包", price: 2000, credits: 1200, expiryMonths: 3, recommended: true, sortOrder: 2, isActive: true },
    { code: "pack_premium", name: "优惠包", price: 5000, credits: 3200, expiryMonths: 3, recommended: false, sortOrder: 3, isActive: true },
  ],
  valueType: "json",
  group: CONFIG_GROUPS.CREDITS,
  description: "积分包产品配置列表",
}
```

**文件**：`src/db/schema/system-config.ts`

新增 CONFIG_KEY：

```typescript
CREDITS_PACKS: "credits.packs",
```

### Task 6.2：用户端积分包列表 API

**文件**：`apps/api-server/src/routes/credits/index.ts`

新增路由：

```
GET /api/credits/packs — 返回激活的积分包列表
```

从 `system_configs` 读取 `credits.packs` 配置，过滤 `isActive=true`，按 `sortOrder` 排序返回。

### Task 6.3：管理员积分包管理 API

**文件**：`apps/api-server/src/routes/admin/credits.ts`

新增路由：

```
GET    /api/admin/credits/packs         — 获取积分包配置（含未激活的）
PUT    /api/admin/credits/packs         — 更新积分包配置
GET    /api/admin/credits/packs/stats   — 积分包购买统计
GET    /api/admin/credits/packs/orders  — 积分包购买记录
```

购买统计从 `payment_orders` 表中聚合：

```sql
WHERE order_type = 'credits'
GROUP BY metadata->>'packCode'
```

### Task 6.4：编写测试

- 用户端获取积分包列表 → 返回 3 个激活的积分包
- 管理员更新积分包价格 → 生效
- 管理员禁用某个积分包 → 用户端不可见
- 购买统计正确聚合

### Task 6.5：验证

- [ ] 测试通过
- [ ] API 手动测试（curl/Postman）
- [ ] `pnpm build` 通过

---

## Phase 7：订阅积分发放逻辑修正

> 确保月付/年付积分按月发放且按月清零。

### Task 7.1：修正订阅创建时的积分发放

**文件**：`apps/api-server/src/routes/subscriptions/index.ts`

**当前问题**：年付创建时一次性发放 `monthlyCredits * 12` 积分，有效期 12 个月。

**修正**：

- 月付：发放 2000 积分，有效期 = 当前计费周期结束（约 1 个月）
- 年付：发放 2000 积分，有效期 = 当月月底

```typescript
// 修正后
const creditAmount = monthlyCredits; // 固定 2000，不乘以 12
const expiresAt =
  billingCycle === "monthly"
    ? subscription.currentPeriodEnd // 月付：周期结束
    : endOfCurrentMonth(); // 年付：当月月底
```

### Task 7.2：年付每月自动发放

需要确保年付用户每月 1 号自动发放 2000 积分。这应通过定时任务（cron job）或订阅续费逻辑触发。

**检查现有实现**：

- `src/assistant/payment/auto-renewal.ts` 是否已有月度发放逻辑
- 如果没有，需要在 cron 任务中新增年付用户月度积分发放

### Task 7.3：验证

- [ ] 月付创建 → 发放 2000 积分，有效期 1 个月
- [ ] 年付创建 → 发放 2000 积分，有效期当月底
- [ ] 测试通过

---

## Phase 8：集成验证与收尾

### Task 8.1：全量构建和测试

```bash
pnpm lint
pnpm build
pnpm test
```

### Task 8.2：数据库迁移脚本

如果 schema 有变更（如 plans 表需要新增记录），编写迁移 SQL：

```sql
-- 对已有部署：更新 plans 表
UPDATE plans SET is_active = false WHERE code IN ('pro', 'team', 'enterprise');

INSERT INTO plans (id, code, name, description, price_monthly, price_yearly, tokens_per_month, storage_mb, max_devices, features, is_active, sort_order)
VALUES
  (gen_random_uuid(), 'monthly', '月付版', '30元/月，每月2000积分，首月3元', 3000, 0, 2000, 50, 5, '{"maxSkills":100,"maxFileSize":50,"firstMonthPrice":300}', true, 2),
  (gen_random_uuid(), 'yearly', '年付版', '300元/年，每月2000积分', 0, 30000, 2000, 50, 5, '{"maxSkills":100,"maxFileSize":50}', true, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  tokens_per_month = EXCLUDED.tokens_per_month,
  storage_mb = EXCLUDED.storage_mb,
  max_devices = EXCLUDED.max_devices,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 更新 system_configs 中的积分参数
UPDATE system_configs SET value = '600' WHERE key = 'credits.register_bonus';
UPDATE system_configs SET value = '300' WHERE key = 'credits.invite_bonus';
UPDATE system_configs SET value = '3000' WHERE key = 'credits.invite_max';
UPDATE system_configs SET value = '5' WHERE key = 'limits.max_devices';
```

### Task 8.3：文档更新

更新 `05-现状与待调整清单.md` 中各项状态为已完成。

---

## 延期事项（不在本次实施范围）

以下事项记录在案，后续独立实施：

| 事项                                | 原因                             |
| ----------------------------------- | -------------------------------- |
| 订阅服务从文件存储迁移到 PostgreSQL | 结构性重构，风险较高，需独立评估 |
| 模型定价页面自动获取提供商列表      | 依赖模型注册表功能完善           |
| Admin Console 积分包管理 UI         | 后端 API 先行，UI 后续跟进       |
| Windows 客户端积分包购买 UI         | 依赖 API 先完成                  |
| 支付提供商集成（微信/支付宝）       | 独立项目，不影响积分逻辑         |

---

## 文件变更清单

| Phase | 文件                                                   | 变更类型           |
| ----- | ------------------------------------------------------ | ------------------ |
| 1     | `src/assistant/credits/credit-service.ts`              | 修改（常量）       |
| 1     | `src/assistant/config/config-service.ts`               | 修改（默认值）     |
| 2     | `src/assistant/subscription/types.ts`                  | 修改（类型+数据）  |
| 2     | `scripts/seed-dev.ts`                                  | 修改（套餐定义）   |
| 2     | `src/db/schema/system-config.ts`                       | 修改（清理旧 KEY） |
| 3     | `src/assistant/credits/credit-service.ts`              | 修改（上限逻辑）   |
| 3     | `src/assistant/credits/credit-service.test.ts`         | 新建/修改（测试）  |
| 4     | `apps/api-server/src/routes/subscriptions/index.ts`    | 修改（首月优惠）   |
| 5     | `apps/api-server/src/routes/subscriptions/index.ts`    | 修改（权限控制）   |
| 5     | `src/gateway/server-methods/assistant-subscription.ts` | 修改（禁用方法）   |
| 6     | `src/db/schema/system-config.ts`                       | 修改（新增 KEY）   |
| 6     | `src/assistant/config/config-service.ts`               | 修改（积分包配置） |
| 6     | `apps/api-server/src/routes/credits/index.ts`          | 修改（新增路由）   |
| 6     | `apps/api-server/src/routes/admin/credits.ts`          | 修改（新增路由）   |
| 7     | `apps/api-server/src/routes/subscriptions/index.ts`    | 修改（积分发放）   |
