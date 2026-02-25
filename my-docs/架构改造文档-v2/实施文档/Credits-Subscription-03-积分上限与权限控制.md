# Phase 3-5：积分上限、首月优惠、权限控制

> 三个功能增强任务，均涉及业务逻辑修改

## Phase 3：免费用户积分持有上限

### 变更文件

| 文件                                           | 变更             |
| ---------------------------------------------- | ---------------- |
| `src/assistant/credits/credit-service.ts`      | 新增上限检查逻辑 |
| `src/assistant/credits/credit-service.test.ts` | 新建/补充测试    |

### Task 3.1：新增常量

```typescript
// src/assistant/credits/credit-service.ts

/** 免费用户积分持有上限 */
const FREE_USER_CREDIT_CAP = 3000;
```

### Task 3.2：修改 grantRegistrationBonus()

在创建账户后，检查赠送积分是否超过上限：

```typescript
async grantRegistrationBonus(userId: string, options?: RegistrationBonusOptions) {
  const amount = options?.amount ?? DEFAULT_REGISTER_BONUS;
  // ... 现有逻辑 ...

  // 注册赠送不可能超过上限（600 < 3000），但仍做防御性检查
  const actualAmount = Math.min(amount, FREE_USER_CREDIT_CAP);
  // 用 actualAmount 替代 amount 进行后续操作
}
```

### Task 3.3：修改 grantInviteReward()

在邀请积分上限检查后，新增持有上限检查：

```typescript
async grantInviteReward(inviterId, inviteeId, options?) {
  // ... 现有的 isAlreadyInvited 检查 ...
  // ... 现有的邀请积分上限检查 ...

  // 新增：免费用户积分持有上限检查
  const account = await this.accountRepo.getOrCreate(inviterUserId);
  const isFreeUser = await this.isUserFree(inviterUserId);

  if (isFreeUser && account.totalBalance + amount > FREE_USER_CREDIT_CAP) {
    const actualAmount = Math.max(0, FREE_USER_CREDIT_CAP - account.totalBalance);
    if (actualAmount === 0) {
      logger.info("[credit-service] 免费用户积分已达持有上限", {
        inviterUserId,
        balance: account.totalBalance,
        cap: FREE_USER_CREDIT_CAP,
      });
      return {
        success: false,
        creditsGranted: 0,
        newBalance: account.totalBalance,
        reason: `免费用户积分持有上限为 ${FREE_USER_CREDIT_CAP}，当前余额 ${account.totalBalance}`,
      };
    }
    // 用 actualAmount 替代 amount 继续后续发放流程
  }
}
```

### Task 3.4：新增辅助方法

```typescript
/**
 * 判断用户是否为免费用户（无活跃付费订阅）
 */
private async isUserFree(userId: string): Promise<boolean> {
  // 需要引入订阅查询能力
  // 方案 A：直接查询 subscriptions 表
  // 方案 B：通过 subscription service 查询
  // 建议方案 B，保持解耦
  try {
    const { getUserSubscription, isSubscriptionActive } = await import(
      "../subscription/index.js"
    );
    const sub = await getUserSubscription(userId);
    return !sub || !isSubscriptionActive(sub);
  } catch {
    // 查询失败时保守处理：视为免费用户
    return true;
  }
}
```

### Task 3.5：测试用例

```typescript
describe("免费用户积分持有上限", () => {
  it("免费用户注册赠送 600 积分", async () => {
    const result = await service.grantRegistrationBonus(userId);
    expect(result.creditsGranted).toBe(600);
  });

  it("免费用户余额 2800 + 邀请 300 → 实际发放 200", async () => {
    // 预设余额 2800
    const result = await service.grantInviteReward(inviterId, inviteeId);
    expect(result.creditsGranted).toBe(200);
    expect(result.newBalance).toBe(3000);
  });

  it("免费用户余额 3000 → 邀请奖励被拒绝", async () => {
    // 预设余额 3000
    const result = await service.grantInviteReward(inviterId, inviteeId);
    expect(result.success).toBe(false);
    expect(result.reason).toContain("持有上限");
  });

  it("付费用户不受 3000 上限限制", async () => {
    // 预设用户有活跃订阅 + 余额 2800
    const result = await service.grantInviteReward(inviterId, inviteeId);
    expect(result.creditsGranted).toBe(300);
    expect(result.newBalance).toBe(3100);
  });
});
```

---

## Phase 4：首月优惠逻辑

### 变更文件

| 文件                                                | 变更             |
| --------------------------------------------------- | ---------------- |
| `apps/api-server/src/routes/subscriptions/index.ts` | 修改创建订阅路由 |

### Task 4.1：首月价格判断

在 `POST /api/subscriptions` 路由中（第 139-228 行），创建 monthly 订阅后，关联支付订单需要区分首月价格。

**判断逻辑**：

```typescript
// 在创建订阅路由中
if (body.planId === "monthly" || body.billingPeriod === "monthly") {
  // 查询用户是否曾有过 monthly 订阅（含已取消/过期的）
  const hasHistory = await hasMonthlySubscriptionHistory(user.userId);

  const price = hasHistory ? 3000 : 300; // 首月 3 元，非首月 30 元
  const isFirstMonth = !hasHistory;

  // 创建支付订单时使用 price
  // 创建订阅时设置 isFirstMonth
}
```

### Task 4.2：续费恢复正常价格

在续费逻辑中（可能在 auto-renewal 或手动续费路由中），确保：

```typescript
// 续费时
subscription.isFirstMonth = false;
// 续费订单金额 = 3000（30 元）
```

### Task 4.3：测试用例

```typescript
describe("月付首月优惠", () => {
  it("首次月付订阅金额为 300 分（3元）", async () => {
    /* ... */
  });
  it("续费月付订阅金额为 3000 分（30元）", async () => {
    /* ... */
  });
  it("取消后重新月付不享受首月优惠", async () => {
    /* ... */
  });
  it("年付订阅不受首月优惠影响", async () => {
    /* ... */
  });
});
```

---

## Phase 5：订阅权限控制

### 变更文件

| 文件                                                   | 变更              |
| ------------------------------------------------------ | ----------------- |
| `apps/api-server/src/routes/subscriptions/index.ts`    | 禁用取消/修改路由 |
| `src/gateway/server-methods/assistant-subscription.ts` | 禁用 RPC 方法     |

### Task 5.1：禁用用户端 REST API

**文件**：`apps/api-server/src/routes/subscriptions/index.ts`

#### 方案 A（推荐）：返回 403

```typescript
// POST /api/subscriptions/:id/cancel — 禁用
server.post("/api/subscriptions/:id/cancel", async (request, reply) => {
  return reply.code(403).send({
    success: false,
    error: "订阅取消请联系管理员",
    code: "ADMIN_ONLY",
  });
});

// PUT /api/subscriptions/:id — 禁用
server.put("/api/subscriptions/:id", async (request, reply) => {
  return reply.code(403).send({
    success: false,
    error: "订阅修改请联系管理员",
    code: "ADMIN_ONLY",
  });
});
```

#### 保留的路由

- `GET /api/subscriptions/overview` — 只读查看（保留）
- `POST /api/subscriptions` — 购买新订阅（保留，用户仍可购买）
- `POST /api/subscriptions/quota-check` — 配额检查（保留）

### Task 5.2：禁用 Gateway RPC 方法

**文件**：`src/gateway/server-methods/assistant-subscription.ts`

将以下方法的处理逻辑替换为返回错误：

```typescript
// assistant.subscription.cancel
// assistant.subscription.update
// 返回：{ success: false, error: "订阅修改和取消请联系管理员" }
```

### Task 5.3：确认管理员端正常

确认以下端点/方法未受影响：

- `POST /api/admin/subscriptions/:id/cancel` — `apps/api-server/src/routes/admin/subscriptions.ts`
- `POST /api/admin/subscriptions/:id/extend` — 同上
- `admin.subscriptions.cancel` — `src/gateway/server-methods/admin-subscriptions.ts`
- `admin.subscriptions.list` / `stats` / `getDetail` — 同上

### Task 5.4：测试用例

```typescript
describe("订阅权限控制", () => {
  it("用户端 POST /subscriptions/:id/cancel 返回 403", async () => {
    /* ... */
  });
  it("用户端 PUT /subscriptions/:id 返回 403", async () => {
    /* ... */
  });
  it("用户端 POST /subscriptions 仍可创建订阅", async () => {
    /* ... */
  });
  it("管理员端 POST /admin/subscriptions/:id/cancel 正常取消", async () => {
    /* ... */
  });
  it("管理员端 POST /admin/subscriptions/:id/extend 正常延长", async () => {
    /* ... */
  });
});
```

---

## 验证步骤（Phase 3-5 统一）

```bash
# 1. 编译检查
pnpm build

# 2. 运行测试
pnpm test

# 3. 手动 API 测试（如有开发环境）
# - 注册新用户验证赠送 600 积分
# - 尝试用户端取消订阅，应返回 403
# - 管理员端取消订阅，应成功
```
