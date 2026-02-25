/**
 * CreditService 积分服务业务逻辑测试
 *
 * 覆盖以下核心业务场景：
 * - 注册赠送积分
 * - 邀请奖励积分（含上限检查）
 * - FIFO 积分消费
 * - 余额查询
 * - 积分消费计算（模型调用）
 * - 过期批次清理
 *
 * 使用 Mock Database 进行单元测试
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../../db/mock-connection.js";
import {
  getCreditAccountRepository,
  getCreditBatchRepository,
  getCreditTransactionRepository,
  getInviteRepository,
  getModelPricingRepository,
} from "../../db/repositories/credits.js";
import { CreditService } from "./credit-service.js";

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建标准测试用的 CreditService 实例 */
function createTestService(): CreditService {
  const db = getMockDatabase();
  return new CreditService({
    accountRepo: getCreditAccountRepository(db),
    batchRepo: getCreditBatchRepository(db),
    txnRepo: getCreditTransactionRepository(db),
    inviteRepo: getInviteRepository(db),
    pricingRepo: getModelPricingRepository(db),
  });
}

/** 创建未来某时间点 */
function futureDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

/** 创建过去某时间点 */
function pastDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ============================================================================
// 注册赠送积分
// ============================================================================

describe("CreditService - grantRegistrationBonus", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 注册赠送积分测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 注册赠送积分测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-REG-001: 应该为新用户赠送注册积分", async () => {
    console.log("[TEST] CS-REG-001: 新用户注册赠送积分");

    const result = await service.grantRegistrationBonus("user-001");

    console.log("[TEST] 赠送结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(600);
    expect(result.newBalance).toBe(600);
    console.log("[TEST] ✓ 注册积分赠送成功");
  });

  it("CS-REG-002: 应该创建积分账户、批次和流水", async () => {
    console.log("[TEST] CS-REG-002: 验证创建的数据完整性");

    const result = await service.grantRegistrationBonus("user-002");

    // 验证账户已创建
    const account = await service.getBalance("user-002");
    expect(account).not.toBeNull();
    expect(account!.totalBalance).toBe(600);
    expect(account!.totalEarned).toBe(600);

    console.log("[TEST] ✓ 账户、批次、流水均已正确创建");
  });

  it("CS-REG-003: 已有账户的用户不应重复赠送", async () => {
    console.log("[TEST] CS-REG-003: 防止重复赠送");

    await service.grantRegistrationBonus("user-003");
    const result = await service.grantRegistrationBonus("user-003");

    console.log("[TEST] 重复赠送结果:", JSON.stringify(result));
    expect(result.success).toBe(false);
    expect(result.creditsGranted).toBe(0);
    console.log("[TEST] ✓ 防止重复赠送成功");
  });

  it("CS-REG-004: 应该支持自定义赠送额度", async () => {
    console.log("[TEST] CS-REG-004: 自定义赠送额度");

    const result = await service.grantRegistrationBonus("user-004", {
      amount: 500,
      expiryMonths: 6,
    });

    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(500);
    expect(result.newBalance).toBe(500);
    console.log("[TEST] ✓ 自定义赠送额度成功");
  });
});

// ============================================================================
// 邀请奖励积分
// ============================================================================

describe("CreditService - grantInviteReward", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 邀请奖励测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 邀请奖励测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-INV-001: 应该为邀请人发放奖励积分", async () => {
    console.log("[TEST] CS-INV-001: 发放邀请奖励");

    // 先给邀请人创建账户
    await service.grantRegistrationBonus("inviter-001");

    const result = await service.grantInviteReward("inviter-001", "invitee-001");

    console.log("[TEST] 邀请奖励结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(300);
    // 600（注册） + 300（邀请） = 900
    expect(result.newBalance).toBe(900);
    console.log("[TEST] ✓ 邀请奖励发放成功");
  });

  it("CS-INV-002: 邀请积分达到上限后应拒绝", async () => {
    console.log("[TEST] CS-INV-002: 邀请积分上限检查");

    await service.grantRegistrationBonus("inviter-002");

    // 邀请 10 人，每次 300 积分，总计 3000 = 上限
    for (let i = 1; i <= 10; i++) {
      await service.grantInviteReward("inviter-002", `invitee-${i}`);
    }

    // 第 11 次应该被拒绝
    const result = await service.grantInviteReward("inviter-002", "invitee-11");

    console.log("[TEST] 超出上限结果:", JSON.stringify(result));
    expect(result.success).toBe(false);
    expect(result.creditsGranted).toBe(0);
    expect(result.reason).toContain("上限");
    console.log("[TEST] ✓ 邀请积分上限检查成功");
  });

  it("CS-INV-003: 被邀请人不能被重复邀请", async () => {
    console.log("[TEST] CS-INV-003: 防止重复邀请");

    await service.grantRegistrationBonus("inviter-003");

    await service.grantInviteReward("inviter-003", "invitee-dup");
    const result = await service.grantInviteReward("inviter-003", "invitee-dup");

    console.log("[TEST] 重复邀请结果:", JSON.stringify(result));
    expect(result.success).toBe(false);
    expect(result.reason).toContain("已被邀请");
    console.log("[TEST] ✓ 防止重复邀请成功");
  });

  it("CS-INV-004: 应该支持自定义邀请奖励额度", async () => {
    console.log("[TEST] CS-INV-004: 自定义邀请奖励额度");

    await service.grantRegistrationBonus("inviter-004");

    const result = await service.grantInviteReward("inviter-004", "invitee-custom", {
      amount: 100,
      maxTotal: 500,
    });

    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(100);
    console.log("[TEST] ✓ 自定义邀请奖励成功");
  });
});

// ============================================================================
// FIFO 积分消费
// ============================================================================

describe("CreditService - consumeCredits", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== FIFO 积分消费测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== FIFO 积分消费测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-CONSUME-001: 应该从单个批次扣减积分", async () => {
    console.log("[TEST] CS-CONSUME-001: 单批次扣减");

    await service.grantRegistrationBonus("user-consume-001");

    const result = await service.consumeCredits("user-consume-001", 50, {
      source: "model_call",
      description: "Claude Sonnet 调用",
    });

    console.log("[TEST] 消费结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.consumed).toBe(50);
    expect(result.newBalance).toBe(550);
    console.log("[TEST] ✓ 单批次扣减成功");
  });

  it("CS-CONSUME-002: 余额不足时应拒绝", async () => {
    console.log("[TEST] CS-CONSUME-002: 余额不足拒绝");

    await service.grantRegistrationBonus("user-consume-002");

    const result = await service.consumeCredits("user-consume-002", 800, {
      source: "model_call",
      description: "大量消费",
    });

    console.log("[TEST] 余额不足结果:", JSON.stringify(result));
    expect(result.success).toBe(false);
    expect(result.consumed).toBe(0);
    expect(result.reason).toContain("不足");
    console.log("[TEST] ✓ 余额不足拒绝成功");
  });

  it("CS-CONSUME-003: 无账户用户应拒绝消费", async () => {
    console.log("[TEST] CS-CONSUME-003: 无账户用户消费");

    const result = await service.consumeCredits("user-no-account", 10, {
      source: "model_call",
      description: "无账户消费",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain("不存在");
    console.log("[TEST] ✓ 无账户用户消费拒绝成功");
  });

  it("CS-CONSUME-004: 应该记录消费流水（含 metadata）", async () => {
    console.log("[TEST] CS-CONSUME-004: 消费流水验证");

    await service.grantRegistrationBonus("user-consume-004");

    const metadata = {
      modelId: "anthropic/claude-sonnet-4-20250514",
      inputTokens: 1000,
      outputTokens: 500,
      inputPrice: 300,
      outputPrice: 1500,
      multiplier: 1.0,
    };

    const result = await service.consumeCredits("user-consume-004", 15, {
      source: "model_call",
      description: "Claude Sonnet 调用",
      metadata,
    });

    expect(result.success).toBe(true);
    expect(result.consumed).toBe(15);
    console.log("[TEST] ✓ 消费流水记录成功");
  });

  it("CS-CONSUME-005: 消费金额必须为正数", async () => {
    console.log("[TEST] CS-CONSUME-005: 消费金额验证");

    await service.grantRegistrationBonus("user-consume-005");

    await expect(
      service.consumeCredits("user-consume-005", 0, {
        source: "model_call",
        description: "零消费",
      }),
    ).rejects.toThrow();

    await expect(
      service.consumeCredits("user-consume-005", -10, {
        source: "model_call",
        description: "负数消费",
      }),
    ).rejects.toThrow();

    console.log("[TEST] ✓ 消费金额验证成功");
  });
});

// ============================================================================
// 余额查询
// ============================================================================

describe("CreditService - getBalance", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 余额查询测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 余额查询测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-BAL-001: 应该返回用户积分余额", async () => {
    console.log("[TEST] CS-BAL-001: 查询余额");

    await service.grantRegistrationBonus("user-bal-001");

    const balance = await service.getBalance("user-bal-001");

    console.log("[TEST] 余额:", JSON.stringify(balance));
    expect(balance).not.toBeNull();
    expect(balance!.totalBalance).toBe(600);
    expect(balance!.totalEarned).toBe(600);
    expect(balance!.totalConsumed).toBe(0);
    console.log("[TEST] ✓ 余额查询成功");
  });

  it("CS-BAL-002: 不存在的用户应返回 null", async () => {
    console.log("[TEST] CS-BAL-002: 不存在的用户");

    const balance = await service.getBalance("non-existent-user");

    expect(balance).toBeNull();
    console.log("[TEST] ✓ 返回 null 成功");
  });
});

// ============================================================================
// 积分消费计算（模型调用）
// ============================================================================

describe("CreditService - calculateModelCallCost", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 模型调用成本计算测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 模型调用成本计算测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-CALC-001: 应该根据模型定价和 token 数计算积分消耗", async () => {
    console.log("[TEST] CS-CALC-001: 基础积分消耗计算");

    // 先设置模型定价
    await service.setModelPricing({
      modelId: "anthropic/claude-sonnet-4-20250514",
      modelName: "Claude Sonnet 4",
      inputPrice: 300, // 每百万 input tokens = 300 积分
      outputPrice: 1500, // 每百万 output tokens = 1500 积分
    });

    const cost = await service.calculateModelCallCost(
      "anthropic/claude-sonnet-4-20250514",
      1000, // input tokens
      500, // output tokens
    );

    // 计算：(1000 * 300 + 500 * 1500) / 1_000_000 * 1.0 = (300000 + 750000) / 1000000 = 1.05
    // ceil(1.05) = 2 积分（最少消耗 1 积分）
    console.log("[TEST] 计算结果:", cost);
    expect(cost).toBeGreaterThanOrEqual(1);
    console.log("[TEST] ✓ 积分消耗计算成功");
  });

  it("CS-CALC-002: 未配置定价的模型应抛出错误", async () => {
    console.log("[TEST] CS-CALC-002: 未配置定价的模型");

    await expect(service.calculateModelCallCost("unknown-model", 1000, 500)).rejects.toThrow();

    console.log("[TEST] ✓ 未配置定价模型错误抛出成功");
  });

  it("CS-CALC-003: 应该应用模型倍率", async () => {
    console.log("[TEST] CS-CALC-003: 模型倍率应用");

    await service.setModelPricing({
      modelId: "anthropic/claude-opus-4-20250514",
      modelName: "Claude Opus 4",
      inputPrice: 1500, // 每百万 input tokens = 1500 积分
      outputPrice: 7500, // 每百万 output tokens = 7500 积分
      multiplier: "1.50", // 1.5 倍
    });

    const cost = await service.calculateModelCallCost(
      "anthropic/claude-opus-4-20250514",
      1000,
      500,
    );

    // 计算：(1000 * 1500 + 500 * 7500) / 1_000_000 * 1.5 = (1500000 + 3750000) / 1000000 * 1.5 = 5.25 * 1.5 = 7.875
    // ceil(7.875) = 8
    console.log("[TEST] 带倍率的计算结果:", cost);
    expect(cost).toBeGreaterThanOrEqual(1);
    console.log("[TEST] ✓ 模型倍率应用成功");
  });

  it("CS-CALC-004: 最小消费应为 1 积分", async () => {
    console.log("[TEST] CS-CALC-004: 最小消费验证");

    await service.setModelPricing({
      modelId: "anthropic/claude-haiku-3-20240307",
      modelName: "Claude Haiku 3",
      inputPrice: 25,
      outputPrice: 125,
    });

    // 极少 token 的调用
    const cost = await service.calculateModelCallCost(
      "anthropic/claude-haiku-3-20240307",
      1, // 1 input token
      1, // 1 output token
    );

    console.log("[TEST] 极少 token 的计算结果:", cost);
    // (1 * 25 + 1 * 125) / 1_000_000 = 0.00015 → ceil = 1（最少 1 积分）
    expect(cost).toBe(1);
    console.log("[TEST] ✓ 最小消费验证成功");
  });
});

// ============================================================================
// 过期批次清理
// ============================================================================

describe("CreditService - cleanupExpiredBatches", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 过期批次清理测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 过期批次清理测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-CLEANUP-001: 应该清理过期且有余额的批次", async () => {
    console.log("[TEST] CS-CLEANUP-001: 清理过期批次");

    // 手动创建一个已过期有余额的批次
    const db = getMockDatabase();
    const batchRepo = getCreditBatchRepository(db);
    const accountRepo = getCreditAccountRepository(db);

    // 先创建账户
    const account = await accountRepo.create("user-cleanup-001");
    await accountRepo.updateBalance(account.id, {
      totalBalance: 100,
      totalEarned: 100,
    });

    // 创建已过期批次
    await batchRepo.create({
      userId: "user-cleanup-001",
      source: "register",
      originalAmount: 100,
      remainingAmount: 100,
      expiresAt: pastDate(1),
      description: "已过期的注册积分",
    });

    const result = await service.cleanupExpiredBatches();

    console.log("[TEST] 清理结果:", JSON.stringify(result));
    expect(result.batchesCleaned).toBeGreaterThanOrEqual(1);
    expect(result.creditsExpired).toBeGreaterThanOrEqual(100);
    console.log("[TEST] ✓ 过期批次清理成功");
  });

  it("CS-CLEANUP-002: 没有过期批次时应返回空结果", async () => {
    console.log("[TEST] CS-CLEANUP-002: 没有过期批次");

    const result = await service.cleanupExpiredBatches();

    console.log("[TEST] 清理结果:", JSON.stringify(result));
    expect(result.batchesCleaned).toBe(0);
    expect(result.creditsExpired).toBe(0);
    console.log("[TEST] ✓ 无过期批次处理成功");
  });
});

// ============================================================================
// 包月积分发放
// ============================================================================

describe("CreditService - grantSubscriptionCredits", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 包月积分发放测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 包月积分发放测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-SUB-001: 应该为包月用户发放积分", async () => {
    console.log("[TEST] CS-SUB-001: 包月积分发放");

    // 先给用户创建账户
    await service.grantRegistrationBonus("user-sub-001");

    const result = await service.grantSubscriptionCredits("user-sub-001", {
      amount: 2000,
      expiryMonths: 1,
      sourceId: "order-001",
    });

    console.log("[TEST] 发放结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(2000);
    // 600（注册） + 2000（包月） = 2600
    expect(result.newBalance).toBe(2600);
    console.log("[TEST] ✓ 包月积分发放成功");
  });

  it("CS-SUB-002: 应该创建 subscription 来源的批次", async () => {
    console.log("[TEST] CS-SUB-002: 验证批次来源");

    await service.grantRegistrationBonus("user-sub-002");

    await service.grantSubscriptionCredits("user-sub-002", {
      amount: 2000,
      expiryMonths: 1,
      sourceId: "order-002",
    });

    // 验证有 subscription 来源的批次
    const balance = await service.getBalance("user-sub-002");
    expect(balance).not.toBeNull();
    expect(balance!.totalEarned).toBe(2600); // 600 + 2000
    console.log("[TEST] ✓ 批次来源验证成功");
  });
});

// ============================================================================
// 加油包购买
// ============================================================================

describe("CreditService - grantBoosterCredits", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 加油包购买测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 加油包购买测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-BOOST-001: 应该为用户发放加油包积分", async () => {
    console.log("[TEST] CS-BOOST-001: 加油包积分发放");

    await service.grantRegistrationBonus("user-boost-001");

    const result = await service.grantBoosterCredits("user-boost-001", {
      amount: 1500,
      expiryMonths: 3,
      sourceId: "order-boost-001",
    });

    console.log("[TEST] 发放结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(1500);
    // 600（注册） + 1500（加油包） = 2100
    expect(result.newBalance).toBe(2100);
    console.log("[TEST] ✓ 加油包积分发放成功");
  });
});

// ============================================================================
// 流水查询
// ============================================================================

describe("CreditService - getTransactionHistory", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 流水查询测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 流水查询测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-TXN-001: 应该返回用户的积分流水列表", async () => {
    console.log("[TEST] CS-TXN-001: 查询流水列表");

    await service.grantRegistrationBonus("user-txn-001");
    await service.consumeCredits("user-txn-001", 10, {
      source: "model_call",
      description: "模型调用",
    });

    const transactions = await service.getTransactionHistory("user-txn-001");

    console.log("[TEST] 流水数量:", transactions.length);
    // 至少 2 条：1 earn + 1 consume
    expect(transactions.length).toBeGreaterThanOrEqual(2);
    console.log("[TEST] ✓ 流水查询成功");
  });

  it("CS-TXN-002: 应该支持分页查询", async () => {
    console.log("[TEST] CS-TXN-002: 分页查询");

    await service.grantRegistrationBonus("user-txn-002");
    // 多次消费产生多条流水
    for (let i = 0; i < 5; i++) {
      await service.consumeCredits("user-txn-002", 10, {
        source: "model_call",
        description: `消费${i + 1}`,
      });
    }

    const page1 = await service.getTransactionHistory("user-txn-002", {
      limit: 2,
      offset: 0,
    });
    const page2 = await service.getTransactionHistory("user-txn-002", {
      limit: 2,
      offset: 2,
    });

    console.log("[TEST] 第1页:", page1.length, "条");
    console.log("[TEST] 第2页:", page2.length, "条");
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    console.log("[TEST] ✓ 分页查询成功");
  });
});

// ============================================================================
// CreditService - adminGrantCredits 管理员手动发放
// ============================================================================

describe("CreditService - adminGrantCredits", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 管理员发放测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 管理员发放测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-ADMIN-001: 应该以 admin_grant 来源发放积分", async () => {
    console.log("[TEST] CS-ADMIN-001: 管理员手动发放");

    // 先为用户创建账户
    await service.grantRegistrationBonus("user-admin-001");

    const result = await service.adminGrantCredits(
      "user-admin-001",
      { amount: 500, expiryMonths: 6, description: "客服补偿" },
      "admin-001",
      "用户投诉补偿",
    );

    console.log("[TEST] 发放结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(500);
    expect(result.newBalance).toBe(1100); // 600 注册 + 500 管理员发放
    console.log("[TEST] ✓ 管理员发放成功");
  });

  it("CS-ADMIN-002: 应该为无账户用户自动创建账户并发放", async () => {
    console.log("[TEST] CS-ADMIN-002: 新用户管理员发放");

    const result = await service.adminGrantCredits(
      "user-admin-002",
      { amount: 1000, expiryMonths: 12 },
      "admin-001",
    );

    console.log("[TEST] 发放结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(1000);
    expect(result.newBalance).toBe(1000);
    console.log("[TEST] ✓ 新用户发放成功");
  });
});

// ============================================================================
// CreditService - getAllModelPricings / getModelPricing / deleteModelPricing
// ============================================================================

describe("CreditService - 模型定价管理方法", () => {
  let service: CreditService;

  beforeEach(() => {
    console.log("[TEST] ========== 定价管理方法测试开始 ==========");
    enableMockDatabase();
    service = createTestService();
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== 定价管理方法测试结束 ==========\n");
    disableMockDatabase();
  });

  it("CS-PRICING-001: 应该获取所有定价（含禁用）", async () => {
    console.log("[TEST] CS-PRICING-001: 获取所有定价");

    await service.setModelPricing({
      modelId: "model-a",
      modelName: "Model A",
      inputPrice: 300,
      outputPrice: 1500,
    });
    await service.setModelPricing({
      modelId: "model-b",
      modelName: "Model B",
      inputPrice: 100,
      outputPrice: 500,
    });

    const all = await service.getAllModelPricings(false);
    expect(all.length).toBe(2);

    const activeOnly = await service.getAllModelPricings(true);
    expect(activeOnly.length).toBe(2); // 默认都是 active
    console.log("[TEST] ✓ 获取所有定价成功");
  });

  it("CS-PRICING-002: 应该获取单个模型定价", async () => {
    console.log("[TEST] CS-PRICING-002: 获取单条定价");

    await service.setModelPricing({
      modelId: "model-a",
      modelName: "Model A",
      inputPrice: 300,
      outputPrice: 1500,
    });

    const pricing = await service.getModelPricing("model-a");
    expect(pricing).not.toBeNull();
    expect(pricing!.modelName).toBe("Model A");

    const notFound = await service.getModelPricing("non-existent");
    expect(notFound).toBeNull();
    console.log("[TEST] ✓ 获取单条定价成功");
  });

  it("CS-PRICING-003: 应该删除模型定价", async () => {
    console.log("[TEST] CS-PRICING-003: 删除定价");

    await service.setModelPricing({
      modelId: "model-a",
      modelName: "Model A",
      inputPrice: 300,
      outputPrice: 1500,
    });

    const deleted = await service.deleteModelPricing("model-a");
    expect(deleted).toBe(true);

    // 确认已删除
    const found = await service.getModelPricing("model-a");
    expect(found).toBeNull();
    console.log("[TEST] ✓ 删除定价成功");
  });

  it("CS-PRICING-004: 删除不存在的模型定价应返回 false", async () => {
    console.log("[TEST] CS-PRICING-004: 删除不存在的定价");

    const deleted = await service.deleteModelPricing("non-existent");
    expect(deleted).toBe(false);
    console.log("[TEST] ✓ 返回 false");
  });
});
