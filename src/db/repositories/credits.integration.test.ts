/**
 * 积分系统 Repository 集成测试
 *
 * 使用真实 PostgreSQL 数据库测试积分系统数据访问层。
 * 包含完整的 CRUD、FIFO 消费、过期清理等场景。
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { getDatabase } from "../connection.js";
import type { Database } from "../connection.js";
import {
  creditAccounts,
  creditBatches,
  creditTransactions,
  inviteRecords,
  modelPricing,
} from "../schema/index.js";

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
import { getUserRepository, type UserRepository } from "./users.js";

// 测试数据清理用的 ID 收集器
const createdAccountIds: string[] = [];
const createdBatchIds: string[] = [];
const createdTransactionIds: string[] = [];
const createdInviteIds: string[] = [];
const createdPricingIds: string[] = [];
const createdUserIds: string[] = [];

/**
 * 创建测试用户（满足外键约束）
 */
async function createTestUser(userRepo: UserRepository, suffix: string): Promise<string> {
  const user = await userRepo.create({
    phone: `+86100${Date.now().toString().slice(-8)}${suffix}`,
    isActive: true,
  });
  createdUserIds.push(user.id);
  return user.id;
}

/**
 * 清理积分相关的测试数据（不清理用户）
 *
 * 按外键依赖顺序删除：transactions → batches → accounts → pricing
 * 用户在 afterAll 中由各 describe 自行清理。
 */
async function cleanupCreditData(db: Database): Promise<void> {
  for (const id of createdTransactionIds) {
    await db
      .delete(creditTransactions)
      .where(sql`id = ${id}`)
      .execute();
  }
  createdTransactionIds.length = 0;

  for (const id of createdBatchIds) {
    await db
      .delete(creditBatches)
      .where(sql`id = ${id}`)
      .execute();
  }
  createdBatchIds.length = 0;

  for (const id of createdAccountIds) {
    await db
      .delete(creditAccounts)
      .where(sql`id = ${id}`)
      .execute();
  }
  createdAccountIds.length = 0;

  for (const id of createdPricingIds) {
    await db
      .delete(modelPricing)
      .where(sql`id = ${id}`)
      .execute();
  }
  createdPricingIds.length = 0;
}

/**
 * 清理测试用户
 */
async function cleanupUsers(db: Database): Promise<void> {
  const userRepo = getUserRepository(db);
  for (const id of createdUserIds) {
    try {
      await userRepo.hardDelete(id);
    } catch {
      // 忽略
    }
  }
  createdUserIds.length = 0;
}

// ============================================================================
// CreditAccountRepository 集成测试
// ============================================================================

describe("CreditAccountRepository (Integration)", () => {
  let db: Database;
  let repo: CreditAccountRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    console.log("[TEST] ========== 积分账户集成测试 - 连接数据库 ==========");
    db = getDatabase();
    repo = getCreditAccountRepository(db);
    userRepo = getUserRepository(db);
    testUserId = await createTestUser(userRepo, "a");
  });

  afterEach(async () => {
    await cleanupCreditData(db);
  });

  afterAll(async () => {
    await cleanupUsers(db);
    console.log("[TEST] ========== 积分账户集成测试完成 ==========\n");
  });

  it("CREDIT-ACCOUNT-INT-001: 应该在真实数据库创建积分账户", async () => {
    console.log("[TEST] 测试创建积分账户");

    const account = await repo.create(testUserId);
    createdAccountIds.push(account.id);

    console.log("[TEST] 账户ID:", account.id);
    console.log("[TEST] 用户ID:", account.userId);

    expect(account.id).toBeTruthy();
    expect(account.userId).toBe(testUserId);
    expect(account.totalBalance).toBe(0);
    expect(account.totalEarned).toBe(0);
    expect(account.totalConsumed).toBe(0);
    expect(account.totalExpired).toBe(0);
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toBeInstanceOf(Date);
    console.log("[TEST] ✓ 积分账户创建成功");
  });

  it("CREDIT-ACCOUNT-INT-002: 应该根据 userId 查询积分账户", async () => {
    console.log("[TEST] 测试根据 userId 查询");

    const account = await repo.create(testUserId);
    createdAccountIds.push(account.id);

    const found = await repo.findByUserId(testUserId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(account.id);
    expect(found!.userId).toBe(testUserId);
    console.log("[TEST] ✓ 查询成功");
  });

  it("CREDIT-ACCOUNT-INT-003: 应该更新积分余额", async () => {
    console.log("[TEST] 测试更新积分余额");

    const account = await repo.create(testUserId);
    createdAccountIds.push(account.id);

    const updated = await repo.updateBalance(account.id, {
      totalBalance: 500,
      totalEarned: 500,
    });

    expect(updated).not.toBeNull();
    expect(updated!.totalBalance).toBe(500);
    expect(updated!.totalEarned).toBe(500);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(account.updatedAt.getTime());
    console.log("[TEST] ✓ 余额更新成功");
  });

  it("CREDIT-ACCOUNT-INT-004: getOrCreate 不存在时创建", async () => {
    console.log("[TEST] 测试 getOrCreate（不存在场景）");

    const uniqueUserId = await createTestUser(userRepo, "gc");
    const account = await repo.getOrCreate(uniqueUserId);
    createdAccountIds.push(account.id);

    expect(account.userId).toBe(uniqueUserId);
    expect(account.totalBalance).toBe(0);
    console.log("[TEST] ✓ getOrCreate 创建成功");
  });

  it("CREDIT-ACCOUNT-INT-005: getOrCreate 已存在时返回现有", async () => {
    console.log("[TEST] 测试 getOrCreate（已存在场景）");

    const account1 = await repo.create(testUserId);
    createdAccountIds.push(account1.id);

    const account2 = await repo.getOrCreate(testUserId);

    expect(account2.id).toBe(account1.id);
    console.log("[TEST] ✓ getOrCreate 返回已有账户");
  });
});

// ============================================================================
// CreditBatchRepository 集成测试
// ============================================================================

describe("CreditBatchRepository (Integration)", () => {
  let db: Database;
  let repo: CreditBatchRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    console.log("[TEST] ========== 积分批次集成测试 - 连接数据库 ==========");
    db = getDatabase();
    repo = getCreditBatchRepository(db);
    userRepo = getUserRepository(db);
    testUserId = await createTestUser(userRepo, "b");
  });

  afterEach(async () => {
    await cleanupCreditData(db);
  });

  afterAll(async () => {
    await cleanupUsers(db);
    console.log("[TEST] ========== 积分批次集成测试完成 ==========\n");
  });

  it("CREDIT-BATCH-INT-001: 应该创建积分批次", async () => {
    console.log("[TEST] 测试创建积分批次");

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt,
      description: "注册赠送积分",
    });
    createdBatchIds.push(batch.id);

    console.log("[TEST] 批次ID:", batch.id);

    expect(batch.id).toBeTruthy();
    expect(batch.userId).toBe(testUserId);
    expect(batch.source).toBe("register");
    expect(batch.originalAmount).toBe(300);
    expect(batch.remainingAmount).toBe(300);
    expect(batch.createdAt).toBeInstanceOf(Date);
    console.log("[TEST] ✓ 积分批次创建成功");
  });

  it("CREDIT-BATCH-INT-002: 应该查询有效批次并按过期时间排序（FIFO）", async () => {
    console.log("[TEST] 测试 FIFO 排序查询");

    const now = Date.now();

    // 创建 3 个批次，过期时间分别为 30/60/90 天后
    const batch1 = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000), // 30天
      description: "最先过期",
    });
    createdBatchIds.push(batch1.id);

    const batch2 = await repo.create({
      userId: testUserId,
      source: "purchase",
      originalAmount: 1500,
      remainingAmount: 1500,
      expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000), // 90天
      description: "最晚过期",
    });
    createdBatchIds.push(batch2.id);

    const batch3 = await repo.create({
      userId: testUserId,
      source: "invite",
      originalAmount: 200,
      remainingAmount: 200,
      expiresAt: new Date(now + 60 * 24 * 60 * 60 * 1000), // 60天
      description: "中间过期",
    });
    createdBatchIds.push(batch3.id);

    // 创建一个已过期批次（不应返回）
    const expiredBatch = await repo.create({
      userId: testUserId,
      source: "admin_grant",
      originalAmount: 100,
      remainingAmount: 50,
      expiresAt: new Date(now - 1000),
      description: "已过期",
    });
    createdBatchIds.push(expiredBatch.id);

    const activeBatches = await repo.findActiveByUserId(testUserId);

    console.log("[TEST] 有效批次数量:", activeBatches.length);
    expect(activeBatches.length).toBe(3);

    // 验证 FIFO 排序：按过期时间升序
    console.log("[TEST] 排序验证:");
    for (let i = 0; i < activeBatches.length; i++) {
      console.log(
        `[TEST]   [${i}] 过期: ${activeBatches[i].expiresAt.toISOString()}, 描述: ${activeBatches[i].description}`,
      );
    }
    expect(activeBatches[0].description).toBe("最先过期");
    expect(activeBatches[1].description).toBe("中间过期");
    expect(activeBatches[2].description).toBe("最晚过期");
    console.log("[TEST] ✓ FIFO 排序正确");
  });

  it("CREDIT-BATCH-INT-003: 应该原子扣减批次余额", async () => {
    console.log("[TEST] 测试原子扣减");

    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      description: "测试扣减",
    });
    createdBatchIds.push(batch.id);

    // 扣减 50
    const after1 = await repo.deductAmount(batch.id, 50);
    expect(after1!.remainingAmount).toBe(250);
    console.log("[TEST] 第1次扣减后:", after1!.remainingAmount);

    // 再扣减 100
    const after2 = await repo.deductAmount(batch.id, 100);
    expect(after2!.remainingAmount).toBe(150);
    console.log("[TEST] 第2次扣减后:", after2!.remainingAmount);

    console.log("[TEST] ✓ 原子扣减成功");
  });

  it("CREDIT-BATCH-INT-004: 应该查询过期待清理批次", async () => {
    console.log("[TEST] 测试过期清理查询");

    const now = Date.now();

    // 已过期有余额（应返回）
    const expired = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 100,
      expiresAt: new Date(now - 10000),
      description: "过期有余额",
    });
    createdBatchIds.push(expired.id);

    // 已过期无余额（不应返回）
    const expiredEmpty = await repo.create({
      userId: testUserId,
      source: "invite",
      originalAmount: 200,
      remainingAmount: 0,
      expiresAt: new Date(now - 10000),
      description: "过期无余额",
    });
    createdBatchIds.push(expiredEmpty.id);

    // 未过期（不应返回）
    const active = await repo.create({
      userId: testUserId,
      source: "purchase",
      originalAmount: 1500,
      remainingAmount: 1500,
      expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000),
      description: "未过期",
    });
    createdBatchIds.push(active.id);

    const expiredBatches = await repo.findExpiredWithBalance();

    // 过滤出本次测试创建的数据（生产数据库可能有其他数据）
    const testExpired = expiredBatches.filter((b) => b.userId === testUserId);
    console.log("[TEST] 本次测试过期批次数:", testExpired.length);
    expect(testExpired.length).toBe(1);
    expect(testExpired[0].remainingAmount).toBe(100);
    console.log("[TEST] ✓ 过期查询正确");
  });

  it("CREDIT-BATCH-INT-005: 应该清零过期批次", async () => {
    console.log("[TEST] 测试清零过期批次");

    const batch = await repo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 150,
      expiresAt: new Date(Date.now() - 1000),
      description: "待清零",
    });
    createdBatchIds.push(batch.id);

    const cleared = await repo.clearExpiredBatch(batch.id);

    expect(cleared).not.toBeNull();
    expect(cleared!.remainingAmount).toBe(0);
    console.log("[TEST] ✓ 清零成功");
  });
});

// ============================================================================
// CreditTransactionRepository 集成测试
// ============================================================================

describe("CreditTransactionRepository (Integration)", () => {
  let db: Database;
  let repo: CreditTransactionRepository;
  let batchRepo: CreditBatchRepository;
  let userRepo: UserRepository;
  let testUserId: string;

  beforeAll(async () => {
    console.log("[TEST] ========== 积分流水集成测试 - 连接数据库 ==========");
    db = getDatabase();
    repo = getCreditTransactionRepository(db);
    batchRepo = getCreditBatchRepository(db);
    userRepo = getUserRepository(db);
    testUserId = await createTestUser(userRepo, "c");
  });

  afterEach(async () => {
    await cleanupCreditData(db);
  });

  afterAll(async () => {
    await cleanupUsers(db);
    console.log("[TEST] ========== 积分流水集成测试完成 ==========\n");
  });

  it("CREDIT-TXN-INT-001: 应该创建获得流水", async () => {
    console.log("[TEST] 测试创建获得流水");

    const txn = await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
      description: "注册赠送积分",
    });
    createdTransactionIds.push(txn.id);

    console.log("[TEST] 流水ID:", txn.id);

    expect(txn.id).toBeTruthy();
    expect(txn.userId).toBe(testUserId);
    expect(txn.type).toBe("earn");
    expect(txn.amount).toBe(300);
    expect(txn.balanceAfter).toBe(300);
    expect(txn.source).toBe("register");
    expect(txn.createdAt).toBeInstanceOf(Date);
    console.log("[TEST] ✓ 获得流水创建成功");
  });

  it("CREDIT-TXN-INT-002: 应该创建消费流水（含 batch 关联和 metadata）", async () => {
    console.log("[TEST] 测试创建消费流水");

    // 先创建一个批次
    const batch = await batchRepo.create({
      userId: testUserId,
      source: "register",
      originalAmount: 300,
      remainingAmount: 300,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      description: "测试批次",
    });
    createdBatchIds.push(batch.id);

    const txn = await repo.create({
      userId: testUserId,
      batchId: batch.id,
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
    createdTransactionIds.push(txn.id);

    expect(txn.batchId).toBe(batch.id);
    expect(txn.type).toBe("consume");
    expect(txn.amount).toBe(-15);
    expect(txn.metadata).toBeDefined();
    expect((txn.metadata as Record<string, unknown>).modelId).toBe(
      "anthropic/claude-sonnet-4-20250514",
    );
    expect((txn.metadata as Record<string, unknown>).inputTokens).toBe(1000);
    console.log("[TEST] ✓ 消费流水创建成功（含 metadata）");
  });

  it("CREDIT-TXN-INT-003: 应该按时间倒序查询流水", async () => {
    console.log("[TEST] 测试流水查询排序");

    const txn1 = await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
      description: "第1条",
    });
    createdTransactionIds.push(txn1.id);

    // 加一点延迟确保时间戳不同
    await new Promise((r) => setTimeout(r, 10));

    const txn2 = await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -10,
      balanceAfter: 290,
      source: "model_call",
      description: "第2条",
    });
    createdTransactionIds.push(txn2.id);

    await new Promise((r) => setTimeout(r, 10));

    const txn3 = await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 200,
      balanceAfter: 490,
      source: "invite",
      description: "第3条",
    });
    createdTransactionIds.push(txn3.id);

    const transactions = await repo.findByUserId(testUserId);

    console.log("[TEST] 流水数量:", transactions.length);
    expect(transactions.length).toBe(3);

    // 按时间倒序：第3条最新排最前
    expect(transactions[0].description).toBe("第3条");
    expect(transactions[2].description).toBe("第1条");
    console.log("[TEST] ✓ 排序验证通过");
  });

  it("CREDIT-TXN-INT-004: 应该按类型过滤查询", async () => {
    console.log("[TEST] 测试按类型过滤");

    const txn1 = await repo.create({
      userId: testUserId,
      type: "earn",
      amount: 300,
      balanceAfter: 300,
      source: "register",
    });
    createdTransactionIds.push(txn1.id);

    const txn2 = await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -10,
      balanceAfter: 290,
      source: "model_call",
    });
    createdTransactionIds.push(txn2.id);

    const txn3 = await repo.create({
      userId: testUserId,
      type: "consume",
      amount: -20,
      balanceAfter: 270,
      source: "model_call",
    });
    createdTransactionIds.push(txn3.id);

    const consumeOnly = await repo.findByUserIdAndType(testUserId, "consume");

    expect(consumeOnly.length).toBe(2);
    expect(consumeOnly.every((t) => t.type === "consume")).toBe(true);
    console.log("[TEST] ✓ 按类型过滤正确");
  });

  it("CREDIT-TXN-INT-005: 应该支持分页", async () => {
    console.log("[TEST] 测试分页查询");

    for (let i = 0; i < 5; i++) {
      const txn = await repo.create({
        userId: testUserId,
        type: "consume",
        amount: -(i + 1),
        balanceAfter: 300 - (i + 1),
        source: "model_call",
        description: `消费${i + 1}`,
      });
      createdTransactionIds.push(txn.id);
    }

    const page1 = await repo.findByUserId(testUserId, { limit: 2, offset: 0 });
    const page2 = await repo.findByUserId(testUserId, { limit: 2, offset: 2 });
    const page3 = await repo.findByUserId(testUserId, { limit: 2, offset: 4 });

    console.log("[TEST] 第1页:", page1.length, "条");
    console.log("[TEST] 第2页:", page2.length, "条");
    console.log("[TEST] 第3页:", page3.length, "条");

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page3.length).toBe(1);
    console.log("[TEST] ✓ 分页正确");
  });
});

// ============================================================================
// InviteRepository 集成测试
// ============================================================================

describe("InviteRepository (Integration)", () => {
  let db: Database;
  let repo: InviteRepository;
  let userRepo: UserRepository;
  let inviterUserId: string;
  // 邀请测试使用独立的 ID 收集器，避免 afterEach 清理掉 inviter
  const localInviteIds: string[] = [];
  const localUserIds: string[] = [];

  beforeAll(async () => {
    console.log("[TEST] ========== 邀请记录集成测试 - 连接数据库 ==========");
    db = getDatabase();
    repo = getInviteRepository(db);
    userRepo = getUserRepository(db);
    // inviter 用户在所有测试中共享，不放入 afterEach 的清理列表
    const inviterUser = await userRepo.create({
      phone: `+86100${Date.now().toString().slice(-8)}inv`,
      isActive: true,
    });
    inviterUserId = inviterUser.id;
    localUserIds.push(inviterUser.id);
  });

  afterEach(async () => {
    // 仅清理 invite 记录，不清理用户
    for (const id of localInviteIds) {
      await db
        .delete(inviteRecords)
        .where(sql`id = ${id}`)
        .execute();
    }
    localInviteIds.length = 0;
  });

  afterAll(async () => {
    // 清理所有邀请测试创建的用户
    for (const id of localUserIds) {
      try {
        await userRepo.hardDelete(id);
      } catch {
        // 忽略
      }
    }
    localUserIds.length = 0;
    console.log("[TEST] ========== 邀请记录集成测试完成 ==========\n");
  });

  /**
   * 创建邀请测试用的被邀请人
   */
  async function createInvitee(suffix: string): Promise<string> {
    const user = await userRepo.create({
      phone: `+86100${Date.now().toString().slice(-8)}${suffix}`,
      isActive: true,
    });
    localUserIds.push(user.id);
    return user.id;
  }

  it("INVITE-INT-001: 应该创建邀请记录", async () => {
    console.log("[TEST] 测试创建邀请记录");

    const inviteeId = await createInvitee("ie1");
    const record = await repo.create({
      inviterUserId,
      inviteeUserId: inviteeId,
      creditsAwarded: 200,
    });
    localInviteIds.push(record.id);

    console.log("[TEST] 记录ID:", record.id);

    expect(record.id).toBeTruthy();
    expect(record.inviterUserId).toBe(inviterUserId);
    expect(record.inviteeUserId).toBe(inviteeId);
    expect(record.creditsAwarded).toBe(200);
    expect(record.status).toBe("completed");
    expect(record.createdAt).toBeInstanceOf(Date);
    console.log("[TEST] ✓ 邀请记录创建成功");
  });

  it("INVITE-INT-002: 应该统计邀请积分总数", async () => {
    console.log("[TEST] 测试统计邀请积分");

    for (let i = 0; i < 3; i++) {
      const inviteeId = await createInvitee(`s${i}`);
      const record = await repo.create({
        inviterUserId,
        inviteeUserId: inviteeId,
        creditsAwarded: 200,
      });
      localInviteIds.push(record.id);
    }

    const total = await repo.getTotalAwardedCredits(inviterUserId);

    console.log("[TEST] 总邀请积分:", total);
    expect(total).toBe(600);
    console.log("[TEST] ✓ 统计正确");
  });

  it("INVITE-INT-003: 应该统计邀请人数", async () => {
    console.log("[TEST] 测试统计邀请人数");

    for (let i = 0; i < 4; i++) {
      const inviteeId = await createInvitee(`cn${i}`);
      const record = await repo.create({
        inviterUserId,
        inviteeUserId: inviteeId,
        creditsAwarded: 200,
      });
      localInviteIds.push(record.id);
    }

    const count = await repo.getInviteCount(inviterUserId);

    console.log("[TEST] 邀请人数:", count);
    expect(count).toBe(4);
    console.log("[TEST] ✓ 统计正确");
  });

  it("INVITE-INT-004: 应该检查用户是否已被邀请", async () => {
    console.log("[TEST] 测试检查已邀请状态");

    const inviteeId = await createInvitee("ck");
    const record = await repo.create({
      inviterUserId,
      inviteeUserId: inviteeId,
      creditsAwarded: 200,
    });
    localInviteIds.push(record.id);

    const isInvited = await repo.isUserInvited(inviteeId);
    const notInvited = await repo.isUserInvited("non-existent-invitee");

    expect(isInvited).toBe(true);
    expect(notInvited).toBe(false);
    console.log("[TEST] ✓ 检查正确");
  });

  it("INVITE-INT-005: 被邀请人唯一约束", async () => {
    console.log("[TEST] 测试被邀请人唯一约束");

    const inviteeId = await createInvitee("uq");
    const anotherInviterId = await createInvitee("uq2");

    const record = await repo.create({
      inviterUserId,
      inviteeUserId: inviteeId,
      creditsAwarded: 200,
    });
    localInviteIds.push(record.id);

    // 第二次邀请同一个人应该报错
    await expect(
      repo.create({
        inviterUserId: anotherInviterId,
        inviteeUserId: inviteeId,
        creditsAwarded: 200,
      }),
    ).rejects.toThrow();

    console.log("[TEST] ✓ 唯一约束生效");
  });
});

// ============================================================================
// ModelPricingRepository 集成测试
// ============================================================================

describe("ModelPricingRepository (Integration)", () => {
  let db: Database;
  let repo: ModelPricingRepository;

  beforeAll(() => {
    console.log("[TEST] ========== 模型定价集成测试 - 连接数据库 ==========");
    db = getDatabase();
    repo = getModelPricingRepository(db);
  });

  afterEach(async () => {
    await cleanupCreditData(db);
  });

  afterAll(() => {
    console.log("[TEST] ========== 模型定价集成测试完成 ==========\n");
  });

  it("MODEL-PRICING-INT-001: 应该创建模型定价", async () => {
    console.log("[TEST] 测试创建模型定价");

    const modelId = `test-model-${Date.now()}`;
    const pricing = await repo.create({
      modelId,
      modelName: "Test Model",
      inputPrice: 300,
      outputPrice: 1500,
    });
    createdPricingIds.push(pricing.id);

    console.log("[TEST] 定价ID:", pricing.id);

    expect(pricing.id).toBeTruthy();
    expect(pricing.modelId).toBe(modelId);
    expect(pricing.inputPrice).toBe(300);
    expect(pricing.outputPrice).toBe(1500);
    expect(pricing.multiplier).toBe("1.00");
    expect(pricing.isActive).toBe(true);
    console.log("[TEST] ✓ 模型定价创建成功");
  });

  it("MODEL-PRICING-INT-002: 应该根据 modelId 查询", async () => {
    console.log("[TEST] 测试根据 modelId 查询");

    const modelId = `test-model-find-${Date.now()}`;
    const created = await repo.create({
      modelId,
      modelName: "Test Find",
      inputPrice: 100,
      outputPrice: 500,
    });
    createdPricingIds.push(created.id);

    const found = await repo.findByModelId(modelId);

    expect(found).not.toBeNull();
    expect(found!.modelId).toBe(modelId);
    expect(found!.modelName).toBe("Test Find");
    console.log("[TEST] ✓ 查询成功");
  });

  it("MODEL-PRICING-INT-003: modelId 唯一约束", async () => {
    console.log("[TEST] 测试 modelId 唯一约束");

    const modelId = `test-model-unique-${Date.now()}`;
    const pricing = await repo.create({
      modelId,
      modelName: "First",
      inputPrice: 100,
      outputPrice: 500,
    });
    createdPricingIds.push(pricing.id);

    await expect(
      repo.create({
        modelId, // 重复
        modelName: "Second",
        inputPrice: 200,
        outputPrice: 1000,
      }),
    ).rejects.toThrow();

    console.log("[TEST] ✓ 唯一约束生效");
  });

  it("MODEL-PRICING-INT-004: 应该更新倍率和价格", async () => {
    console.log("[TEST] 测试更新倍率");

    const modelId = `test-model-update-${Date.now()}`;
    const pricing = await repo.create({
      modelId,
      modelName: "Test Update",
      inputPrice: 300,
      outputPrice: 1500,
    });
    createdPricingIds.push(pricing.id);

    const updated = await repo.update(pricing.id, {
      multiplier: "2.00",
      inputPrice: 600,
    });

    expect(updated).not.toBeNull();
    expect(updated!.multiplier).toBe("2.00");
    expect(updated!.inputPrice).toBe(600);
    expect(updated!.outputPrice).toBe(1500); // 未修改
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(pricing.updatedAt.getTime());
    console.log("[TEST] ✓ 更新成功");
  });

  it("MODEL-PRICING-INT-005: 应该查询所有激活模型", async () => {
    console.log("[TEST] 测试查询激活模型");

    const ts = Date.now();
    const p1 = await repo.create({
      modelId: `test-active-${ts}-1`,
      modelName: "Active 1",
      inputPrice: 100,
      outputPrice: 500,
    });
    createdPricingIds.push(p1.id);

    const p2 = await repo.create({
      modelId: `test-active-${ts}-2`,
      modelName: "Active 2",
      inputPrice: 200,
      outputPrice: 1000,
    });
    createdPricingIds.push(p2.id);

    // 创建一个禁用的
    const p3 = await repo.create({
      modelId: `test-inactive-${ts}`,
      modelName: "Inactive",
      inputPrice: 50,
      outputPrice: 250,
    });
    createdPricingIds.push(p3.id);
    await repo.update(p3.id, { isActive: false });

    const activeList = await repo.findAllActive();
    const testActive = activeList.filter((p) => p.modelId.startsWith(`test-active-${ts}`));

    console.log("[TEST] 本次测试激活模型数:", testActive.length);
    expect(testActive.length).toBe(2);

    // 确认禁用的不在列表中
    const hasInactive = activeList.some((p) => p.modelId === `test-inactive-${ts}`);
    expect(hasInactive).toBe(false);
    console.log("[TEST] ✓ 激活过滤正确");
  });
});
