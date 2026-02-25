# Phase 6-7：积分包管理与订阅积分发放修正

## Phase 6：积分包配置与管理

### 变更文件

| 文件                                          | 变更                       |
| --------------------------------------------- | -------------------------- |
| `src/db/schema/system-config.ts`              | 新增 CONFIG_KEY            |
| `src/assistant/config/config-service.ts`      | 新增积分包默认配置         |
| `apps/api-server/src/routes/credits/index.ts` | 新增用户端列表 API         |
| `apps/api-server/src/routes/admin/credits.ts` | 新增管理端 CRUD + 统计 API |

### Task 6.1：新增 CONFIG_KEY

**文件**：`src/db/schema/system-config.ts`

在 `CONFIG_KEYS` 对象中新增：

```typescript
// 积分包配置
CREDITS_PACKS: "credits.packs",
```

### Task 6.2：积分包默认配置初始化

**文件**：`src/assistant/config/config-service.ts`

在 `initializeDefaultConfigs()` 中新增：

```typescript
{
  key: CONFIG_KEYS.CREDITS_PACKS,
  value: [
    {
      code: "pack_basic",
      name: "基础包",
      price: 1000,       // 10 元（分）
      credits: 600,
      expiryMonths: 3,
      recommended: false,
      sortOrder: 1,
      isActive: true,
    },
    {
      code: "pack_standard",
      name: "标准包",
      price: 2000,       // 20 元（分）
      credits: 1200,
      expiryMonths: 3,
      recommended: true,
      sortOrder: 2,
      isActive: true,
    },
    {
      code: "pack_premium",
      name: "优惠包",
      price: 5000,       // 50 元（分）
      credits: 3200,
      expiryMonths: 3,
      recommended: false,
      sortOrder: 3,
      isActive: true,
    },
  ],
  valueType: "json" as ConfigValueType,
  group: CONFIG_GROUPS.CREDITS,
  description: "积分包产品配置列表（JSON数组）",
  defaultValue: [],
},
```

### Task 6.3：积分包类型定义

**文件**：新建 `src/assistant/credits/credit-pack-types.ts`（或在 credit-service.ts 中定义）

```typescript
/** 积分包配置 */
export interface CreditPackConfig {
  /** 积分包代码 */
  code: string;
  /** 显示名称 */
  name: string;
  /** 价格（分） */
  price: number;
  /** 积分数量 */
  credits: number;
  /** 有效期（月） */
  expiryMonths: number;
  /** 是否推荐 */
  recommended: boolean;
  /** 排序 */
  sortOrder: number;
  /** 是否可购买 */
  isActive: boolean;
}
```

### Task 6.4：用户端积分包列表 API

**文件**：`apps/api-server/src/routes/credits/index.ts`

新增路由：

```typescript
/**
 * GET /api/credits/packs — 获取可购买的积分包列表
 *
 * 从 system_configs 读取 credits.packs 配置
 * 过滤 isActive=true，按 sortOrder 排序
 */
server.get("/api/credits/packs", async (request, reply) => {
  const user = getRequestUser(request);
  if (!user) {
    return reply.code(401).send({ success: false, error: "Authentication required" });
  }

  const packs = await getConfigValue<CreditPackConfig[]>(CONFIG_KEYS.CREDITS_PACKS, []);

  // 过滤激活的积分包
  const activePacks = packs.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return { success: true, data: activePacks };
});
```

### Task 6.5：管理端积分包 API

**文件**：`apps/api-server/src/routes/admin/credits.ts`

新增路由：

```typescript
/**
 * GET /api/admin/credits/packs — 获取所有积分包配置（含未激活）
 */
server.get("/api/admin/credits/packs", async (request, reply) => {
  const packs = await getConfigValue<CreditPackConfig[]>(CONFIG_KEYS.CREDITS_PACKS, []);
  return { success: true, data: packs };
});

/**
 * PUT /api/admin/credits/packs — 更新积分包配置
 *
 * Body: CreditPackConfig[]
 */
server.put("/api/admin/credits/packs", async (request, reply) => {
  const packs = request.body as CreditPackConfig[];
  // 验证数据
  await updateConfig(CONFIG_KEYS.CREDITS_PACKS, packs);
  return { success: true, data: packs };
});

/**
 * GET /api/admin/credits/packs/stats — 积分包购买统计
 *
 * 从 payment_orders 聚合 order_type='credits' 的订单
 */
server.get("/api/admin/credits/packs/stats", async (request, reply) => {
  // SELECT metadata->>'packCode' as pack_code,
  //        COUNT(*) as total_orders,
  //        SUM(paid_amount) as total_revenue
  // FROM payment_orders
  // WHERE order_type = 'credits' AND payment_status = 'paid'
  // GROUP BY metadata->>'packCode'
  const stats = await getPackPurchaseStats();
  return { success: true, data: stats };
});

/**
 * GET /api/admin/credits/packs/orders — 积分包购买记录
 *
 * 分页查询 order_type='credits' 的订单
 */
server.get("/api/admin/credits/packs/orders", async (request, reply) => {
  const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number };
  const orders = await getPackPurchaseOrders({ page, pageSize });
  return { success: true, data: orders };
});
```

### Task 6.6：测试用例

```typescript
describe("积分包管理", () => {
  it("用户端获取积分包列表 → 3 个激活的包", async () => {
    /* ... */
  });
  it("管理端获取所有积分包 → 含配置详情", async () => {
    /* ... */
  });
  it("管理端更新积分包价格 → 用户端立即生效", async () => {
    /* ... */
  });
  it("管理端禁用某包 → 用户端不可见", async () => {
    /* ... */
  });
  it("积分包购买统计正确聚合", async () => {
    /* ... */
  });
});
```

---

## Phase 7：订阅积分发放逻辑修正

### 变更文件

| 文件                                                | 变更             |
| --------------------------------------------------- | ---------------- |
| `apps/api-server/src/routes/subscriptions/index.ts` | 修正积分发放逻辑 |

### 问题描述

当前 `POST /api/subscriptions` 路由中（第 190-214 行），年付订阅一次性发放 `monthlyCredits * 12` 积分，有效期 12 个月。

**业务需求**：月付/年付均为每月发放 2000 积分，当月有效（按月清零）。

### Task 7.1：修正创建订阅时的积分发放

**文件**：`apps/api-server/src/routes/subscriptions/index.ts`

定位：第 190-214 行

```typescript
// ===== 修改前 =====
const expiryMonths = body.billingPeriod === "yearly" ? 12 : 1;
const creditAmount = body.billingPeriod === "yearly" ? monthlyCredits * 12 : monthlyCredits;

// ===== 修改后 =====
// 无论月付还是年付，创建订阅时只发放当月积分
const creditAmount = monthlyCredits; // 固定 2000

// 积分有效期：当月结束
// 月付：当前计费周期结束
// 年付：当月月底
const expiryDate = calculateCreditExpiry(body.billingPeriod, subscription);

const creditResult = await creditService.grantSubscriptionCredits(user.userId, {
  amount: creditAmount,
  expiryMonths: 1, // 1 个月有效期（简化处理）
  sourceId: subscription.id,
  description: `订阅 ${body.planId} 首月积分发放 ${creditAmount} 积分`,
});
```

### Task 7.2：辅助函数

```typescript
/**
 * 计算订阅积分过期时间
 *
 * 月付：当前计费周期结束时间
 * 年付：当月月底
 */
function calculateCreditExpiry(billingPeriod: string, subscription: any): Date {
  if (billingPeriod === "monthly") {
    return new Date(subscription.currentPeriodEnd);
  }
  // 年付：当月最后一天
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}
```

### Task 7.3：年付每月自动发放（延期事项说明）

年付用户的每月自动积分发放需要通过定时任务实现。这涉及：

1. 每月 1 号查询所有活跃的年付订阅
2. 为每个用户发放 2000 积分
3. 积分有效期为当月月底

此功能需要配合定时任务系统（cron），暂不在本次实施范围内。当前实现确保创建订阅时的首月发放正确。

### Task 7.4：测试用例

```typescript
describe("订阅积分发放", () => {
  it("月付创建 → 发放 2000 积分，非 24000", async () => {
    const result = await createSubscription({ planId: "monthly", billingPeriod: "monthly" });
    expect(result.creditsGranted).toBe(2000);
  });

  it("年付创建 → 发放 2000 积分（首月），非 24000", async () => {
    const result = await createSubscription({ planId: "yearly", billingPeriod: "yearly" });
    expect(result.creditsGranted).toBe(2000);
  });
});
```

---

## Phase 8：集成验证

### Task 8.1：全量构建

```bash
pnpm lint
pnpm build
pnpm test
```

### Task 8.2：数据库迁移 SQL（已有部署）

```sql
-- 1. 禁用旧套餐
UPDATE plans SET is_active = false WHERE code IN ('pro', 'team', 'enterprise');

-- 2. 更新免费版
UPDATE plans SET
  max_devices = 5,
  storage_mb = 50,
  tokens_per_month = 0,
  features = '{"maxSkills":100,"maxFileSize":50}'
WHERE code = 'free';

-- 3. 新增月付版和年付版
INSERT INTO plans (id, code, name, description, price_monthly, price_yearly, tokens_per_month, storage_mb, max_devices, features, is_active, sort_order)
VALUES
  (gen_random_uuid(), 'monthly', '月付版', '30元/月，每月2000积分，首月3元',
   3000, 0, 2000, 50, 5, '{"maxSkills":100,"maxFileSize":50,"firstMonthPrice":300}', true, 2),
  (gen_random_uuid(), 'yearly', '年付版', '300元/年，每月2000积分',
   0, 30000, 2000, 50, 5, '{"maxSkills":100,"maxFileSize":50}', true, 3)
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

-- 4. 更新积分参数
UPDATE system_configs SET value = '600' WHERE key = 'credits.register_bonus';
UPDATE system_configs SET value = '300' WHERE key = 'credits.invite_bonus';
UPDATE system_configs SET value = '3000' WHERE key = 'credits.invite_max';

-- 5. 更新用户限制
UPDATE system_configs SET value = '5' WHERE key = 'limits.max_devices';
INSERT INTO system_configs (id, key, value, value_type, config_group, description)
VALUES
  (gen_random_uuid(), 'limits.max_skills', '100', 'number', 'limits', '用户最大技能安装数'),
  (gen_random_uuid(), 'limits.max_file_size_mb', '50', 'number', 'limits', '用户单文件上传大小限制(MB)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. 已有 pro 用户的订阅迁移（可选）
-- UPDATE subscriptions SET plan_id = (SELECT id FROM plans WHERE code = 'monthly')
-- WHERE plan_id = (SELECT id FROM plans WHERE code = 'pro') AND status = 'active';
```

### Task 8.3：更新设计文档状态

更新 `05-现状与待调整清单.md`，标记各项为已完成。
