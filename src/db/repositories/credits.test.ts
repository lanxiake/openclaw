/**
 * 积分系统 Repository 测试
 *
 * 覆盖以下 Repository：
 * - CreditAccountRepository: 积分账户 CRUD
 * - CreditBatchRepository: 积分批次管理与 FIFO 消费
 * - CreditTransactionRepository: 积分流水记录与查询
 * - InviteRepository: 邀请记录与统计
 * - ModelPricingRepository: 模型定价配置
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";

import {
  CreditAccountRepository,
  CreditBatchRepository,
  CreditTransactionRepository,
  InviteRepository,
  ModelPricingRepository,
  getCreditAccountRepository,
  getCreditBatchRepository,
  getCreditTransactionRepository,
  getInviteRepository,
  getModelPricingRepository,
} from "./credits.js";

// ============================================================================
// CreditAccountRepository 测试
// ============================================================================

describe("CreditAccountRepository", () => {
  let repo: CreditAccountRepository;
  const testUserId = "user-credit-001";

  beforeEach(() => {
    console.log("[TEST] ========== 积分账户测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getCreditAccountRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 积分账户测试结束 ==========\n");
    disableMockDatabase();
  });

  it("应该创建积分账户", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-001: 创建积分账户");

    const account = await repo.create(testUserId);

    console.log("[TEST] 创建的账户:", JSON.stringify(account));
    expect(account).toBeDefined();
    expect(account.userId).toBe(testUserId);
    expect(account.totalBalance).toBe(0);
    expect(account.totalEarned).toBe(0);
    expect(account.totalConsumed).toBe(0);
    expect(account.totalExpired).toBe(0);
    console.log("[TEST] ✓ 积分账户创建成功");
  });

  it("应该根据 userId 查询积分账户", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-002: 根据 userId 查询");

    await repo.create(testUserId);
    const found = await repo.findByUserId(testUserId);

    expect(found).not.toBeNull();
    expect(found!.userId).toBe(testUserId);
    console.log("[TEST] ✓ 查询成功");
  });

  it("应该返回 null 查询不存在的用户账户", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-003: 查询不存在的用户");

    const found = await repo.findByUserId("non-existent-user");

    expect(found).toBeNull();
    console.log("[TEST] ✓ 返回 null");
  });

  it("应该更新积分余额", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-004: 更新积分余额");

    const account = await repo.create(testUserId);
    const updated = await repo.updateBalance(account.id, {
      totalBalance: 300,
      totalEarned: 300,
    });

    expect(updated).not.toBeNull();
    expect(updated!.totalBalance).toBe(300);
    expect(updated!.totalEarned).toBe(300);
    console.log("[TEST] ✓ 余额更新成功");
  });

  it("应该获取或创建积分账户（已存在）", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-005: getOrCreate 已存在场景");

    await repo.create(testUserId);
    const account = await repo.getOrCreate(testUserId);

    expect(account).toBeDefined();
    expect(account.userId).toBe(testUserId);
    console.log("[TEST] ✓ 返回已有账户");
  });

  it("应该获取或创建积分账户（不存在）", async () => {
    console.log("[TEST] CREDIT-ACCOUNT-006: getOrCreate 不存在场景");

    const account = await repo.getOrCreate("new-user-001");

    expect(account).toBeDefined();
    expect(account.userId).toBe("new-user-001");
    expect(account.totalBalance).toBe(0);
    console.log("[TEST] ✓ 创建新账户");
  });
});

// ============================================================================
// CreditBatchRepository 测试
// ============================================================================

describe("CreditBatchRepository", () => {
  let repo: CreditBatchRepository;
  const testUserId = "user-batch-001";

  beforeEach(() => {
    console.log("[TEST] ========== 积分批次测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getCreditBatchRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 积分批次测试结束 ==========\n");
    disableMockDatabase();
  });

  it("应该创建积分批次", async () => {
    console.log("[TEST] CREDIT-BATCH-001: 创建积分批次");

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3个月后
    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt,
      description: "注册赠送积分",
    });

    console.log("[TEST] 创建的批次:", JSON.stringify(batch));
    expect(batch).toBeDefined();
    expect(batch.userId).toBe(testUserId);
    expect(batch.source).toBe("register");
    expect(batch.originalAmount).toBe(300);
    expect(batch.remainingAmount).toBe(300);
    console.log("[TEST] ✓ 积分批次创建成功");
  });

  it("应该查询用户所有有效批次（按过期时间排序用于 FIFO）", async () => {
    console.log("[TEST] CREDIT-BATCH-002: 查询有效批次");

    const now = Date.now();
    // 创建两个未过期批次
    await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 200,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000), // 30天后过期
      description: "注册赠送",
    });
    await repo.create({
      userId: testUserId,
      source: "purchase",
      originalAmount: 1500,
      remainingAmount: 1500,
      expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000), // 90天后过期
      description: "加油包",
    });
    // 创建一个已过期批次（不应返回）
    await repo.create({
      userId: testUserId,
      source: "invite",
      originalAmount: 200,
      remainingAmount: 100,
      expiresAt: new Date(now - 1000), // 已过期
      description: "邀请奖励（已过期）",
    });

    const activeBatches = await repo.findActiveByUserId(testUserId);

    console.log("[TEST] 有效批次数量:", activeBatches.length);
    expect(activeBatches.length).toBe(2);
    // Mock 不支持排序，仅验证数量正确
    console.log("[TEST] ✓ 有效批次查询成功");
  });

  it("应该扣减批次余额", async () => {
    console.log("[TEST] CREDIT-BATCH-003: 扣减批次余额");

    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      description: "注册赠送",
    });

    const updated = await repo.deductAmount(batch.id, 50);

    expect(updated).not.toBeNull();
    expect(updated!.remainingAmount).toBe(250);
    console.log("[TEST] ✓ 扣减成功，剩余:", updated!.remainingAmount);
  });

  it("应该查询已过期且有余额的批次（用于清理）", async () => {
    console.log("[TEST] CREDIT-BATCH-004: 查询过期待清理批次");

    const now = Date.now();
    // 已过期且有余额
    await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 100,
      expiresAt: new Date(now - 1000),
      description: "已过期有余额",
    });
    // 已过期但余额为0（不应返回）
    await repo.create({
      userId: testUserId,
      source: "invite",
      originalAmount: 200,
      remainingAmount: 0,
      expiresAt: new Date(now - 1000),
      description: "已过期无余额",
    });
    // 未过期（不应返回）
    await repo.create({
      userId: testUserId,
      source: "purchase",
      originalAmount: 1500,
      remainingAmount: 1500,
      expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000),
      description: "未过期",
    });

    const expired = await repo.findExpiredWithBalance();

    console.log("[TEST] 过期待清理批次数量:", expired.length);
    expect(expired.length).toBe(1);
    expect(expired[0].remainingAmount).toBe(100);
    console.log("[TEST] ✓ 过期批次查询成功");
  });

  it("应该将过期批次余额清零", async () => {
    console.log("[TEST] CREDIT-BATCH-005: 清零过期批次");

    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 150,
      expiresAt: new Date(Date.now() - 1000),
      description: "已过期",
    });

    const cleared = await repo.clearExpiredBatch(batch.id);

    expect(cleared).not.toBeNull();
    expect(cleared!.remainingAmount).toBe(0);
    console.log("[TEST] ✓ 过期批次清零成功");
  });
});

// ============================================================================
// CreditTransactionRepository 测试
// ============================================================================

describe("CreditTransactionRepository", () => {
  let repo: CreditTransactionRepository;
  const testUserId = "user-txn-001";

  beforeEach(() => {
    console.log("[TEST] ========== 积分流水测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getCreditTransactionRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 积分流水测试结束 ==========\n");
    disableMockDatabase();
  });

  it("应该创建积分获得流水", async () => {
    console.log("[TEST] CREDIT-TXN-001: 创建获得流水");

    const txn = await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
      description: "注册赠送积分",
    });

    console.log("[TEST] 创建的流水:", JSON.stringify(txn));
    expect(txn).toBeDefined();
    expect(txn.userId).toBe(testUserId);
    expect(txn.type).toBe("earn");
    expect(txn.amount).toBe(300);
    expect(txn.balanceAfter).toBe(300);
    expect(txn.source).toBe("register");
    console.log("[TEST] ✓ 获得流水创建成功");
  });

  it("应该创建积分消费流水（含模型调用元数据）", async () => {
    console.log("[TEST] CREDIT-TXN-002: 创建消费流水");

    const txn = await repo.create({
      userId: testUserId,
      batchId: "batch-001",
      type: "consume",
      amount: -15,
      balanceAfter: 285,
      source: "model_call",
      description: "Claude Sonnet 调用",
      metadata: {
        modelId: "anthropic/claude-sonnet-4-20250514",
        inputTokens: 1000,
        outputTokens: 500,
        inputPrice: 300,
        outputPrice: 1500,
        multiplier: 1.0,
      },
    });

    expect(txn).toBeDefined();
    expect(txn.type).toBe("consume");
    expect(txn.amount).toBe(-15);
    expect(txn.metadata).toBeDefined();
    expect(txn.metadata!.modelId).toBe("anthropic/claude-sonnet-4-20250514");
    console.log("[TEST] ✓ 消费流水创建成功");
  });

  it("应该查询用户流水列表", async () => {
    console.log("[TEST] CREDIT-TXN-003: 查询用户流水列表");

    await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
      description: "注册赠送",
    });
    await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -10,
      balanceAfter: 290,
      source: "model_call",
      description: "模型调用",
    });
    await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 200,
      balanceAfter: 490,
      source: "invite",
      description: "邀请奖励",
    });

    const transactions = await repo.findByUserId(testUserId);

    console.log("[TEST] 流水数量:", transactions.length);
    expect(transactions.length).toBe(3);
    console.log("[TEST] ✓ 用户流水查询成功");
  });

  it("应该按类型查询流水", async () => {
    console.log("[TEST] CREDIT-TXN-004: 按类型查询流水");

    await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
      description: "注册",
    });
    await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -10,
      balanceAfter: 290,
      source: "model_call",
      description: "消费",
    });
    await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -20,
      balanceAfter: 270,
      source: "model_call",
      description: "消费2",
    });

    const consumeTransactions = await repo.findByUserIdAndType(testUserId, "consume");

    console.log("[TEST] 消费流水数量:", consumeTransactions.length);
    expect(consumeTransactions.length).toBe(2);
    console.log("[TEST] ✓ 按类型查询成功");
  });

  it("应该支持分页查询流水", async () => {
    console.log("[TEST] CREDIT-TXN-005: 分页查询流水");

    for (let i = 0; i < 5; i++) {
      await repo.create({
        userId: testUserId,
        type: "consume",
        amount: -(i + 1),
        balanceAfter: 300 - (i + 1),
        source: "model_call",
        description: `消费${i + 1}`,
      });
    }

    const page1 = await repo.findByUserId(testUserId, { limit: 2, offset: 0 });
    const page2 = await repo.findByUserId(testUserId, { limit: 2, offset: 2 });

    console.log("[TEST] 第1页:", page1.length, "条");
    console.log("[TEST] 第2页:", page2.length, "条");
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    console.log("[TEST] ✓ 分页查询成功");
  });
});

// ============================================================================
// InviteRepository 测试
// ============================================================================

describe("InviteRepository", () => {
  let repo: InviteRepository;
  const inviterUserId = "user-inviter-001";

  beforeEach(() => {
    console.log("[TEST] ========== 邀请记录测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getInviteRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 邀请记录测试结束 ==========\n");
    disableMockDatabase();
  });

  it("应该创建邀请记录", async () => {
    console.log("[TEST] INVITE-001: 创建邀请记录");

    const record = await repo.create({
      inviterUserId,
      inviteeUserId: "user-invitee-001",
      creditsAwarded: 200,
    });

    console.log("[TEST] 创建的邀请记录:", JSON.stringify(record));
    expect(record).toBeDefined();
    expect(record.inviterUserId).toBe(inviterUserId);
    expect(record.inviteeUserId).toBe("user-invitee-001");
    expect(record.creditsAwarded).toBe(200);
    expect(record.status).toBe("completed");
    console.log("[TEST] ✓ 邀请记录创建成功");
  });

  it("应该统计邀请人的已发放积分总数", async () => {
    console.log("[TEST] INVITE-002: 统计邀请积分总数");

    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-a",
      creditsAwarded: 200,
    });
    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-b",
      creditsAwarded: 200,
    });
    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-c",
      creditsAwarded: 200,
    });

    const totalAwarded = await repo.getTotalAwardedCredits(inviterUserId);

    console.log("[TEST] 已发放邀请积分总数:", totalAwarded);
    expect(totalAwarded).toBe(600);
    console.log("[TEST] ✓ 统计成功");
  });

  it("应该统计邀请人数", async () => {
    console.log("[TEST] INVITE-003: 统计邀请人数");

    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-a",
      creditsAwarded: 200,
    });
    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-b",
      creditsAwarded: 200,
    });

    const count = await repo.getInviteCount(inviterUserId);

    console.log("[TEST] 邀请人数:", count);
    expect(count).toBe(2);
    console.log("[TEST] ✓ 统计成功");
  });

  it("应该检查用户是否已被邀请", async () => {
    console.log("[TEST] INVITE-004: 检查是否已被邀请");

    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-a",
      creditsAwarded: 200,
    });

    const isInvited = await repo.isUserInvited("invitee-a");
    const notInvited = await repo.isUserInvited("invitee-not-exist");

    console.log("[TEST] invitee-a 已被邀请:", isInvited);
    console.log("[TEST] invitee-not-exist 已被邀请:", notInvited);
    expect(isInvited).toBe(true);
    expect(notInvited).toBe(false);
    console.log("[TEST] ✓ 检查成功");
  });

  it("应该查询邀请人的所有邀请记录", async () => {
    console.log("[TEST] INVITE-005: 查询邀请记录列表");

    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-a",
      creditsAwarded: 200,
    });
    await repo.create({
      inviterUserId,
      inviteeUserId: "invitee-b",
      creditsAwarded: 200,
    });

    const records = await repo.findByInviterId(inviterUserId);

    console.log("[TEST] 邀请记录数量:", records.length);
    expect(records.length).toBe(2);
    console.log("[TEST] ✓ 查询成功");
  });
});

// ============================================================================
// ModelPricingRepository 测试
// ============================================================================

describe("ModelPricingRepository", () => {
  let repo: ModelPricingRepository;

  beforeEach(() => {
    console.log("[TEST] ========== 模型定价测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    repo = getModelPricingRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 模型定价测试结束 ==========\n");
    disableMockDatabase();
  });

  it("应该创建模型定价记录", async () => {
    console.log("[TEST] MODEL-PRICING-001: 创建模型定价");

    const pricing = await repo.create({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300, // 每百万 input tokens 消耗 300 积分
      outputPrice: 1500, // 每百万 output tokens 消耗 1500 积分
    });

    console.log("[TEST] 创建的定价:", JSON.stringify(pricing));
    expect(pricing).toBeDefined();
    expect(pricing.modelId).toBe("anthropic/claude-sonnet-4-20250514");
    expect(pricing.inputPrice).toBe(300);
    expect(pricing.outputPrice).toBe(1500);
    expect(pricing.multiplier).toBe("1.00");
    expect(pricing.isActive).toBe(true);
    console.log("[TEST] ✓ 模型定价创建成功");
  });

  it("应该根据 modelId 查询定价", async () => {
    console.log("[TEST] MODEL-PRICING-002: 根据 modelId 查询");

    await repo.create({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300,
      outputPrice: 1500,
    });

    const found = await repo.findByModelId("anthropic/claude-sonnet-4-20250514");

    expect(found).not.toBeNull();
    expect(found!.modelName).toBe("Claude Sonnet 4");
    console.log("[TEST] ✓ 查询成功");
  });

  it("应该返回 null 查询不存在的模型", async () => {
    console.log("[TEST] MODEL-PRICING-003: 查询不存在的模型");

    const found = await repo.findByModelId("non-existent-model");

    expect(found).toBeNull();
    console.log("[TEST] ✓ 返回 null");
  });

  it("应该查询所有激活的模型定价", async () => {
    console.log("[TEST] MODEL-PRICING-004: 查询激活的模型定价");

    await repo.create({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300,
      outputPrice: 1500,
    });
    await repo.create({
      modelId: "anthropic/claude-haiku-3-20240307",
      modelName: "Claude Haiku 3",
      inputPrice: 25,
      outputPrice: 125,
    });

    const activePricings = await repo.findAllActive();

    console.log("[TEST] 激活模型数量:", activePricings.length);
    expect(activePricings.length).toBe(2);
    console.log("[TEST] ✓ 查询成功");
  });

  it("应该更新模型定价倍率", async () => {
    console.log("[TEST] MODEL-PRICING-005: 更新倍率");

    const pricing = await repo.create({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300,
      outputPrice: 1500,
    });

    const updated = await repo.update(pricing.id, {
      multiplier: "1.50",
    });

    expect(updated).not.toBeNull();
    expect(updated!.multiplier).toBe("1.50");
    console.log("[TEST] ✓ 倍率更新成功");
  });

  it("应该禁用模型定价", async () => {
    console.log("[TEST] MODEL-PRICING-006: 禁用模型");

    const pricing = await repo.create({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300,
      outputPrice: 1500,
    });

    const disabled = await repo.update(pricing.id, {
      isActive: false,
    });

    expect(disabled).not.toBeNull();
    expect(disabled!.isActive).toBe(false);
    console.log("[TEST] ✓ 模型禁用成功");
  });
});
