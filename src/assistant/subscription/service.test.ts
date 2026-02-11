/**
 * 订阅服务测试
 *
 * 测试订阅管理、配额检查、使用量追踪等核心功能
 * 订阅服务基于文件系统存储，测试使用临时目录
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getUserSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  getUserDailyUsage,
  getUserMonthlyUsage,
  incrementUsage,
  checkQuota,
  getAllPlans,
  getPlan,
  comparePlans,
  canUpgrade,
  canDowngrade,
  isSubscriptionActive,
} from "./service.js";
import type { UserSubscription } from "./types.js";

/**
 * 重置订阅服务内部缓存
 *
 * 订阅服务使用模块级变量缓存数据，需要在每个测试之间重置
 */
async function resetServiceCache(): Promise<void> {
  // 动态导入后修改模块内部状态
  // 通过 vi.resetModules() 实现
}

describe("SubscriptionService - 获取订阅", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    // 重置模块缓存，让每个测试使用新的内存状态
    vi.resetModules();

    // 使用临时目录避免污染用户数据
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    // 恢复环境变量
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;

    // 清理临时目录
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SUB-GET-001: 新用户无订阅应返回 null", async () => {
    // 重新导入模块以获取新的缓存实例
    const { getUserSubscription: getSub } = await import("./service.js");
    const result = await getSub("user-new-001");
    expect(result).toBeNull();
  });

  it("SUB-GET-002: 获取有效订阅", async () => {
    const { createSubscription: create, getUserSubscription: getSub } =
      await import("./service.js");

    // 创建订阅
    const sub = await create({
      userId: "user-get-001",
      planId: "pro",
      billingPeriod: "monthly",
    });

    // 获取订阅
    const result = await getSub("user-get-001");

    expect(result).not.toBeNull();
    expect(result!.id).toBe(sub.id);
    expect(result!.planId).toBe("pro");
    expect(result!.status).toBe("active");
    expect(result!.billingPeriod).toBe("monthly");
  });
});

describe("SubscriptionService - 创建订阅", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SUB-CREATE-001: 创建月订阅成功", async () => {
    const { createSubscription: create } = await import("./service.js");

    const sub = await create({
      userId: "user-create-001",
      planId: "pro",
      billingPeriod: "monthly",
    });

    expect(sub).toBeDefined();
    expect(sub.userId).toBe("user-create-001");
    expect(sub.planId).toBe("pro");
    expect(sub.status).toBe("active");
    expect(sub.billingPeriod).toBe("monthly");
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.id).toContain("sub_");
    expect(sub.currentPeriodStart).toBeDefined();
    expect(sub.currentPeriodEnd).toBeDefined();

    // 验证周期结束时间约为 1 个月后
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it("SUB-CREATE-002: 创建年订阅成功", async () => {
    const { createSubscription: create } = await import("./service.js");

    const sub = await create({
      userId: "user-create-002",
      planId: "team",
      billingPeriod: "yearly",
    });

    expect(sub.billingPeriod).toBe("yearly");

    // 验证周期结束时间约为 1 年后
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(365);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it("SUB-CREATE-003: 创建试用订阅", async () => {
    const { createSubscription: create } = await import("./service.js");

    const sub = await create({
      userId: "user-create-003",
      planId: "pro",
      billingPeriod: "monthly",
      startTrial: true,
    });

    expect(sub.status).toBe("trialing");
    expect(sub.trialEnd).toBeDefined();

    // 试用期 7 天
    const now = new Date();
    const trialEnd = new Date(sub.trialEnd!);
    const diffDays = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("SUB-CREATE-004: 终身订阅应设置超长过期时间", async () => {
    const { createSubscription: create } = await import("./service.js");

    const sub = await create({
      userId: "user-create-004",
      planId: "pro",
      billingPeriod: "lifetime",
    });

    expect(sub.billingPeriod).toBe("lifetime");

    // 验证过期时间为 100 年后
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    expect(diffYears).toBeGreaterThanOrEqual(99);
  });

  it("SUB-CREATE-005: 用户已有活跃订阅时应抛出错误", async () => {
    const { createSubscription: create } = await import("./service.js");

    // 先创建一个订阅
    await create({
      userId: "user-create-005",
      planId: "pro",
      billingPeriod: "monthly",
    });

    // 尝试再次创建应抛出错误
    await expect(
      create({
        userId: "user-create-005",
        planId: "team",
        billingPeriod: "monthly",
      }),
    ).rejects.toThrow("已有活跃订阅");
  });
});

describe("SubscriptionService - 更新订阅", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SUB-UPDATE-001: 更新订阅计划", async () => {
    const { createSubscription: create, updateSubscription: update } = await import("./service.js");

    const sub = await create({
      userId: "user-update-001",
      planId: "pro",
      billingPeriod: "monthly",
    });

    const updated = await update({
      subscriptionId: sub.id,
      planId: "team",
    });

    expect(updated.planId).toBe("team");
    expect(updated.id).toBe(sub.id);
  });

  it("SUB-UPDATE-002: 更新订阅不存在时应抛出错误", async () => {
    const { updateSubscription: update } = await import("./service.js");

    await expect(
      update({
        subscriptionId: "non-existent-id",
        planId: "team",
      }),
    ).rejects.toThrow("订阅不存在");
  });

  it("SUB-UPDATE-003: 设置周期结束时取消", async () => {
    const { createSubscription: create, updateSubscription: update } = await import("./service.js");

    const sub = await create({
      userId: "user-update-003",
      planId: "pro",
      billingPeriod: "monthly",
    });

    const updated = await update({
      subscriptionId: sub.id,
      cancelAtPeriodEnd: true,
    });

    expect(updated.cancelAtPeriodEnd).toBe(true);
  });
});

describe("SubscriptionService - 取消订阅", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SUB-CANCEL-001: 立即取消订阅", async () => {
    const { createSubscription: create, cancelSubscription: cancel } = await import("./service.js");

    const sub = await create({
      userId: "user-cancel-001",
      planId: "pro",
      billingPeriod: "monthly",
    });

    const canceled = await cancel({
      subscriptionId: sub.id,
      immediately: true,
      reason: "不需要了",
    });

    expect(canceled.status).toBe("canceled");
    expect(canceled.canceledAt).toBeDefined();
  });

  it("SUB-CANCEL-002: 周期结束时取消", async () => {
    const { createSubscription: create, cancelSubscription: cancel } = await import("./service.js");

    const sub = await create({
      userId: "user-cancel-002",
      planId: "pro",
      billingPeriod: "monthly",
    });

    const canceled = await cancel({
      subscriptionId: sub.id,
      immediately: false,
    });

    expect(canceled.status).toBe("active"); // 仍然活跃
    expect(canceled.cancelAtPeriodEnd).toBe(true);
  });

  it("SUB-CANCEL-003: 取消不存在的订阅应抛出错误", async () => {
    const { cancelSubscription: cancel } = await import("./service.js");

    await expect(
      cancel({
        subscriptionId: "non-existent-id",
        immediately: true,
      }),
    ).rejects.toThrow("订阅不存在");
  });
});

describe("SubscriptionService - 续订", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("SUB-RENEW-001: 续订月订阅", async () => {
    const { createSubscription: create, renewSubscription: renew } = await import("./service.js");

    const sub = await create({
      userId: "user-renew-001",
      planId: "pro",
      billingPeriod: "monthly",
    });

    // 保存旧周期结束时间（renewSubscription 会 mutate 原对象）
    const oldPeriodEnd = sub.currentPeriodEnd;

    const renewed = await renew(sub.id);

    expect(renewed.status).toBe("active");
    // 新周期开始时间应该等于旧周期结束时间
    expect(renewed.currentPeriodStart).toBe(oldPeriodEnd);
    expect(renewed.cancelAtPeriodEnd).toBe(false);
  });

  it("SUB-RENEW-002: 续订不存在的订阅应抛出错误", async () => {
    const { renewSubscription: renew } = await import("./service.js");

    await expect(renew("non-existent-id")).rejects.toThrow("订阅不存在");
  });
});

describe("SubscriptionService - 配额检查", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("QUOTA-CHECK-001: 免费用户对话配额", async () => {
    const { checkQuota: check } = await import("./service.js");

    // 未订阅用户使用免费计划
    const result = await check("user-quota-001", "conversations");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(20); // 免费计划每日 20 次
    expect(result.current).toBe(0);
    expect(result.remaining).toBe(20);
  });

  it("QUOTA-CHECK-002: Pro 用户无限对话", async () => {
    const { createSubscription: create, checkQuota: check } = await import("./service.js");

    // 创建 Pro 订阅
    await create({
      userId: "user-quota-002",
      planId: "pro",
      billingPeriod: "monthly",
    });

    const result = await check("user-quota-002", "conversations");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1); // 无限
    expect(result.remaining).toBe(-1);
  });

  it("QUOTA-CHECK-003: 使用量耗尽时应拒绝", async () => {
    const { incrementUsage: inc, checkQuota: check } = await import("./service.js");

    // 模拟消耗 20 次对话（免费计划上限）
    for (let i = 0; i < 20; i++) {
      await inc("user-quota-003", "conversations");
    }

    const result = await check("user-quota-003", "conversations");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(20);
    expect(result.limit).toBe(20);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain("配额上限");
  });
});

describe("SubscriptionService - 使用量追踪", () => {
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    process.env.USERPROFILE = originalHome;
    const fs = await import("node:fs");
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("USAGE-001: 初始使用量为零", async () => {
    const { getUserDailyUsage: daily } = await import("./service.js");

    const usage = await daily("user-usage-001");

    expect(usage.conversations).toBe(0);
    expect(usage.aiCalls).toBe(0);
    expect(usage.skillExecutions).toBe(0);
    expect(usage.fileOperations).toBe(0);
    expect(usage.storageUsedMb).toBe(0);
  });

  it("USAGE-002: 增加使用量应正确累计", async () => {
    const {
      incrementUsage: inc,
      getUserDailyUsage: daily,
      getUserMonthlyUsage: monthly,
    } = await import("./service.js");

    await inc("user-usage-002", "conversations", 3);
    await inc("user-usage-002", "aiCalls", 5);

    const dailyUsage = await daily("user-usage-002");
    expect(dailyUsage.conversations).toBe(3);
    expect(dailyUsage.aiCalls).toBe(5);

    const monthlyUsage = await monthly("user-usage-002");
    expect(monthlyUsage.conversations).toBe(3);
    expect(monthlyUsage.aiCalls).toBe(5);
  });

  it("USAGE-003: 多次增加应累计", async () => {
    const { incrementUsage: inc, getUserDailyUsage: daily } = await import("./service.js");

    await inc("user-usage-003", "conversations");
    await inc("user-usage-003", "conversations");
    await inc("user-usage-003", "conversations");

    const usage = await daily("user-usage-003");
    expect(usage.conversations).toBe(3);
  });
});

describe("SubscriptionService - 计划查询", () => {
  it("PLAN-001: 获取所有计划", () => {
    const plans = getAllPlans();
    expect(plans.length).toBe(4);
    expect(plans[0].id).toBe("free");
    expect(plans[1].id).toBe("pro");
    expect(plans[2].id).toBe("team");
    expect(plans[3].id).toBe("enterprise");
  });

  it("PLAN-002: 获取指定计划", () => {
    const plan = getPlan("pro");
    expect(plan).not.toBeNull();
    expect(plan!.name).toBe("专业版");
    expect(plan!.recommended).toBe(true);
  });

  it("PLAN-003: 获取不存在的计划返回 null", () => {
    const plan = getPlan("nonexistent" as never);
    expect(plan).toBeNull();
  });

  it("PLAN-004: 比较计划", () => {
    expect(comparePlans("free", "pro")).toBeLessThan(0);
    expect(comparePlans("pro", "free")).toBeGreaterThan(0);
    expect(comparePlans("pro", "pro")).toBe(0);
  });

  it("PLAN-005: 检查升级", () => {
    expect(canUpgrade("free", "pro")).toBe(true);
    expect(canUpgrade("pro", "free")).toBe(false);
    expect(canUpgrade("pro", "team")).toBe(true);
  });

  it("PLAN-006: 检查降级", () => {
    expect(canDowngrade("pro", "free")).toBe(true);
    expect(canDowngrade("free", "pro")).toBe(false);
    expect(canDowngrade("team", "pro")).toBe(true);
  });
});

describe("SubscriptionService - 订阅状态检查", () => {
  it("ACTIVE-001: 活跃订阅应返回 true", () => {
    const sub: UserSubscription = {
      id: "sub-1",
      userId: "user-1",
      planId: "pro",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionActive(sub)).toBe(true);
  });

  it("ACTIVE-002: 已取消订阅应返回 false", () => {
    const sub: UserSubscription = {
      id: "sub-2",
      userId: "user-2",
      planId: "pro",
      status: "canceled",
      billingPeriod: "monthly",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionActive(sub)).toBe(false);
  });

  it("ACTIVE-003: 已过期订阅应返回 false", () => {
    const sub: UserSubscription = {
      id: "sub-3",
      userId: "user-3",
      planId: "pro",
      status: "active",
      billingPeriod: "monthly",
      currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() - 1000).toISOString(), // 已过期
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionActive(sub)).toBe(false);
  });

  it("ACTIVE-004: 试用中订阅应返回 true", () => {
    const sub: UserSubscription = {
      id: "sub-4",
      userId: "user-4",
      planId: "pro",
      status: "trialing",
      billingPeriod: "monthly",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionActive(sub)).toBe(true);
  });
});
