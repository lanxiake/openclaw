/**
 * PostgreSQL 情节记忆提供者集成测试
 *
 * 使用真实 PostgreSQL 数据库验证 Provider 的完整 CRUD 流程。
 * 测试数据通过 afterEach 物理删除确保隔离。
 *
 * @module memory/pluggable/providers/episodic
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";

import { getDatabase } from "../../../../db/connection.js";
import type { Database } from "../../../../db/connection.js";
import { userMemories } from "../../../../db/schema/memories.js";
import { getUserRepository, type UserRepository } from "../../../../db/repositories/users.js";
import { PostgresEpisodicMemoryProvider } from "./postgres.js";

// ==================== 测试常量 ====================

/** 测试用户 ID（运行时由 beforeAll 创建真实用户后填入） */
let TEST_USER_ID: string;

// ==================== 测试 ====================

describe("PostgresEpisodicMemoryProvider (Integration)", () => {
  let db: Database;
  let provider: PostgresEpisodicMemoryProvider;
  let userRepo: UserRepository;
  /** 追踪创建的记忆 ID，用于 afterEach 清理 */
  const createdMemoryIds: string[] = [];

  beforeAll(async () => {
    console.log("[TEST] ========== 连接真实数据库 ==========");
    db = getDatabase();
    userRepo = getUserRepository(db);

    // 创建测试用户（外键约束要求 user_memories.user_id 必须存在于 users 表中）
    const testUser = await userRepo.create({
      phone: `+86138${Date.now().toString().slice(-8)}`,
      email: `test-episodic-${Date.now()}@example.com`,
      passwordHash: "TestPassword@123",
      isActive: true,
    });
    TEST_USER_ID = testUser.id;
    console.log("[TEST] ✓ 测试用户已创建, ID:", TEST_USER_ID);

    provider = new PostgresEpisodicMemoryProvider({ db });
    await provider.initialize();
    console.log("[TEST] ✓ PostgresEpisodicMemoryProvider 初始化成功");
  });

  afterEach(async () => {
    console.log(`[TEST] 清理测试数据... (${createdMemoryIds.length} 条)`);

    // 物理删除所有测试记录
    if (createdMemoryIds.length > 0) {
      for (const id of createdMemoryIds) {
        try {
          await db
            .delete(userMemories)
            .where(and(eq(userMemories.id, id), eq(userMemories.userId, TEST_USER_ID)));
        } catch (error) {
          // 忽略删除错误
        }
      }
      createdMemoryIds.length = 0;
    }

    // 兜底：按 userId 清理所有测试用户数据
    try {
      await db.delete(userMemories).where(eq(userMemories.userId, TEST_USER_ID));
    } catch (error) {
      // 忽略
    }
  });

  afterAll(async () => {
    // 清理记忆数据
    try {
      await db.delete(userMemories).where(eq(userMemories.userId, TEST_USER_ID));
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
    console.log("[TEST] ========== Episodic 集成测试完成 ==========\n");
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("EPISODIC-INT-001: 初始化后健康检查应返回 healthy", async () => {
      console.log("[TEST] ========== EPISODIC-INT-001 ==========");

      const health = await provider.healthCheck();

      console.log("[TEST] 健康状态:", health.status);
      expect(health.status).toBe("healthy");
      console.log("[TEST] ✓ 健康检查通过");
    });
  });

  // ==================== 对话历史 ====================

  describe("对话历史", () => {
    it("EPISODIC-INT-002: 应该添加对话并通过摘要查询", async () => {
      console.log("[TEST] ========== EPISODIC-INT-002 ==========");

      const sessionId = `session-int-${Date.now()}`;
      const messages = [
        { role: "user" as const, content: "我们讨论下微服务架构的优缺点" },
        { role: "assistant" as const, content: "微服务架构有以下优点：独立部署、技术异构..." },
        { role: "user" as const, content: "那缺点呢？" },
        { role: "assistant" as const, content: "缺点包括：分布式事务复杂、运维成本高..." },
      ];

      console.log("[TEST] 添加对话, sessionId:", sessionId, ", 消息数:", messages.length);

      await provider.addConversation(TEST_USER_ID, sessionId, messages);

      // 通过 summarizeConversation 验证数据已持久化
      const summary = await provider.summarizeConversation(TEST_USER_ID, sessionId);

      console.log("[TEST] 摘要 ID:", summary.id);
      console.log("[TEST] 摘要内容:", summary.summary);
      console.log("[TEST] 消息数:", summary.messageCount);

      // 登记 ID 用于清理
      createdMemoryIds.push(summary.id);

      expect(summary.sessionId).toBe(sessionId);
      expect(summary.messageCount).toBe(4);
      expect(summary.summary).toBeTruthy();
      expect(summary.keyTopics.length).toBeGreaterThan(0);
      console.log("[TEST] ✓ 对话添加和摘要查询成功");
    });

    it("EPISODIC-INT-003: 应该获取对话历史列表", async () => {
      console.log("[TEST] ========== EPISODIC-INT-003 ==========");

      // 创建两个对话
      const session1 = `session-hist-1-${Date.now()}`;
      const session2 = `session-hist-2-${Date.now()}`;

      await provider.addConversation(TEST_USER_ID, session1, [
        { role: "user" as const, content: "讨论 React 状态管理" },
        { role: "assistant" as const, content: "推荐使用 Zustand 或 Jotai" },
      ]);

      await provider.addConversation(TEST_USER_ID, session2, [
        { role: "user" as const, content: "讨论数据库索引优化" },
        { role: "assistant" as const, content: "建议创建复合索引" },
      ]);

      const history = await provider.getConversationHistory(TEST_USER_ID, { limit: 10 });

      console.log("[TEST] 历史记录数:", history.length);

      // 登记 ID 用于清理
      for (const h of history) {
        createdMemoryIds.push(h.id);
      }

      expect(history.length).toBeGreaterThanOrEqual(2);

      // 验证两个 session 都在
      const sessionIds = history.map((h) => h.sessionId);
      expect(sessionIds).toContain(session1);
      expect(sessionIds).toContain(session2);
      console.log("[TEST] ✓ 对话历史列表获取成功");
    });

    it("EPISODIC-INT-004: 应该删除对话", async () => {
      console.log("[TEST] ========== EPISODIC-INT-004 ==========");

      const sessionId = `session-del-${Date.now()}`;
      await provider.addConversation(TEST_USER_ID, sessionId, [
        { role: "user" as const, content: "这条对话将被删除" },
      ]);

      // 验证存在
      const before = await provider.summarizeConversation(TEST_USER_ID, sessionId);
      createdMemoryIds.push(before.id);
      console.log("[TEST] 对话已创建, ID:", before.id);

      // 删除
      await provider.deleteConversation(TEST_USER_ID, sessionId);
      console.log("[TEST] 对话已删除");

      // 验证不存在
      await expect(provider.summarizeConversation(TEST_USER_ID, sessionId)).rejects.toThrow();
      console.log("[TEST] ✓ 对话删除成功");
    });
  });

  // ==================== 关键事件 ====================

  describe("关键事件", () => {
    it("EPISODIC-INT-005: 应该添加关键事件并查询", async () => {
      console.log("[TEST] ========== EPISODIC-INT-005 ==========");

      const eventId = await provider.addKeyEvent(TEST_USER_ID, {
        type: "task_completed",
        description: "完成了数据库迁移脚本编写",
        context: "从 MongoDB 迁移到 PostgreSQL",
        importance: 0.8,
        relatedSessions: [],
        timestamp: new Date(),
      });

      createdMemoryIds.push(eventId);
      console.log("[TEST] 事件 ID:", eventId);

      // 查询事件
      const events = await provider.getKeyEvents(TEST_USER_ID);
      console.log("[TEST] 事件总数:", events.length);

      const found = events.find((e) => e.id === eventId);
      expect(found).toBeDefined();
      expect(found!.type).toBe("task_completed");
      expect(found!.description).toBe("完成了数据库迁移脚本编写");
      expect(found!.importance).toBe(0.8); // DB 存 8，接口返回 0.8
      console.log("[TEST] ✓ 关键事件添加和查询成功");
    });

    it("EPISODIC-INT-006: 应该更新关键事件", async () => {
      console.log("[TEST] ========== EPISODIC-INT-006 ==========");

      const eventId = await provider.addKeyEvent(TEST_USER_ID, {
        type: "important_info",
        description: "原始描述",
        context: "原始上下文",
        importance: 0.5,
        relatedSessions: [],
        timestamp: new Date(),
      });
      createdMemoryIds.push(eventId);

      // 更新
      await provider.updateKeyEvent(TEST_USER_ID, eventId, {
        description: "更新后的描述",
        importance: 0.9,
      });

      // 验证更新
      const events = await provider.getKeyEvents(TEST_USER_ID);
      const updated = events.find((e) => e.id === eventId);

      console.log("[TEST] 更新后描述:", updated?.description);
      console.log("[TEST] 更新后重要性:", updated?.importance);

      expect(updated!.description).toBe("更新后的描述");
      expect(updated!.importance).toBe(0.9);
      console.log("[TEST] ✓ 关键事件更新成功");
    });

    it("EPISODIC-INT-007: 应该删除关键事件", async () => {
      console.log("[TEST] ========== EPISODIC-INT-007 ==========");

      const eventId = await provider.addKeyEvent(TEST_USER_ID, {
        type: "milestone",
        description: "将被删除的事件",
        context: "",
        importance: 0.3,
        relatedSessions: [],
        timestamp: new Date(),
      });
      createdMemoryIds.push(eventId);

      console.log("[TEST] 事件已创建:", eventId);

      // 删除
      await provider.deleteKeyEvent(TEST_USER_ID, eventId);

      // 验证已被软删除（查不到）
      const events = await provider.getKeyEvents(TEST_USER_ID);
      const found = events.find((e) => e.id === eventId);

      expect(found).toBeUndefined();
      console.log("[TEST] ✓ 关键事件删除成功");
    });

    it("EPISODIC-INT-008: 应该按类型过滤事件", async () => {
      console.log("[TEST] ========== EPISODIC-INT-008 ==========");

      const id1 = await provider.addKeyEvent(TEST_USER_ID, {
        type: "milestone",
        description: "v1.0 发布",
        context: "首次正式版发布",
        importance: 0.9,
        relatedSessions: [],
        timestamp: new Date(),
      });
      createdMemoryIds.push(id1);

      const id2 = await provider.addKeyEvent(TEST_USER_ID, {
        type: "task_completed",
        description: "完成单元测试",
        context: "测试覆盖率达 80%",
        importance: 0.6,
        relatedSessions: [],
        timestamp: new Date(),
      });
      createdMemoryIds.push(id2);

      // 按类型过滤
      const milestones = await provider.getKeyEvents(TEST_USER_ID, {
        types: ["milestone"],
      });

      console.log("[TEST] milestone 数量:", milestones.length);

      const milestoneIds = milestones.map((e) => e.id);
      expect(milestoneIds).toContain(id1);
      expect(milestoneIds).not.toContain(id2);
      console.log("[TEST] ✓ 事件类型过滤成功");
    });
  });

  // ==================== 搜索 ====================

  describe("搜索", () => {
    it("EPISODIC-INT-009: 应该搜索对话和事件", async () => {
      console.log("[TEST] ========== EPISODIC-INT-009 ==========");

      // 创建包含特定关键词的数据
      const sessionId = `session-search-${Date.now()}`;
      await provider.addConversation(TEST_USER_ID, sessionId, [
        { role: "user" as const, content: "讨论 PostgreSQL 性能调优" },
        { role: "assistant" as const, content: "可以通过创建索引和优化查询来提升 PostgreSQL 性能" },
      ]);

      const eventId = await provider.addKeyEvent(TEST_USER_ID, {
        type: "important_info",
        description: "PostgreSQL 连接池配置完成",
        context: "使用 pgBouncer 管理连接",
        importance: 0.7,
        relatedSessions: [],
        timestamp: new Date(),
      });

      // 查找创建的对话 ID 用于清理
      const summary = await provider.summarizeConversation(TEST_USER_ID, sessionId);
      createdMemoryIds.push(summary.id);
      createdMemoryIds.push(eventId);

      // 搜索
      const results = await provider.searchEpisodes(TEST_USER_ID, "PostgreSQL");

      console.log("[TEST] 搜索结果数:", results.length);
      for (const r of results) {
        console.log(
          `[TEST]   - [${r.type}] score=${r.score.toFixed(2)}: ${r.content.slice(0, 60)}`,
        );
      }

      expect(results.length).toBeGreaterThanOrEqual(1);
      // 至少有一个结果包含 "PostgreSQL"
      const hasRelevant = results.some((r) => r.content.toLowerCase().includes("postgresql"));
      expect(hasRelevant).toBe(true);
      console.log("[TEST] ✓ 搜索成功");
    });
  });

  // ==================== 时间线 ====================

  describe("时间线", () => {
    it("EPISODIC-INT-010: 应该获取时间线聚合对话和事件", async () => {
      console.log("[TEST] ========== EPISODIC-INT-010 ==========");

      const now = new Date();
      const sessionId = `session-timeline-${Date.now()}`;

      // 创建对话
      await provider.addConversation(TEST_USER_ID, sessionId, [
        { role: "user" as const, content: "时间线测试对话" },
      ]);

      // 创建事件
      const eventId = await provider.addKeyEvent(TEST_USER_ID, {
        type: "milestone",
        description: "时间线测试事件",
        context: "测试用",
        importance: 0.5,
        relatedSessions: [sessionId],
        timestamp: now,
      });

      const summary = await provider.summarizeConversation(TEST_USER_ID, sessionId);
      createdMemoryIds.push(summary.id);
      createdMemoryIds.push(eventId);

      // 获取时间线（宽范围确保覆盖）
      const startDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 小时前
      const endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 小时后

      const timeline = await provider.getTimeline(TEST_USER_ID, startDate, endDate);

      console.log("[TEST] 时间线条目数:", timeline.length);
      for (const entry of timeline) {
        console.log(`[TEST]   - [${entry.type}] ${entry.title}: ${entry.description.slice(0, 40)}`);
      }

      expect(timeline.length).toBeGreaterThanOrEqual(2);

      // 验证包含对话和事件两种类型
      const types = new Set(timeline.map((e) => e.type));
      expect(types.has("conversation")).toBe(true);
      expect(types.has("milestone") || types.has("event")).toBe(true);

      // 验证时间倒序
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          timeline[i].timestamp.getTime(),
        );
      }
      console.log("[TEST] ✓ 时间线获取成功");
    });
  });

  // ==================== importance 映射 ====================

  describe("importance 映射", () => {
    it("EPISODIC-INT-011: 接口 0-1 应正确映射到 DB 1-10 并往返一致", async () => {
      console.log("[TEST] ========== EPISODIC-INT-011 ==========");

      const testValues = [0.1, 0.3, 0.5, 0.7, 1.0];

      for (const importance of testValues) {
        const eventId = await provider.addKeyEvent(TEST_USER_ID, {
          type: "important_info",
          description: `importance=${importance}`,
          context: "",
          importance,
          relatedSessions: [],
          timestamp: new Date(),
        });
        createdMemoryIds.push(eventId);

        const events = await provider.getKeyEvents(TEST_USER_ID);
        const found = events.find((e) => e.id === eventId);

        console.log(`[TEST] importance ${importance} -> DB -> ${found?.importance}`);
        expect(found!.importance).toBe(importance);
      }

      console.log("[TEST] ✓ importance 往返映射一致");
    });
  });
});
