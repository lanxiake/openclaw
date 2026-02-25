# Phase 2：套餐体系重构

> 将 free/pro/team/enterprise 替换为 free/monthly/yearly

## 变更文件清单

| 文件                                     | 变更说明                |
| ---------------------------------------- | ----------------------- |
| `src/assistant/subscription/types.ts`    | 类型定义 + 默认计划数据 |
| `scripts/seed-dev.ts`                    | Seed 脚本套餐数据       |
| `src/db/schema/system-config.ts`         | 清理旧 CONFIG_KEYS      |
| `src/assistant/config/config-service.ts` | 清理旧配额初始化        |

## Task 2.1：更新 SubscriptionPlanId 类型

### 文件：`src/assistant/subscription/types.ts`

定位：第 20 行

```typescript
// ===== 修改前 =====
export type SubscriptionPlanId = "free" | "pro" | "team" | "enterprise";

// ===== 修改后 =====
export type SubscriptionPlanId = "free" | "monthly" | "yearly";
```

## Task 2.2：替换 DEFAULT_SUBSCRIPTION_PLANS

### 文件：`src/assistant/subscription/types.ts`

定位：第 281-392 行，将整个 `DEFAULT_SUBSCRIPTION_PLANS` 数组替换。

**关键设计决策**：

- 所有计划的 `quotas` 统一：`maxDevices=5`, `maxSkills=100`, `storageQuotaMb=50`
- `dailyConversations` 和 `monthlyAiCalls` 都设为 `-1`（不限制，通过积分控制）
- monthly 计划标记 `recommended: true`

详细替换内容见 `Credits-Subscription-00-实施计划.md` Task 2.1。

## Task 2.3：更新辅助函数

### 文件：`src/assistant/subscription/types.ts`

`isPaidPlan()` 函数需更新：

```typescript
// ===== 修改前 =====
export function isPaidPlan(planId: SubscriptionPlanId): boolean {
  return planId !== "free";
}
// ===== 修改后（逻辑不变，但 TypeScript 类型自动收窄） =====
export function isPaidPlan(planId: SubscriptionPlanId): boolean {
  return planId !== "free";
}
```

`getPlanDisplayPrice()` 函数需更新以适配新价格：

```typescript
export function getPlanDisplayPrice(planId: SubscriptionPlanId, period: BillingPeriod): string {
  const plan = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!plan) return "¥0";
  if (plan.price.monthly === 0 && plan.price.yearly === 0) return "免费";

  if (period === "yearly" && plan.price.yearly > 0) {
    return `¥${(plan.price.yearly / 100).toFixed(0)}/年`;
  }
  if (plan.price.monthly > 0) {
    return `¥${(plan.price.monthly / 100).toFixed(0)}/月`;
  }
  return "免费";
}
```

## Task 2.4：更新 Seed 脚本

### 文件：`scripts/seed-dev.ts`

**替换 `SEED_CONFIG.plans`**（第 50-99 行）：

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

**更新 `seedUsers()`**（第 237-240 行）：

```typescript
// ===== 修改前 =====
const planCode = i === 0 ? "free" : "pro";

// ===== 修改后 =====
const planCode = i === 0 ? "free" : "monthly";
```

## Task 2.5：清理旧套餐配置键

### 文件：`src/db/schema/system-config.ts`

定位：第 242-246 行

```typescript
// ===== 删除或标记废弃 =====
// 订阅配置（旧，已废弃）
// FREE_QUOTA: "free_quota",     → 保留，语义仍有效
// PRO_QUOTA: "pro_quota",       → 删除
// TEAM_QUOTA: "team_quota",     → 删除
// ENTERPRISE_QUOTA: "enterprise_quota", → 删除
```

**替换方案**：将旧的按套餐配额替换为统一限制（Phase 1 中已通过 `LIMITS_*` 实现）。

### 文件：`src/assistant/config/config-service.ts`

移除 `initializeDefaultConfigs()` 中 `PRO_QUOTA` 的初始化条目（第 681-688 行附近）。

## Task 2.6：全局搜索清理

搜索并修复所有引用旧 planId 的位置：

```bash
# 搜索旧 planId 引用
grep -rn '"pro"' src/ apps/ --include="*.ts" | grep -v node_modules | grep -v ".test."
grep -rn '"team"' src/ apps/ --include="*.ts" | grep -v node_modules
grep -rn '"enterprise"' src/ apps/ --include="*.ts" | grep -v node_modules
grep -rn "PRO_QUOTA\|TEAM_QUOTA\|ENTERPRISE_QUOTA" src/ apps/ --include="*.ts"
```

**可能涉及**：

- `src/assistant/subscription/service.ts` — `getUserPlan()` 中引用 `DEFAULT_SUBSCRIPTION_PLANS`
- Gateway RPC 方法中引用旧 planId
- Admin Console 组件中硬编码的套餐名称

## 验证步骤

```bash
# 1. TypeScript 类型检查（SubscriptionPlanId 缩窄后会暴露类型错误）
pnpm build

# 2. 搜索确认无遗留旧 planId
grep -rn '"pro"\|"team"\|"enterprise"' src/ apps/ --include="*.ts" | grep -v node_modules | grep -v test

# 3. 运行测试
pnpm test

# 4. Seed 脚本测试（如有测试数据库）
# pnpm db:seed
```

## 风险点

1. **TypeScript 类型收窄**：将 `SubscriptionPlanId` 从 4 个值缩减为 3 个，任何硬编码 `"pro"` / `"team"` / `"enterprise"` 的地方都会编译报错。这是好事——编译器帮助找到所有需要修改的地方。

2. **已有数据库中的 plans 表**：如果 plans 表中已有 `pro`/`enterprise` 记录，需要通过 SQL 将其 `is_active` 设为 false，并插入 `monthly`/`yearly` 记录。

3. **已有用户订阅**：如果有用户订阅了 `pro` 计划，需要决定迁移策略（例如自动映射到 `monthly`）。
