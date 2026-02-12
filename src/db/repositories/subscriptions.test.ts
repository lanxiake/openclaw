/**
 * 订阅与计费仓库测试
 *
 * 测试套餐、技能、用户技能、订阅、支付订单和优惠券的 CRUD 操作
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  CouponRepository,
  PaymentOrderRepository,
  PlanRepository,
  SkillRepository,
  SubscriptionRepository,
  UserSkillRepository,
  getCouponRepository,
  getPaymentOrderRepository,
  getPlanRepository,
  getSkillRepository,
  getSubscriptionRepository,
  getUserSkillRepository,
} from "./subscriptions.js";

// ========== PlanRepository 测试 ==========

describe("PlanRepository", () => {
  let planRepo: PlanRepository;

  beforeEach(() => {
    console.log("[TEST] ========== PlanRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    planRepo = getPlanRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== PlanRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("PLAN-CREATE-001: 应该创建套餐", async () => {
      console.log("[TEST] ========== PLAN-CREATE-001 ==========");
      const data = {
        code: "basic",
        name: "基础版",
        description: "适合个人用户",
        priceMonthly: 2900,
        priceYearly: 29000,
        tokensPerMonth: 100000,
        storageMb: 1024,
        maxDevices: 3,
        isActive: true,
        sortOrder: 1,
      };

      console.log("[TEST] 套餐数据:", JSON.stringify(data, null, 2));
      const plan = await planRepo.create(data);

      console.log("[TEST] 创建的套餐ID:", plan.id);
      console.log("[TEST] 套餐代码:", plan.code);

      expect(plan.id).toBeTruthy();
      expect(plan.code).toBe("basic");
      expect(plan.name).toBe("基础版");
      expect(plan.priceMonthly).toBe(2900);
      expect(plan.priceYearly).toBe(29000);
      expect(plan.tokensPerMonth).toBe(100000);
      expect(plan.storageMb).toBe(1024);
      expect(plan.maxDevices).toBe(3);
      expect(plan.createdAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 套餐创建成功");
    });
  });

  describe("findById", () => {
    it("PLAN-FIND-001: 应该根据ID查找套餐", async () => {
      console.log("[TEST] ========== PLAN-FIND-001 ==========");

      const created = await planRepo.create({
        code: "pro",
        name: "专业版",
        priceMonthly: 9900,
        priceYearly: 99000,
        tokensPerMonth: 500000,
        storageMb: 10240,
        maxDevices: 10,
        isActive: true,
        sortOrder: 2,
      });

      console.log("[TEST] 创建的套餐ID:", created.id);

      const found = await planRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.code).toBe("pro");
      console.log("[TEST] ✓ 套餐查找成功");
    });

    it("PLAN-FIND-002: 不存在的ID应该返回null", async () => {
      console.log("[TEST] ========== PLAN-FIND-002 ==========");

      const found = await planRepo.findById("non-existent-id");

      console.log("[TEST] 查找结果:", found);
      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findByCode", () => {
    it("PLAN-FIND-003: 应该根据代码查找套餐", async () => {
      console.log("[TEST] ========== PLAN-FIND-003 ==========");

      await planRepo.create({
        code: "enterprise",
        name: "企业版",
        priceMonthly: 29900,
        priceYearly: 299000,
        tokensPerMonth: 2000000,
        storageMb: 102400,
        maxDevices: 100,
        isActive: true,
        sortOrder: 3,
      });

      const found = await planRepo.findByCode("enterprise");

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.code).toBe("enterprise");
      expect(found?.name).toBe("企业版");
      console.log("[TEST] ✓ 代码查找成功");
    });
  });

  describe("update", () => {
    it("PLAN-UPDATE-001: 应该更新套餐信息", async () => {
      console.log("[TEST] ========== PLAN-UPDATE-001 ==========");

      const plan = await planRepo.create({
        code: "basic-update",
        name: "基础版",
        priceMonthly: 2900,
        priceYearly: 29000,
        tokensPerMonth: 100000,
        storageMb: 1024,
        maxDevices: 3,
        isActive: true,
        sortOrder: 1,
      });

      console.log("[TEST] 原价格:", plan.priceMonthly);

      const updated = await planRepo.update(plan.id, {
        priceMonthly: 3900,
        name: "基础版 Pro",
      });

      console.log("[TEST] 更新后价格:", updated?.priceMonthly);
      console.log("[TEST] 更新后名称:", updated?.name);

      expect(updated?.priceMonthly).toBe(3900);
      expect(updated?.name).toBe("基础版 Pro");
      console.log("[TEST] ✓ 套餐更新成功");
    });
  });

  describe("findActive", () => {
    it("PLAN-FIND-004: 应该获取所有激活的套餐", async () => {
      console.log("[TEST] ========== PLAN-FIND-004 ==========");

      await planRepo.create({
        code: "active1",
        name: "激活套餐1",
        priceMonthly: 1000,
        priceYearly: 10000,
        tokensPerMonth: 50000,
        storageMb: 512,
        maxDevices: 1,
        isActive: true,
        sortOrder: 1,
      });

      await planRepo.create({
        code: "inactive1",
        name: "停用套餐1",
        priceMonthly: 2000,
        priceYearly: 20000,
        tokensPerMonth: 100000,
        storageMb: 1024,
        maxDevices: 2,
        isActive: false,
        sortOrder: 2,
      });

      const activePlans = await planRepo.findActive();

      console.log("[TEST] 激活套餐数量:", activePlans.length);

      expect(activePlans.length).toBe(1);
      expect(activePlans[0].code).toBe("active1");
      console.log("[TEST] ✓ 激活套餐查找成功");
    });
  });
});

// ========== SkillRepository 测试 ==========

describe("SkillRepository", () => {
  let skillRepo: SkillRepository;

  beforeEach(() => {
    console.log("[TEST] ========== SkillRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    skillRepo = getSkillRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== SkillRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("SKILL-CREATE-001: 应该创建技能", async () => {
      console.log("[TEST] ========== SKILL-CREATE-001 ==========");

      const skill = await skillRepo.create({
        code: "ai-translate",
        name: "AI翻译",
        description: "智能翻译助手",
        type: "premium",
        price: 990,
        billingCycle: "monthly",
        isActive: true,
      });

      console.log("[TEST] 技能ID:", skill.id);
      console.log("[TEST] 技能代码:", skill.code);
      console.log("[TEST] 技能类型:", skill.type);

      expect(skill.id).toBeTruthy();
      expect(skill.code).toBe("ai-translate");
      expect(skill.name).toBe("AI翻译");
      expect(skill.type).toBe("premium");
      expect(skill.price).toBe(990);
      expect(skill.createdAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 技能创建成功");
    });
  });

  describe("findByCode", () => {
    it("SKILL-FIND-001: 应该根据代码查找技能", async () => {
      console.log("[TEST] ========== SKILL-FIND-001 ==========");

      await skillRepo.create({
        code: "ai-writer",
        name: "AI写作",
        type: "premium",
        price: 1990,
        isActive: true,
      });

      const found = await skillRepo.findByCode("ai-writer");

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.code).toBe("ai-writer");
      console.log("[TEST] ✓ 技能代码查找成功");
    });

    it("SKILL-FIND-002: 不存在的代码应该返回null", async () => {
      console.log("[TEST] ========== SKILL-FIND-002 ==========");

      const found = await skillRepo.findByCode("nonexistent");

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });
  });

  describe("findActive", () => {
    it("SKILL-FIND-003: 应该获取所有激活的技能", async () => {
      console.log("[TEST] ========== SKILL-FIND-003 ==========");

      await skillRepo.create({
        code: "active-skill",
        name: "激活技能",
        type: "builtin",
        price: 0,
        isActive: true,
      });

      await skillRepo.create({
        code: "inactive-skill",
        name: "停用技能",
        type: "addon",
        price: 500,
        isActive: false,
      });

      const activeSkills = await skillRepo.findActive();

      console.log("[TEST] 激活技能数量:", activeSkills.length);

      expect(activeSkills.length).toBe(1);
      expect(activeSkills[0].code).toBe("active-skill");
      console.log("[TEST] ✓ 激活技能查找成功");
    });
  });

  describe("findByType", () => {
    it("SKILL-FIND-004: 应该根据类型查找技能", async () => {
      console.log("[TEST] ========== SKILL-FIND-004 ==========");

      await skillRepo.create({
        code: "builtin1",
        name: "内置技能1",
        type: "builtin",
        price: 0,
        isActive: true,
      });

      await skillRepo.create({
        code: "premium1",
        name: "付费技能1",
        type: "premium",
        price: 990,
        isActive: true,
      });

      await skillRepo.create({
        code: "builtin-inactive",
        name: "内置停用技能",
        type: "builtin",
        price: 0,
        isActive: false,
      });

      const builtinSkills = await skillRepo.findByType("builtin");

      console.log("[TEST] 内置激活技能数量:", builtinSkills.length);

      // 只有激活的内置技能（不包含已停用的）
      expect(builtinSkills.length).toBe(1);
      expect(builtinSkills[0].code).toBe("builtin1");
      console.log("[TEST] ✓ 类型查找成功");
    });
  });
});

// ========== UserSkillRepository 测试 ==========

describe("UserSkillRepository", () => {
  let userSkillRepo: UserSkillRepository;

  beforeEach(() => {
    console.log("[TEST] ========== UserSkillRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    userSkillRepo = getUserSkillRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== UserSkillRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("addSkill", () => {
    it("USKILL-ADD-001: 应该为用户添加技能", async () => {
      console.log("[TEST] ========== USKILL-ADD-001 ==========");

      const userId = "user-1";
      const skillId = "skill-1";

      const userSkill = await userSkillRepo.addSkill(userId, skillId);

      console.log("[TEST] 用户技能ID:", userSkill.id);
      console.log("[TEST] 用户ID:", userSkill.userId);
      console.log("[TEST] 技能ID:", userSkill.skillId);
      console.log("[TEST] 是否激活:", userSkill.isActive);

      expect(userSkill.id).toBeTruthy();
      expect(userSkill.userId).toBe(userId);
      expect(userSkill.skillId).toBe(skillId);
      expect(userSkill.isActive).toBe(true);
      expect(userSkill.purchasedAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 用户技能添加成功");
    });

    it("USKILL-ADD-002: 应该支持设置过期时间", async () => {
      console.log("[TEST] ========== USKILL-ADD-002 ==========");

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天后
      const userSkill = await userSkillRepo.addSkill("user-2", "skill-2", expiresAt);

      console.log("[TEST] 过期时间:", userSkill.expiresAt);

      expect(userSkill.expiresAt).toEqual(expiresAt);
      console.log("[TEST] ✓ 过期时间设置成功");
    });
  });

  describe("findByUserId", () => {
    it("USKILL-FIND-001: 应该获取用户的所有技能", async () => {
      console.log("[TEST] ========== USKILL-FIND-001 ==========");

      const userId = "user-3";
      await userSkillRepo.addSkill(userId, "skill-a");
      await userSkillRepo.addSkill(userId, "skill-b");
      await userSkillRepo.addSkill("other-user", "skill-c");

      const skills = await userSkillRepo.findByUserId(userId);

      console.log("[TEST] 用户技能数量:", skills.length);

      expect(skills.length).toBe(2);
      expect(skills.every((s) => s.userId === userId)).toBe(true);
      console.log("[TEST] ✓ 用户技能查找成功");
    });
  });

  describe("deactivate", () => {
    it("USKILL-DEACT-001: 应该停用用户技能", async () => {
      console.log("[TEST] ========== USKILL-DEACT-001 ==========");

      const userId = "user-4";
      const skillId = "skill-deact";
      await userSkillRepo.addSkill(userId, skillId);

      await userSkillRepo.deactivate(userId, skillId);

      // 再次查找确认已停用
      const skills = await userSkillRepo.findByUserId(userId);
      const deactivated = skills.find((s) => s.skillId === skillId);

      console.log("[TEST] 停用后状态:", deactivated?.isActive);

      expect(deactivated?.isActive).toBe(false);
      console.log("[TEST] ✓ 用户技能停用成功");
    });
  });
});

// ========== SubscriptionRepository 测试 ==========

describe("SubscriptionRepository", () => {
  let subRepo: SubscriptionRepository;

  beforeEach(() => {
    console.log("[TEST] ========== SubscriptionRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    subRepo = getSubscriptionRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== SubscriptionRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("SUB-CREATE-001: 应该创建订阅", async () => {
      console.log("[TEST] ========== SUB-CREATE-001 ==========");

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const sub = await subRepo.create({
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      console.log("[TEST] 订阅ID:", sub.id);
      console.log("[TEST] 状态:", sub.status);
      console.log("[TEST] 计费周期:", sub.billingCycle);

      expect(sub.id).toBeTruthy();
      expect(sub.userId).toBe("user-1");
      expect(sub.planId).toBe("plan-1");
      expect(sub.status).toBe("active");
      expect(sub.billingCycle).toBe("monthly");
      expect(sub.createdAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 订阅创建成功");
    });
  });

  describe("findById", () => {
    it("SUB-FIND-001: 应该根据ID查找订阅", async () => {
      console.log("[TEST] ========== SUB-FIND-001 ==========");

      const now = new Date();
      const created = await subRepo.create({
        userId: "user-2",
        planId: "plan-1",
        status: "active",
        billingCycle: "yearly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      });

      const found = await subRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.billingCycle).toBe("yearly");
      console.log("[TEST] ✓ 订阅查找成功");
    });

    it("SUB-FIND-002: 不存在的ID应该返回null", async () => {
      console.log("[TEST] ========== SUB-FIND-002 ==========");

      const found = await subRepo.findById("non-existent");

      expect(found).toBeNull();
      console.log("[TEST] ✓ 正确返回null");
    });

    it("SUB-FIND-003: 不传 userId 时向后兼容 - 返回任意用户的订阅", async () => {
      console.log("[TEST] ========== SUB-FIND-003 ==========");
      console.log("[TEST] 测试 findById 不传 userId（向后兼容）");

      const now = new Date();
      const created = await subRepo.create({
        userId: "user-compat",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      // 不传 userId，行为与改造前一致
      const found = await subRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.userId).toBe("user-compat");
      console.log("[TEST] ✓ 不传 userId 时向后兼容正常");
    });

    it("SUB-FIND-004: 传 userId 且匹配时正确返回订阅", async () => {
      console.log("[TEST] ========== SUB-FIND-004 ==========");
      console.log("[TEST] 测试 findById 传 userId 且匹配");

      const now = new Date();
      const created = await subRepo.create({
        userId: "user-owner",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      // 传正确的 userId
      const found = await subRepo.findById(created.id, "user-owner");

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.userId).toBe("user-owner");
      console.log("[TEST] ✓ 传匹配 userId 时正确返回");
    });

    it("SUB-FIND-005: 传 userId 但不匹配时返回 null", async () => {
      console.log("[TEST] ========== SUB-FIND-005 ==========");
      console.log("[TEST] 测试 findById 传 userId 但属于其他用户");

      const now = new Date();
      const created = await subRepo.create({
        userId: "user-real-owner",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      // 传不同的 userId，模拟其他用户试图访问
      const found = await subRepo.findById(created.id, "user-attacker");

      console.log("[TEST] 查找结果:", found);

      expect(found).toBeNull();
      console.log("[TEST] ✓ 传不匹配 userId 时正确返回 null（多租户隔离）");
    });
  });

  describe("findByUserId", () => {
    it("SUB-FIND-003: 应该获取用户所有订阅历史", async () => {
      console.log("[TEST] ========== SUB-FIND-003 ==========");

      const now = new Date();
      const userId = "user-history";

      await subRepo.create({
        userId,
        planId: "plan-1",
        status: "expired",
        billingCycle: "monthly",
        currentPeriodStart: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      });

      await subRepo.create({
        userId,
        planId: "plan-2",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      await subRepo.create({
        userId: "other-user",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const subs = await subRepo.findByUserId(userId);

      console.log("[TEST] 用户订阅数量:", subs.length);

      expect(subs.length).toBe(2);
      expect(subs.every((s) => s.userId === userId)).toBe(true);
      console.log("[TEST] ✓ 用户订阅历史查找成功");
    });
  });

  describe("updateStatus", () => {
    it("SUB-STATUS-001: 应该更新订阅状态", async () => {
      console.log("[TEST] ========== SUB-STATUS-001 ==========");

      const now = new Date();
      const sub = await subRepo.create({
        userId: "user-status",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      console.log("[TEST] 原始状态:", sub.status);

      await subRepo.updateStatus(sub.id, "expired");

      const updated = await subRepo.findById(sub.id);

      console.log("[TEST] 更新后状态:", updated?.status);

      expect(updated?.status).toBe("expired");
      console.log("[TEST] ✓ 订阅状态更新成功");
    });
  });

  describe("cancel", () => {
    it("SUB-CANCEL-001: 应该取消订阅", async () => {
      console.log("[TEST] ========== SUB-CANCEL-001 ==========");

      const now = new Date();
      const sub = await subRepo.create({
        userId: "user-cancel",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      await subRepo.cancel(sub.id, "不再需要");

      const canceled = await subRepo.findById(sub.id);

      console.log("[TEST] 取消后状态:", canceled?.status);
      console.log("[TEST] 取消原因:", canceled?.cancelReason);
      console.log("[TEST] 取消时间:", canceled?.canceledAt);

      expect(canceled?.status).toBe("canceled");
      expect(canceled?.cancelReason).toBe("不再需要");
      expect(canceled?.canceledAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 订阅取消成功");
    });
  });

  describe("renew", () => {
    it("SUB-RENEW-001: 应该续期订阅", async () => {
      console.log("[TEST] ========== SUB-RENEW-001 ==========");

      const now = new Date();
      const sub = await subRepo.create({
        userId: "user-renew",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const newPeriodEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const renewed = await subRepo.renew(sub.id, newPeriodEnd);

      console.log("[TEST] 续期后状态:", renewed?.status);
      console.log("[TEST] 新周期结束:", renewed?.currentPeriodEnd);

      expect(renewed).toBeTruthy();
      expect(renewed?.status).toBe("active");
      expect(renewed?.currentPeriodEnd).toEqual(newPeriodEnd);
      console.log("[TEST] ✓ 订阅续期成功");
    });
  });

  describe("update", () => {
    it("SUB-UPDATE-001: 应该更新订阅字段", async () => {
      console.log("[TEST] ========== SUB-UPDATE-001 ==========");

      const now = new Date();
      const sub = await subRepo.create({
        userId: "user-upd",
        planId: "plan-1",
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const updated = await subRepo.update(sub.id, {
        externalSubscriptionId: "ext-sub-123",
      });

      console.log("[TEST] 外部订阅ID:", updated?.externalSubscriptionId);

      expect(updated?.externalSubscriptionId).toBe("ext-sub-123");
      console.log("[TEST] ✓ 订阅更新成功");
    });
  });
});

// ========== PaymentOrderRepository 测试 ==========

describe("PaymentOrderRepository", () => {
  let orderRepo: PaymentOrderRepository;

  beforeEach(() => {
    console.log("[TEST] ========== PaymentOrderRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    orderRepo = getPaymentOrderRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== PaymentOrderRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("ORDER-CREATE-001: 应该创建支付订单", async () => {
      console.log("[TEST] ========== ORDER-CREATE-001 ==========");

      const order = await orderRepo.create({
        userId: "user-1",
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "pending",
        paymentMethod: "wechat",
      });

      console.log("[TEST] 订单ID:", order.id);
      console.log("[TEST] 订单号:", order.orderNo);
      console.log("[TEST] 金额:", order.amount);
      console.log("[TEST] 支付状态:", order.paymentStatus);

      expect(order.id).toBeTruthy();
      expect(order.orderNo).toBeTruthy();
      expect(order.orderNo).toMatch(/^ORD/);
      expect(order.amount).toBe(2900);
      expect(order.paymentStatus).toBe("pending");
      expect(order.createdAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 支付订单创建成功");
    });
  });

  describe("findById", () => {
    it("ORDER-FIND-001: 应该根据ID查找订单", async () => {
      console.log("[TEST] ========== ORDER-FIND-001 ==========");

      const created = await orderRepo.create({
        userId: "user-2",
        orderType: "skill",
        amount: 990,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 990,
        paymentStatus: "pending",
      });

      const found = await orderRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.orderType).toBe("skill");
      console.log("[TEST] ✓ 订单查找成功");
    });
  });

  describe("findByOrderNo", () => {
    it("ORDER-FIND-002: 应该根据订单号查找订单", async () => {
      console.log("[TEST] ========== ORDER-FIND-002 ==========");

      const created = await orderRepo.create({
        userId: "user-3",
        orderType: "tokens",
        amount: 5000,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 5000,
        paymentStatus: "pending",
      });

      console.log("[TEST] 订单号:", created.orderNo);

      const found = await orderRepo.findByOrderNo(created.orderNo);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.orderNo).toBe(created.orderNo);
      console.log("[TEST] ✓ 订单号查找成功");
    });
  });

  describe("markPaid", () => {
    it("ORDER-PAY-001: 应该标记订单为已支付", async () => {
      console.log("[TEST] ========== ORDER-PAY-001 ==========");

      const order = await orderRepo.create({
        userId: "user-pay",
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "pending",
      });

      console.log("[TEST] 支付前状态:", order.paymentStatus);

      const paid = await orderRepo.markPaid(order.id, "wx-pay-123456");

      console.log("[TEST] 支付后状态:", paid?.paymentStatus);
      console.log("[TEST] 外部支付ID:", paid?.externalPaymentId);

      expect(paid?.paymentStatus).toBe("paid");
      expect(paid?.externalPaymentId).toBe("wx-pay-123456");
      expect(paid?.paidAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 订单支付标记成功");
    });
  });

  describe("markFailed", () => {
    it("ORDER-FAIL-001: 应该标记订单为支付失败", async () => {
      console.log("[TEST] ========== ORDER-FAIL-001 ==========");

      const order = await orderRepo.create({
        userId: "user-fail",
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "pending",
      });

      await orderRepo.markFailed(order.id);

      const failed = await orderRepo.findById(order.id);

      console.log("[TEST] 失败后状态:", failed?.paymentStatus);

      expect(failed?.paymentStatus).toBe("failed");
      console.log("[TEST] ✓ 订单失败标记成功");
    });
  });

  describe("refund", () => {
    it("ORDER-REFUND-001: 应该处理退款", async () => {
      console.log("[TEST] ========== ORDER-REFUND-001 ==========");

      const order = await orderRepo.create({
        userId: "user-refund",
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "paid",
      });

      await orderRepo.refund(order.id, 2900);

      const refunded = await orderRepo.findById(order.id);

      console.log("[TEST] 退款后状态:", refunded?.paymentStatus);
      console.log("[TEST] 退款金额:", refunded?.refundAmount);

      expect(refunded?.paymentStatus).toBe("refunded");
      expect(refunded?.refundAmount).toBe(2900);
      expect(refunded?.refundedAt).toBeInstanceOf(Date);
      console.log("[TEST] ✓ 退款处理成功");
    });
  });

  describe("cancel", () => {
    it("ORDER-CANCEL-001: 应该取消订单", async () => {
      console.log("[TEST] ========== ORDER-CANCEL-001 ==========");

      const order = await orderRepo.create({
        userId: "user-cancel-order",
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "pending",
      });

      await orderRepo.cancel(order.id);

      const canceled = await orderRepo.findById(order.id);

      console.log("[TEST] 取消后状态:", canceled?.paymentStatus);

      expect(canceled?.paymentStatus).toBe("canceled");
      console.log("[TEST] ✓ 订单取消成功");
    });
  });

  describe("findByUserId", () => {
    it("ORDER-FIND-003: 应该获取用户订单历史", async () => {
      console.log("[TEST] ========== ORDER-FIND-003 ==========");

      const userId = "user-order-history";

      await orderRepo.create({
        userId,
        orderType: "subscription",
        amount: 2900,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 2900,
        paymentStatus: "paid",
      });

      await orderRepo.create({
        userId,
        orderType: "skill",
        amount: 990,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 990,
        paymentStatus: "pending",
      });

      await orderRepo.create({
        userId: "other-user",
        orderType: "tokens",
        amount: 5000,
        currency: "CNY",
        discountAmount: 0,
        paidAmount: 5000,
        paymentStatus: "paid",
      });

      const orders = await orderRepo.findByUserId(userId);

      console.log("[TEST] 用户订单数量:", orders.length);

      expect(orders.length).toBe(2);
      expect(orders.every((o) => o.userId === userId)).toBe(true);
      console.log("[TEST] ✓ 用户订单历史查找成功");
    });
  });
});

// ========== CouponRepository 测试 ==========

describe("CouponRepository", () => {
  let couponRepo: CouponRepository;

  beforeEach(() => {
    console.log("[TEST] ========== CouponRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    couponRepo = getCouponRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== CouponRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("calculateDiscount", () => {
    it("COUPON-CALC-001: 应该正确计算百分比折扣", () => {
      console.log("[TEST] ========== COUPON-CALC-001 ==========");

      const coupon = {
        id: "c1",
        code: "SAVE20",
        discountType: "percentage" as const,
        discountValue: 20,
        minAmount: 0,
        maxDiscount: null,
        applicablePlans: null,
        applicableSkills: null,
        totalLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
      };

      const discount = couponRepo.calculateDiscount(coupon, 10000);

      console.log("[TEST] 订单金额: 10000分");
      console.log("[TEST] 折扣比例: 20%");
      console.log("[TEST] 折扣金额:", discount);

      expect(discount).toBe(2000); // 10000 * 20% = 2000
      console.log("[TEST] ✓ 百分比折扣计算正确");
    });

    it("COUPON-CALC-002: 应该正确计算固定金额折扣", () => {
      console.log("[TEST] ========== COUPON-CALC-002 ==========");

      const coupon = {
        id: "c2",
        code: "FLAT500",
        discountType: "fixed" as const,
        discountValue: 500,
        minAmount: 0,
        maxDiscount: null,
        applicablePlans: null,
        applicableSkills: null,
        totalLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
      };

      const discount = couponRepo.calculateDiscount(coupon, 2900);

      console.log("[TEST] 订单金额: 2900分");
      console.log("[TEST] 固定折扣: 500分");
      console.log("[TEST] 折扣金额:", discount);

      expect(discount).toBe(500);
      console.log("[TEST] ✓ 固定金额折扣计算正确");
    });

    it("COUPON-CALC-003: 折扣不应超过订单金额", () => {
      console.log("[TEST] ========== COUPON-CALC-003 ==========");

      const coupon = {
        id: "c3",
        code: "BIGFLAT",
        discountType: "fixed" as const,
        discountValue: 5000,
        minAmount: 0,
        maxDiscount: null,
        applicablePlans: null,
        applicableSkills: null,
        totalLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
      };

      const discount = couponRepo.calculateDiscount(coupon, 2900);

      console.log("[TEST] 订单金额: 2900分");
      console.log("[TEST] 固定折扣: 5000分");
      console.log("[TEST] 实际折扣:", discount);

      expect(discount).toBe(2900); // 不超过订单金额
      console.log("[TEST] ✓ 折扣上限正确");
    });

    it("COUPON-CALC-004: 应该应用最大折扣限制", () => {
      console.log("[TEST] ========== COUPON-CALC-004 ==========");

      const coupon = {
        id: "c4",
        code: "SAVE50MAX",
        discountType: "percentage" as const,
        discountValue: 50,
        minAmount: 0,
        maxDiscount: 3000, // 最大折扣 3000分
        applicablePlans: null,
        applicableSkills: null,
        totalLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        startsAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
      };

      const discount = couponRepo.calculateDiscount(coupon, 10000);

      console.log("[TEST] 订单金额: 10000分");
      console.log("[TEST] 折扣比例: 50%");
      console.log("[TEST] 最大折扣: 3000分");
      console.log("[TEST] 实际折扣:", discount);

      // 50% * 10000 = 5000, 但 maxDiscount = 3000
      expect(discount).toBe(3000);
      console.log("[TEST] ✓ 最大折扣限制正确");
    });
  });

  describe("validate", () => {
    it("COUPON-VALID-001: 不存在的优惠券应返回无效", async () => {
      console.log("[TEST] ========== COUPON-VALID-001 ==========");

      const result = await couponRepo.validate("NONEXISTENT", "user-1", 10000);

      console.log("[TEST] 验证结果:", JSON.stringify(result));

      expect(result.valid).toBe(false);
      expect(result.error).toBe("优惠券不存在");
      console.log("[TEST] ✓ 不存在优惠券验证正确");
    });
  });
});
