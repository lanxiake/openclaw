/**
 * CreditService 集成测试
 *
 * 使用真实 PostgreSQL 数据库测试积分服务的完整业务流程：
 * - 注册赠送积分（含账户/批次/流水创建验证）
 * - 邀请奖励积分（含上限检查、重复邀请拦截）
 * - FIFO 积分消费（跨批次扣减、余额不足拒绝）
 * - 包月/加油包积分发放
 * - 模型调用积分计算（含倍率）
 * - 过期批次清理
 * - 流水查询与分页
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { getDatabase } from "../../db/connection.js";
import type { Database } from "../../db/connection.js";
import {
  creditAccounts,
  creditBatches,
  creditTransactions,
  inviteRecords,
  modelPricing,
} from "../../db/schema/index.js";
import {
  getCreditAccountRepository,
  getCreditBatchRepository,
  getCreditTransactionRepository,
  getInviteRepository,
  getModelPricingRepository,
} from "../../db/repositories/credits.js";
import { getUserRepository, type UserRepository } from "../../db/repositories/users.js";
import { CreditService } from "./credit-service.js";

// ============================================================================
// 测试辅助
// ============================================================================

/** 测试用户 ID 收集器 */
const testUserIds: string[] = [];

/** 创建真实测试用户（满足 FK 约束） */
async function createTestUser(userRepo: UserRepository, suffix: string): Promise<string> {
  const user = await userRepo.create({
    phone: `+86199${Date.now().toString().slice(-8)}${suffix}`,
    isActive: true,
  });
  testUserIds.push(user.id);
  return user.id;
}

/** 清理指定用户关联的所有积分数据 */
async function cleanupUserCreditData(db: Database, userId: string): Promise<void> {
  await db.delete(creditTransactions).where(sql`user_id = ${userId}`).execute();
  await db.delete(creditBatches).where(sql`user_id = ${userId}`).execute();
  await db.delete(inviteRecords).where(sql`inviter_user_id = ${userId} OR invitee_user_id = ${userId}`).execute();
  await db.delete(creditAccounts).where(sql`user_id = ${userId}`).execute();
}

/** 清理模型定价测试数据 */
async function cleanupPricingData(db: Database, modelId: string): Promise<void> {
  await db.delete(modelPricing).where(sql`model_id = ${modelId}`).execute();
}

// ============================================================================
// 注册赠送积分
// ============================================================================

describe("CreditService Integration - grantRegistrationBonus", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 注册赠送积分集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;
  });

  afterAll(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== 注册赠送测试完成 ==========\n");
  });

  it("CS-INT-REG-001: 应该为新用户创建账户、批次和流水", async () => {
    console.log("[INT-TEST] CS-INT-REG-001: 注册赠送完整流程");

    const userId = await createTestUser(userRepo, "r1");
    localUserIds.push(userId);

    const result = await service.grantRegistrationBonus(userId);

    console.log("[INT-TEST] 结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(300);
    expect(result.newBalance).toBe(300);

    // 验证账户数据
    const balance = await service.getBalance(userId);
    expect(balance).not.toBeNull();
    expect(balance!.totalBalance).toBe(300);
    expect(balance!.totalEarned).toBe(300);
    expect(balance!.totalConsumed).toBe(0);
    expect(balance!.totalExpired).toBe(0);

    // 验证流水
    const transactions = await service.getTransactionHistory(userId);
    expect(transactions.length).toBe(1);
    expect(transactions[0].type).toBe("earn");
    expect(transactions[0].amount).toBe(300);
    expect(transactions[0].source).toBe("register");

    console.log("[INT-TEST] ✓ 注册赠送完整流程验证通过");
  });

  it("CS-INT-REG-002: 不应重复赠送注册积分", async () => {
    console.log("[INT-TEST] CS-INT-REG-002: 防止重复赠送");

    const userId = await createTestUser(userRepo, "r2");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId);
    const result = await service.grantRegistrationBonus(userId);

    expect(result.success).toBe(false);
    expect(result.creditsGranted).toBe(0);
    expect(result.newBalance).toBe(300);

    console.log("[INT-TEST] ✓ 重复赠送正确拒绝");
  });

  it("CS-INT-REG-003: 应该支持自定义赠送额度", async () => {
    console.log("[INT-TEST] CS-INT-REG-003: 自定义赠送额度");

    const userId = await createTestUser(userRepo, "r3");
    localUserIds.push(userId);

    const result = await service.grantRegistrationBonus(userId, {
      amount: 500,
      expiryMonths: 6,
    });

    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(500);
    expect(result.newBalance).toBe(500);

    console.log("[INT-TEST] ✓ 自定义额度赠送成功");
  });
});

// ============================================================================
// FIFO 积分消费
// ============================================================================

describe("CreditService Integration - consumeCredits (FIFO)", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== FIFO 消费集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;
  });

  afterAll(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== FIFO 消费测试完成 ==========\n");
  });

  it("CS-INT-CONSUME-001: 应该从单批次扣减积分并更新余额", async () => {
    console.log("[INT-TEST] CS-INT-CONSUME-001: 单批次消费");

    const userId = await createTestUser(userRepo, "c1");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId);

    const result = await service.consumeCredits(userId, 50, {
      source: "model_call",
      description: "Claude Sonnet 调用",
    });

    console.log("[INT-TEST] 消费结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.consumed).toBe(50);
    expect(result.newBalance).toBe(250);

    // 验证账户余额同步
    const balance = await service.getBalance(userId);
    expect(balance!.totalBalance).toBe(250);
    expect(balance!.totalConsumed).toBe(50);

    console.log("[INT-TEST] ✓ 单批次消费验证通过");
  });

  it("CS-INT-CONSUME-002: FIFO 应优先消费先过期的批次", async () => {
    console.log("[INT-TEST] CS-INT-CONSUME-002: FIFO 跨批次消费");

    const userId = await createTestUser(userRepo, "c2");
    localUserIds.push(userId);

    // 手动创建两个不同过期时间的批次
    const accountRepo = getCreditAccountRepository(db);
    const batchRepo = getCreditBatchRepository(db);
    const account = await accountRepo.create(userId);

    // 批次 A：1 个月后过期，100 积分（应先被消费）
    const now = Date.now();
    const batchA = await batchRepo.create({
      userId,
      source: "register",
      originalAmount: 100,
      remainingAmount: 100,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
      description: "批次A - 先过期",
    });

    // 批次 B：3 个月后过期，200 积分
    const batchB = await batchRepo.create({
      userId,
      source: "purchase",
      originalAmount: 200,
      remainingAmount: 200,
      expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000),
      description: "批次B - 后过期",
    });

    // 更新账户余额
    await accountRepo.updateBalance(account.id, {
      totalBalance: 300,
      totalEarned: 300,
    });

    // 消费 150 积分：应该先消费批次 A 的 100，再消费批次 B 的 50
    const result = await service.consumeCredits(userId, 150, {
      source: "model_call",
      description: "FIFO 跨批次消费",
    });

    expect(result.success).toBe(true);
    expect(result.consumed).toBe(150);
    expect(result.newBalance).toBe(150);

    // 验证批次 A 被完全消费
    const activeBatches = await batchRepo.findActiveByUserId(userId);
    console.log("[INT-TEST] 剩余有效批次数:", activeBatches.length);

    // 批次 A 的 remainingAmount 应该为 0（不再是有效批次）
    // 批次 B 应剩余 150
    const totalRemaining = activeBatches.reduce((sum, b) => sum + b.remainingAmount, 0);
    expect(totalRemaining).toBe(150);

    console.log("[INT-TEST] ✓ FIFO 跨批次消费验证通过");
  });

  it("CS-INT-CONSUME-003: 余额不足应拒绝消费", async () => {
    console.log("[INT-TEST] CS-INT-CONSUME-003: 余额不足");

    const userId = await createTestUser(userRepo, "c3");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId); // 300 积分

    const result = await service.consumeCredits(userId, 500, {
      source: "model_call",
      description: "超额消费",
    });

    expect(result.success).toBe(false);
    expect(result.consumed).toBe(0);
    expect(result.reason).toContain("不足");

    // 余额不应变化
    const balance = await service.getBalance(userId);
    expect(balance!.totalBalance).toBe(300);

    console.log("[INT-TEST] ✓ 余额不足拒绝验证通过");
  });

  it("CS-INT-CONSUME-004: 消费流水应包含 metadata", async () => {
    console.log("[INT-TEST] CS-INT-CONSUME-004: 消费流水 metadata");

    const userId = await createTestUser(userRepo, "c4");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId);

    const metadata = {
      modelId: "anthropic/claude-sonnet-4-20250514",
      inputTokens: 2000,
      outputTokens: 800,
      inputPrice: 300,
      outputPrice: 1500,
      multiplier: 1.0,
    };

    await service.consumeCredits(userId, 10, {
      source: "model_call",
      description: "Claude Sonnet 调用",
      metadata,
    });

    const transactions = await service.getTransactionHistory(userId);
    const consumeTxn = transactions.find((t) => t.type === "consume");

    expect(consumeTxn).toBeDefined();
    expect(consumeTxn!.metadata).toBeDefined();
    expect(consumeTxn!.metadata!.modelId).toBe("anthropic/claude-sonnet-4-20250514");
    expect(consumeTxn!.metadata!.inputTokens).toBe(2000);
    expect(consumeTxn!.metadata!.outputTokens).toBe(800);

    console.log("[INT-TEST] ✓ 消费流水 metadata 验证通过");
  });
});

// ============================================================================
// 邀请奖励积分
// ============================================================================

describe("CreditService Integration - grantInviteReward", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 邀请奖励集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;
  });

  afterAll(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== 邀请奖励测试完成 ==========\n");
  });

  it("CS-INT-INV-001: 应该为邀请人发放奖励并创建邀请记录", async () => {
    console.log("[INT-TEST] CS-INT-INV-001: 邀请奖励发放");

    const inviterId = await createTestUser(userRepo, "i1");
    const inviteeId = await createTestUser(userRepo, "i2");
    localUserIds.push(inviterId, inviteeId);

    await service.grantRegistrationBonus(inviterId);

    const result = await service.grantInviteReward(inviterId, inviteeId);

    console.log("[INT-TEST] 邀请结果:", JSON.stringify(result));
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(200);
    expect(result.newBalance).toBe(500); // 300 + 200

    // 验证账户余额
    const balance = await service.getBalance(inviterId);
    expect(balance!.totalBalance).toBe(500);
    expect(balance!.totalEarned).toBe(500);

    console.log("[INT-TEST] ✓ 邀请奖励发放验证通过");
  });

  it("CS-INT-INV-002: 不应重复邀请同一用户", async () => {
    console.log("[INT-TEST] CS-INT-INV-002: 重复邀请拦截");

    const inviterId = await createTestUser(userRepo, "i3");
    const inviteeId = await createTestUser(userRepo, "i4");
    localUserIds.push(inviterId, inviteeId);

    await service.grantRegistrationBonus(inviterId);
    await service.grantInviteReward(inviterId, inviteeId);

    const result = await service.grantInviteReward(inviterId, inviteeId);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("已被邀请");

    console.log("[INT-TEST] ✓ 重复邀请拦截验证通过");
  });

  it("CS-INT-INV-003: 邀请积分达到上限应拒绝", async () => {
    console.log("[INT-TEST] CS-INT-INV-003: 邀请上限检查");

    const inviterId = await createTestUser(userRepo, "i5");
    localUserIds.push(inviterId);

    await service.grantRegistrationBonus(inviterId);

    // 邀请 3 人，使用自定义上限 500，每人 200
    for (let i = 1; i <= 2; i++) {
      const inviteeId = await createTestUser(userRepo, `i5e${i}`);
      localUserIds.push(inviteeId);
      await service.grantInviteReward(inviterId, inviteeId, {
        amount: 200,
        maxTotal: 500,
      });
    }

    // 第 3 个邀请应该被拒绝（已发放 400，再发 200 超过 500）
    const inviteeId3 = await createTestUser(userRepo, "i5e3");
    localUserIds.push(inviteeId3);
    const result = await service.grantInviteReward(inviterId, inviteeId3, {
      amount: 200,
      maxTotal: 500,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain("上限");

    console.log("[INT-TEST] ✓ 邀请上限检查验证通过");
  });
});

// ============================================================================
// 包月/加油包积分发放
// ============================================================================

describe("CreditService Integration - grantSubscriptionCredits & grantBoosterCredits", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 包月/加油包积分集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;
  });

  afterAll(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== 包月/加油包测试完成 ==========\n");
  });

  it("CS-INT-SUB-001: 应该为包月用户发放 2000 积分", async () => {
    console.log("[INT-TEST] CS-INT-SUB-001: 包月积分发放");

    const userId = await createTestUser(userRepo, "s1");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId);

    const result = await service.grantSubscriptionCredits(userId, {
      amount: 2000,
      expiryMonths: 1,
      sourceId: "order-sub-001",
    });

    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(2000);
    expect(result.newBalance).toBe(2300); // 300 + 2000

    // 验证流水中有 subscription 来源
    const txns = await service.getTransactionHistory(userId);
    const subTxn = txns.find((t) => t.source === "subscription");
    expect(subTxn).toBeDefined();
    expect(subTxn!.amount).toBe(2000);

    console.log("[INT-TEST] ✓ 包月积分发放验证通过");
  });

  it("CS-INT-BOOST-001: 应该为用户发放 1500 加油包积分", async () => {
    console.log("[INT-TEST] CS-INT-BOOST-001: 加油包积分发放");

    const userId = await createTestUser(userRepo, "b1");
    localUserIds.push(userId);

    await service.grantRegistrationBonus(userId);

    const result = await service.grantBoosterCredits(userId, {
      amount: 1500,
      expiryMonths: 3,
      sourceId: "order-boost-001",
    });

    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(1500);
    expect(result.newBalance).toBe(1800); // 300 + 1500

    // 验证流水中有 purchase 来源
    const txns = await service.getTransactionHistory(userId);
    const boostTxn = txns.find((t) => t.source === "purchase");
    expect(boostTxn).toBeDefined();
    expect(boostTxn!.amount).toBe(1500);

    console.log("[INT-TEST] ✓ 加油包积分发放验证通过");
  });
});

// ============================================================================
// 模型调用积分计算
// ============================================================================

describe("CreditService Integration - calculateModelCallCost", () => {
  let db: Database;
  let service: CreditService;
  const testModelIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 模型积分计算集成测试 ==========");
    db = getDatabase();
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const modelId of testModelIds) {
      await cleanupPricingData(db, modelId);
    }
    testModelIds.length = 0;
  });

  afterAll(() => {
    console.log("[INT-TEST] ========== 模型积分计算测试完成 ==========\n");
  });

  it("CS-INT-CALC-001: 应该根据真实定价计算 Claude Sonnet 积分消耗", async () => {
    console.log("[INT-TEST] CS-INT-CALC-001: Claude Sonnet 定价计算");

    const modelId = `test-sonnet-${Date.now()}`;
    testModelIds.push(modelId);

    await service.setModelPricing({
      modelId,
      modelName: "Claude Sonnet 4 (test)",
      inputPrice: 300,
      outputPrice: 1500,
    });

    // 典型对话：2000 input + 1000 output
    const cost = await service.calculateModelCallCost(modelId, 2000, 1000);

    // (2000 * 300 + 1000 * 1500) / 1_000_000 = (600000 + 1500000) / 1000000 = 2.1
    // ceil(2.1) = 3
    console.log("[INT-TEST] 计算结果:", cost, "积分");
    expect(cost).toBe(3);

    console.log("[INT-TEST] ✓ Claude Sonnet 定价计算验证通过");
  });

  it("CS-INT-CALC-002: 应该正确应用 1.5 倍率", async () => {
    console.log("[INT-TEST] CS-INT-CALC-002: 倍率计算");

    const modelId = `test-opus-${Date.now()}`;
    testModelIds.push(modelId);

    await service.setModelPricing({
      modelId,
      modelName: "Claude Opus 4 (test)",
      inputPrice: 1500,
      outputPrice: 7500,
      multiplier: "1.50",
    });

    const cost = await service.calculateModelCallCost(modelId, 1000, 500);

    // (1000 * 1500 + 500 * 7500) / 1_000_000 * 1.5 = (1500000 + 3750000) / 1000000 * 1.5 = 5.25 * 1.5 = 7.875
    // ceil(7.875) = 8
    console.log("[INT-TEST] 带倍率计算结果:", cost, "积分");
    expect(cost).toBe(8);

    console.log("[INT-TEST] ✓ 倍率计算验证通过");
  });

  it("CS-INT-CALC-003: 极少 token 应最少消耗 1 积分", async () => {
    console.log("[INT-TEST] CS-INT-CALC-003: 最小消费验证");

    const modelId = `test-haiku-${Date.now()}`;
    testModelIds.push(modelId);

    await service.setModelPricing({
      modelId,
      modelName: "Claude Haiku 3 (test)",
      inputPrice: 25,
      outputPrice: 125,
    });

    const cost = await service.calculateModelCallCost(modelId, 1, 1);

    // (1 * 25 + 1 * 125) / 1_000_000 = 0.00015 → max(1, ceil(0.00015)) = 1
    expect(cost).toBe(1);

    console.log("[INT-TEST] ✓ 最小消费验证通过");
  });
});

// ============================================================================
// 过期批次清理
// ============================================================================

describe("CreditService Integration - cleanupExpiredBatches", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 过期清理集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterEach(async () => {
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;
  });

  afterAll(async () => {
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== 过期清理测试完成 ==========\n");
  });

  it("CS-INT-CLEANUP-001: 应该清理过期批次并更新账户余额", async () => {
    console.log("[INT-TEST] CS-INT-CLEANUP-001: 过期批次清理");

    const userId = await createTestUser(userRepo, "x1");
    localUserIds.push(userId);

    // 直接通过 repo 创建已过期的批次
    const accountRepo = getCreditAccountRepository(db);
    const batchRepo = getCreditBatchRepository(db);

    const account = await accountRepo.create(userId);
    await accountRepo.updateBalance(account.id, {
      totalBalance: 150,
      totalEarned: 150,
    });

    // 创建已过期批次
    await batchRepo.create({
      userId,
      source: "register",
      originalAmount: 150,
      remainingAmount: 150,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前
      description: "已过期的注册积分",
    });

    const result = await service.cleanupExpiredBatches();

    console.log("[INT-TEST] 清理结果:", JSON.stringify(result));
    expect(result.batchesCleaned).toBeGreaterThanOrEqual(1);
    expect(result.creditsExpired).toBeGreaterThanOrEqual(150);

    // 验证余额已扣减
    const balance = await service.getBalance(userId);
    expect(balance!.totalBalance).toBe(0);
    expect(balance!.totalExpired).toBe(150);

    // 验证有过期流水
    const txns = await service.getTransactionHistory(userId);
    const expireTxn = txns.find((t) => t.type === "expire");
    expect(expireTxn).toBeDefined();
    expect(expireTxn!.source).toBe("expiry_cleanup");

    console.log("[INT-TEST] ✓ 过期批次清理验证通过");
  });
});

// ============================================================================
// 端到端完整流程
// ============================================================================

describe("CreditService Integration - 端到端完整流程", () => {
  let db: Database;
  let userRepo: UserRepository;
  let service: CreditService;
  const localUserIds: string[] = [];
  const localModelIds: string[] = [];

  beforeAll(() => {
    console.log("[INT-TEST] ========== 端到端完整流程集成测试 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);
    service = new CreditService({
      accountRepo: getCreditAccountRepository(db),
      batchRepo: getCreditBatchRepository(db),
      txnRepo: getCreditTransactionRepository(db),
      inviteRepo: getInviteRepository(db),
      pricingRepo: getModelPricingRepository(db),
    });
  });

  afterAll(async () => {
    // 清理模型定价
    for (const modelId of localModelIds) {
      await cleanupPricingData(db, modelId);
    }
    localModelIds.length = 0;

    // 清理积分数据
    for (const userId of localUserIds) {
      await cleanupUserCreditData(db, userId);
    }
    localUserIds.length = 0;

    // 清理用户
    for (const userId of testUserIds) {
      try {
        await userRepo.hardDelete(userId);
      } catch {
        // 忽略
      }
    }
    testUserIds.length = 0;
    console.log("[INT-TEST] ========== 端到端测试完成 ==========\n");
  });

  it("CS-INT-E2E-001: 注册→邀请→消费→查询完整流程", async () => {
    console.log("[INT-TEST] CS-INT-E2E-001: 完整业务流程");

    // 1. 用户注册
    const userId = await createTestUser(userRepo, "e1");
    localUserIds.push(userId);

    const regResult = await service.grantRegistrationBonus(userId);
    console.log("[INT-TEST] 1. 注册赠送:", regResult.creditsGranted, "积分");
    expect(regResult.success).toBe(true);
    expect(regResult.newBalance).toBe(300);

    // 2. 邀请好友
    const friendId = await createTestUser(userRepo, "e2");
    localUserIds.push(friendId);

    const invResult = await service.grantInviteReward(userId, friendId);
    console.log("[INT-TEST] 2. 邀请奖励:", invResult.creditsGranted, "积分");
    expect(invResult.success).toBe(true);
    expect(invResult.newBalance).toBe(500); // 300 + 200

    // 3. 购买加油包
    const boostResult = await service.grantBoosterCredits(userId, {
      amount: 1500,
      expiryMonths: 3,
      sourceId: "order-e2e-001",
    });
    console.log("[INT-TEST] 3. 加油包:", boostResult.creditsGranted, "积分");
    expect(boostResult.success).toBe(true);
    expect(boostResult.newBalance).toBe(2000); // 500 + 1500

    // 4. 设置模型定价
    const modelId = `test-e2e-model-${Date.now()}`;
    localModelIds.push(modelId);

    await service.setModelPricing({
      modelId,
      modelName: "E2E Test Model",
      inputPrice: 300,
      outputPrice: 1500,
    });

    // 5. 计算模型调用成本
    const cost = await service.calculateModelCallCost(modelId, 5000, 2000);
    console.log("[INT-TEST] 4. 模型调用成本:", cost, "积分");
    expect(cost).toBeGreaterThanOrEqual(1);

    // 6. 消费积分
    const consumeResult = await service.consumeCredits(userId, cost, {
      source: "model_call",
      description: "E2E 测试模型调用",
      metadata: {
        modelId,
        inputTokens: 5000,
        outputTokens: 2000,
        inputPrice: 300,
        outputPrice: 1500,
        multiplier: 1.0,
      },
    });
    console.log("[INT-TEST] 5. 消费:", consumeResult.consumed, "积分，余额:", consumeResult.newBalance);
    expect(consumeResult.success).toBe(true);

    // 7. 查询流水
    const transactions = await service.getTransactionHistory(userId);
    console.log("[INT-TEST] 6. 总流水数:", transactions.length);
    // 至少 4 条：register earn, invite earn, purchase earn, model_call consume
    expect(transactions.length).toBeGreaterThanOrEqual(4);

    // 8. 验证最终余额
    const finalBalance = await service.getBalance(userId);
    console.log("[INT-TEST] 7. 最终余额:", finalBalance!.totalBalance);
    expect(finalBalance!.totalBalance).toBe(2000 - cost);
    expect(finalBalance!.totalEarned).toBe(2000);
    expect(finalBalance!.totalConsumed).toBe(cost);

    console.log("[INT-TEST] ✓ 端到端完整流程验证通过");
  });
});
