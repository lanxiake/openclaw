/**
 * PostgreSQL 画像记忆提供者集成测试
 *
 * 使用真实 PostgreSQL 数据库验证 Profile Provider 的完整 CRUD 流程。
 * 测试覆盖事实管理、偏好管理、行为模式三大功能模块。
 *
 * @module memory/pluggable/providers/profile
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getDatabase } from "../../../../db/connection.js";
import type { Database } from "../../../../db/connection.js";
import {
  userFacts,
  userPreferencesV2,
  behaviorPatterns,
} from "../../../../db/schema/profile-memory.js";
import { getUserRepository, type UserRepository } from "../../../../db/repositories/users.js";
import { PostgresProfileMemoryProvider } from "./postgres.js";

// ==================== 测试常量 ====================

/** 测试用户 ID（运行时由 beforeAll 创建真实用户后填入） */
let TEST_USER_ID: string;

// ==================== 测试 ====================

describe("PostgresProfileMemoryProvider (Integration)", () => {
  let db: Database;
  let provider: PostgresProfileMemoryProvider;
  let userRepo: UserRepository;

  /** 追踪创建的 fact ID，用于清理 */
  const createdFactIds: string[] = [];
  /** 追踪创建的 pattern ID，用于清理 */
  const createdPatternIds: string[] = [];

  beforeAll(async () => {
    console.log("[TEST] ========== 连接真实数据库 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);

    // 创建测试用户（外键约束要求）
    const testUser = await userRepo.create({
      phone: `+86139${Date.now().toString().slice(-8)}`,
      email: `test-profile-${Date.now()}@example.com`,
      passwordHash: "TestPassword@123",
      isActive: true,
    });
    TEST_USER_ID = testUser.id;
    console.log("[TEST] ✓ 测试用户已创建, ID:", TEST_USER_ID);

    provider = new PostgresProfileMemoryProvider({ db });
    await provider.initialize();
    console.log("[TEST] ✓ PostgresProfileMemoryProvider 初始化成功");
  });

  afterEach(async () => {
    // 清理 facts
    for (const id of createdFactIds) {
      try {
        await db.delete(userFacts).where(eq(userFacts.id, id));
      } catch (error) {
        // 忽略
      }
    }
    createdFactIds.length = 0;

    // 清理 patterns
    for (const id of createdPatternIds) {
      try {
        await db.delete(behaviorPatterns).where(eq(behaviorPatterns.id, id));
      } catch (error) {
        // 忽略
      }
    }
    createdPatternIds.length = 0;

    // 清理 preferences（按 userId）
    try {
      await db.delete(userPreferencesV2).where(eq(userPreferencesV2.userId, TEST_USER_ID));
    } catch (error) {
      // 忽略
    }
  });

  afterAll(async () => {
    // 最终清理：按 userId 删除所有关联数据
    try {
      await db.delete(userFacts).where(eq(userFacts.userId, TEST_USER_ID));
      await db.delete(behaviorPatterns).where(eq(behaviorPatterns.userId, TEST_USER_ID));
      await db.delete(userPreferencesV2).where(eq(userPreferencesV2.userId, TEST_USER_ID));
    } catch (error) {
      // 忽略
    }

    // 清理测试用户
    try {
      await userRepo.hardDelete(TEST_USER_ID);
    } catch (error) {
      // 忽略
    }

    await provider.shutdown();
    console.log("[TEST] ========== Profile 集成测试完成 ==========\n");
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("PROFILE-INT-001: 初始化后健康检查应返回 healthy", async () => {
      console.log("[TEST] ========== PROFILE-INT-001 ==========");

      const health = await provider.healthCheck();

      console.log("[TEST] 健康状态:", health.status);
      expect(health.status).toBe("healthy");
      console.log("[TEST] ✓ 健康检查通过");
    });
  });

  // ==================== 事实管理 ====================

  describe("事实管理", () => {
    it("PROFILE-INT-002: 应该添加事实并查询", async () => {
      console.log("[TEST] ========== PROFILE-INT-002 ==========");

      const factId = await provider.addFact(TEST_USER_ID, {
        category: "work",
        key: "company",
        value: "OpenClaw",
        confidence: 0.95,
        source: "explicit",
        sensitive: false,
      });

      createdFactIds.push(factId);
      console.log("[TEST] 事实 ID:", factId);

      // 查询
      const facts = await provider.getFacts(TEST_USER_ID, "work");
      console.log("[TEST] work 类别事实数:", facts.length);

      const found = facts.find((f) => f.id === factId);
      expect(found).toBeDefined();
      expect(found!.category).toBe("work");
      expect(found!.key).toBe("company");
      expect(found!.value).toBe("OpenClaw");
      expect(found!.confidence).toBe(0.95);
      expect(found!.source).toBe("explicit");
      console.log("[TEST] ✓ 事实添加和查询成功");
    });

    it("PROFILE-INT-003: 应该更新事实", async () => {
      console.log("[TEST] ========== PROFILE-INT-003 ==========");

      const factId = await provider.addFact(TEST_USER_ID, {
        category: "personal",
        key: "city",
        value: "北京",
        confidence: 0.8,
        source: "inferred",
        sensitive: false,
      });
      createdFactIds.push(factId);

      // 更新
      await provider.updateFact(TEST_USER_ID, factId, {
        value: "上海",
        confidence: 0.95,
      });

      // 验证
      const facts = await provider.getFacts(TEST_USER_ID, "personal");
      const updated = facts.find((f) => f.id === factId);

      console.log("[TEST] 更新后 value:", updated?.value);
      console.log("[TEST] 更新后 confidence:", updated?.confidence);

      expect(updated!.value).toBe("上海");
      expect(updated!.confidence).toBe(0.95);
      console.log("[TEST] ✓ 事实更新成功");
    });

    it("PROFILE-INT-004: 应该删除事实（软删除）", async () => {
      console.log("[TEST] ========== PROFILE-INT-004 ==========");

      const factId = await provider.addFact(TEST_USER_ID, {
        category: "work",
        key: "role",
        value: "开发工程师",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });
      createdFactIds.push(factId);

      console.log("[TEST] 事实已创建:", factId);

      // 删除
      await provider.deleteFact(TEST_USER_ID, factId);

      // 验证查不到
      const facts = await provider.getFacts(TEST_USER_ID, "work");
      const found = facts.find((f) => f.id === factId);

      expect(found).toBeUndefined();
      console.log("[TEST] ✓ 事实软删除成功");
    });

    it("PROFILE-INT-005: 应该搜索事实", async () => {
      console.log("[TEST] ========== PROFILE-INT-005 ==========");

      const id1 = await provider.addFact(TEST_USER_ID, {
        category: "technical",
        key: "language",
        value: "TypeScript",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });
      createdFactIds.push(id1);

      const id2 = await provider.addFact(TEST_USER_ID, {
        category: "technical",
        key: "framework",
        value: "React",
        confidence: 0.9,
        source: "inferred",
        sensitive: false,
      });
      createdFactIds.push(id2);

      // 搜索
      const results = await provider.searchFacts(TEST_USER_ID, "TypeScript");

      console.log("[TEST] 搜索结果数:", results.length);

      expect(results.length).toBeGreaterThanOrEqual(1);
      const hasTypeScript = results.some((f) => f.value === "TypeScript");
      expect(hasTypeScript).toBe(true);
      console.log("[TEST] ✓ 事实搜索成功");
    });
  });

  // ==================== 偏好管理 ====================

  describe("偏好管理", () => {
    it("PROFILE-INT-006: 应该获取默认偏好", async () => {
      console.log("[TEST] ========== PROFILE-INT-006 ==========");

      const prefs = await provider.getPreferences(TEST_USER_ID);

      console.log("[TEST] 语言:", prefs.language);
      console.log("[TEST] 响应风格:", prefs.responseStyle);

      // 默认值验证
      expect(prefs.language).toBe("zh-CN");
      expect(prefs.responseStyle).toBeTruthy();
      console.log("[TEST] ✓ 默认偏好获取成功");
    });

    it("PROFILE-INT-007: 应该更新偏好", async () => {
      console.log("[TEST] ========== PROFILE-INT-007 ==========");

      // 确保有默认记录
      await provider.getPreferences(TEST_USER_ID);

      // 更新
      await provider.updatePreferences(TEST_USER_ID, {
        language: "en-US",
        timezone: "America/New_York",
        responseStyle: "concise",
      });

      // 验证
      const updated = await provider.getPreferences(TEST_USER_ID);

      console.log("[TEST] 更新后语言:", updated.language);
      console.log("[TEST] 更新后时区:", updated.timezone);
      console.log("[TEST] 更新后风格:", updated.responseStyle);

      expect(updated.language).toBe("en-US");
      expect(updated.timezone).toBe("America/New_York");
      expect(updated.responseStyle).toBe("concise");
      console.log("[TEST] ✓ 偏好更新成功");
    });

    it("PROFILE-INT-008: 应该重置偏好", async () => {
      console.log("[TEST] ========== PROFILE-INT-008 ==========");

      // 先设置非默认值
      await provider.getPreferences(TEST_USER_ID);
      await provider.updatePreferences(TEST_USER_ID, {
        language: "ja-JP",
      });

      // 重置
      await provider.resetPreferences(TEST_USER_ID);

      // 获取应该返回默认值
      const prefs = await provider.getPreferences(TEST_USER_ID);

      console.log("[TEST] 重置后语言:", prefs.language);
      expect(prefs.language).toBe("zh-CN");
      console.log("[TEST] ✓ 偏好重置成功");
    });
  });

  // ==================== 行为模式 ====================

  describe("行为模式", () => {
    it("PROFILE-INT-009: 应该添加行为模式并查询", async () => {
      console.log("[TEST] ========== PROFILE-INT-009 ==========");

      const patternId = await provider.addPattern(TEST_USER_ID, {
        type: "interaction",
        pattern: "偏好在早上处理复杂任务",
        evidence: ["多次在上午提交代码审查请求", "早上的对话更具技术深度"],
        confidence: 0.7,
      });

      createdPatternIds.push(patternId);
      console.log("[TEST] 模式 ID:", patternId);

      // 查询
      const patterns = await provider.getPatterns(TEST_USER_ID);
      console.log("[TEST] 模式总数:", patterns.length);

      const found = patterns.find((p) => p.id === patternId);
      expect(found).toBeDefined();
      expect(found!.type).toBe("interaction");
      expect(found!.pattern).toBe("偏好在早上处理复杂任务");
      expect(found!.evidence).toHaveLength(2);
      expect(found!.confidence).toBe(0.7);
      console.log("[TEST] ✓ 行为模式添加和查询成功");
    });

    it("PROFILE-INT-010: 应该更新行为模式", async () => {
      console.log("[TEST] ========== PROFILE-INT-010 ==========");

      const patternId = await provider.addPattern(TEST_USER_ID, {
        type: "preference",
        pattern: "偏好简洁的回复风格",
        evidence: ["多次要求精简回答"],
        confidence: 0.6,
      });
      createdPatternIds.push(patternId);

      // 更新
      await provider.updatePattern(TEST_USER_ID, patternId, {
        confidence: 0.85,
        evidence: ["多次要求精简回答", "对长回复表示不满"],
      });

      // 验证
      const patterns = await provider.getPatterns(TEST_USER_ID);
      const updated = patterns.find((p) => p.id === patternId);

      console.log("[TEST] 更新后 confidence:", updated?.confidence);
      console.log("[TEST] 更新后 evidence 数:", updated?.evidence.length);

      expect(updated!.confidence).toBe(0.85);
      expect(updated!.evidence).toHaveLength(2);
      console.log("[TEST] ✓ 行为模式更新成功");
    });

    it("PROFILE-INT-011: 应该确认/拒绝行为模式", async () => {
      console.log("[TEST] ========== PROFILE-INT-011 ==========");

      const patternId = await provider.addPattern(TEST_USER_ID, {
        type: "workflow",
        pattern: "习惯使用 TDD 工作流",
        evidence: ["总是先写测试再实现"],
        confidence: 0.5,
      });
      createdPatternIds.push(patternId);

      // 确认
      await provider.confirmPattern(TEST_USER_ID, patternId, true);

      let patterns = await provider.getPatterns(TEST_USER_ID);
      let found = patterns.find((p) => p.id === patternId);

      console.log("[TEST] 确认后 confirmed:", found?.confirmed);
      expect(found!.confirmed).toBe(true);

      // 拒绝
      await provider.confirmPattern(TEST_USER_ID, patternId, false);

      patterns = await provider.getPatterns(TEST_USER_ID);
      found = patterns.find((p) => p.id === patternId);

      console.log("[TEST] 拒绝后 confirmed:", found?.confirmed);
      expect(found!.confirmed).toBe(false);
      console.log("[TEST] ✓ 行为模式确认/拒绝成功");
    });

    it("PROFILE-INT-012: 应该删除行为模式", async () => {
      console.log("[TEST] ========== PROFILE-INT-012 ==========");

      const patternId = await provider.addPattern(TEST_USER_ID, {
        type: "interaction",
        pattern: "将被删除的模式",
        evidence: [],
        confidence: 0.3,
      });
      createdPatternIds.push(patternId);

      // 删除
      await provider.deletePattern(TEST_USER_ID, patternId);

      // 验证查不到
      const patterns = await provider.getPatterns(TEST_USER_ID);
      const found = patterns.find((p) => p.id === patternId);

      expect(found).toBeUndefined();
      console.log("[TEST] ✓ 行为模式删除成功");
    });
  });

  // ==================== 导出 ====================

  describe("导出", () => {
    it("PROFILE-INT-013: 应该导出完整画像", async () => {
      console.log("[TEST] ========== PROFILE-INT-013 ==========");

      // 创建一些数据
      const factId = await provider.addFact(TEST_USER_ID, {
        category: "work",
        key: "tech_stack",
        value: "TypeScript + PostgreSQL",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });
      createdFactIds.push(factId);

      const patternId = await provider.addPattern(TEST_USER_ID, {
        type: "preference",
        pattern: "偏好使用 Vim 编辑器",
        evidence: ["提到了 Vim 快捷键"],
        confidence: 0.6,
      });
      createdPatternIds.push(patternId);

      // 导出
      const profile = await provider.exportProfile(TEST_USER_ID);

      console.log("[TEST] 事实数:", profile.facts.length);
      console.log("[TEST] 偏好:", profile.preferences.language);
      console.log("[TEST] 模式数:", profile.patterns.length);

      expect(profile.facts.length).toBeGreaterThanOrEqual(1);
      expect(profile.preferences).toBeDefined();
      expect(profile.preferences.language).toBeTruthy();
      expect(profile.patterns.length).toBeGreaterThanOrEqual(1);
      console.log("[TEST] ✓ 画像导出成功");
    });
  });
});
