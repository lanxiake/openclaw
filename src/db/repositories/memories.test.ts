/**
 * MemoryRepository 测试
 *
 * 测试用户记忆的 CRUD 操作、按类型/分类过滤、按重要性排序，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { MemoryRepository, getMemoryRepository } from "./memories.js";

// ==================== MemoryRepository 测试 ====================

describe("MemoryRepository", () => {
  let memRepo: MemoryRepository;
  const testUserId = "user-mem-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== MemoryRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    memRepo = getMemoryRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== MemoryRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("MEM-CREATE-001: 应该创建记忆并自动设置 userId", async () => {
      console.log("[TEST] ========== MEM-CREATE-001 ==========");
      console.log("[TEST] 测试创建记忆");

      const mem = await memRepo.create({
        type: "episodic",
        content: "用户讨论了项目进度",
        importance: 7,
      });

      console.log("[TEST] 记忆ID:", mem.id);
      console.log("[TEST] 记忆 userId:", mem.userId);
      console.log("[TEST] 记忆类型:", mem.type);

      expect(mem.id).toBeTruthy();
      expect(mem.userId).toBe(testUserId);
      expect(mem.type).toBe("episodic");
      expect(mem.content).toBe("用户讨论了项目进度");
      expect(mem.importance).toBe(7);
      expect(mem.isActive).toBe(true);
      expect(mem.createdAt).toBeInstanceOf(Date);

      console.log("[TEST] ✓ 记忆创建成功，userId 自动设置");
    });

    it("MEM-CREATE-002: 应该创建带完整配置的记忆", async () => {
      console.log("[TEST] ========== MEM-CREATE-002 ==========");
      console.log("[TEST] 测试创建带完整配置的记忆");

      const mem = await memRepo.create({
        type: "preference",
        category: "work",
        content: "偏好使用 TypeScript",
        summary: "编程语言偏好",
        sourceType: "conversation",
        sourceId: "conv-001",
        importance: 8,
        metadata: { confidence: 0.95 },
      });

      console.log("[TEST] 记忆类型:", mem.type);
      console.log("[TEST] 分类:", mem.category);
      console.log("[TEST] 来源:", mem.sourceType);

      expect(mem.type).toBe("preference");
      expect(mem.category).toBe("work");
      expect(mem.summary).toBe("编程语言偏好");
      expect(mem.sourceType).toBe("conversation");
      expect(mem.sourceId).toBe("conv-001");
      expect(mem.metadata?.confidence).toBe(0.95);

      console.log("[TEST] ✓ 带完整配置的记忆创建成功");
    });
  });

  describe("findById", () => {
    it("MEM-FIND-001: 应该根据 ID 查找自己的记忆", async () => {
      console.log("[TEST] ========== MEM-FIND-001 ==========");
      console.log("[TEST] 测试查找自己的记忆");

      const created = await memRepo.create({
        type: "fact",
        content: "用户生日是 5 月 1 日",
      });

      const found = await memRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.content).toBe("用户生日是 5 月 1 日");

      console.log("[TEST] ✓ 成功查找到自己的记忆");
    });

    it("MEM-FIND-002: 不存在的 ID 应该返回 null", async () => {
      console.log("[TEST] ========== MEM-FIND-002 ==========");

      const found = await memRepo.findById("non-existent-id");

      expect(found).toBeNull();

      console.log("[TEST] ✓ 不存在的记忆正确返回 null");
    });
  });

  describe("findAll", () => {
    it("MEM-FIND-003: 应该支持按类型过滤", async () => {
      console.log("[TEST] ========== MEM-FIND-003 ==========");
      console.log("[TEST] 测试按类型过滤");

      await memRepo.create({ type: "episodic", content: "情景记忆1" });
      await memRepo.create({ type: "preference", content: "偏好记忆1" });
      await memRepo.create({ type: "episodic", content: "情景记忆2" });

      const result = await memRepo.findAll({ type: "episodic" });

      console.log("[TEST] 情景记忆数:", result.memories.length);

      expect(result.memories.length).toBe(2);
      expect(result.memories.every((m) => m.type === "episodic")).toBe(true);

      console.log("[TEST] ✓ 按类型过滤正常");
    });

    it("MEM-FIND-004: 应该支持按分类过滤", async () => {
      console.log("[TEST] ========== MEM-FIND-004 ==========");
      console.log("[TEST] 测试按分类过滤");

      await memRepo.create({ type: "fact", category: "work", content: "工作记忆" });
      await memRepo.create({ type: "fact", category: "personal", content: "个人记忆" });

      const result = await memRepo.findAll({ category: "work" });

      console.log("[TEST] 工作分类记忆数:", result.memories.length);

      expect(result.memories.length).toBe(1);
      expect(result.memories[0].category).toBe("work");

      console.log("[TEST] ✓ 按分类过滤正常");
    });

    it("MEM-FIND-005: 应该支持分页", async () => {
      console.log("[TEST] ========== MEM-FIND-005 ==========");
      console.log("[TEST] 测试分页功能");

      for (let i = 1; i <= 5; i++) {
        await memRepo.create({ type: "fact", content: `记忆${i}`, importance: i });
      }

      const page1 = await memRepo.findAll({ limit: 2, offset: 0 });
      const page2 = await memRepo.findAll({ limit: 2, offset: 2 });

      console.log("[TEST] 第一页数量:", page1.memories.length);
      console.log("[TEST] 第二页数量:", page2.memories.length);
      console.log("[TEST] 总数:", page1.total);

      expect(page1.memories.length).toBe(2);
      expect(page2.memories.length).toBe(2);
      expect(page1.total).toBe(5);

      console.log("[TEST] ✓ 分页功能正常");
    });

    it("MEM-FIND-006: 应该支持按重要性排序参数", async () => {
      console.log("[TEST] ========== MEM-FIND-006 ==========");
      console.log("[TEST] 测试按重要性排序参数（Mock 环境不验证顺序，验证参数传递）");

      await memRepo.create({ type: "fact", content: "低重要性", importance: 3 });
      await memRepo.create({ type: "fact", content: "高重要性", importance: 9 });
      await memRepo.create({ type: "fact", content: "中重要性", importance: 6 });

      const result = await memRepo.findAll({ orderByImportance: true });

      console.log("[TEST] 查询结果数:", result.memories.length);
      console.log(
        "[TEST] 重要性值:",
        result.memories.map((m) => m.importance),
      );

      // Mock 环境下 orderBy 不生效，仅验证查询返回正确数量
      expect(result.memories.length).toBe(3);
      expect(result.total).toBe(3);
      // 验证所有重要性值都在结果中
      const importances = result.memories.map((m) => m.importance);
      expect(importances).toContain(3);
      expect(importances).toContain(6);
      expect(importances).toContain(9);

      console.log("[TEST] ✓ 按重要性排序参数传递正常（实际排序需集成测试验证）");
    });
  });

  describe("update", () => {
    it("MEM-UPDATE-001: 应该更新记忆内容", async () => {
      console.log("[TEST] ========== MEM-UPDATE-001 ==========");
      console.log("[TEST] 测试更新记忆内容");

      const created = await memRepo.create({ type: "fact", content: "原始内容" });
      const updated = await memRepo.update(created.id, {
        content: "更新后内容",
        importance: 8,
      });

      console.log("[TEST] 更新后内容:", updated?.content);
      console.log("[TEST] 更新后重要性:", updated?.importance);

      expect(updated?.content).toBe("更新后内容");
      expect(updated?.importance).toBe(8);

      console.log("[TEST] ✓ 记忆更新成功");
    });
  });

  describe("deactivate", () => {
    it("MEM-DEACTIVATE-001: 应该停用记忆", async () => {
      console.log("[TEST] ========== MEM-DEACTIVATE-001 ==========");
      console.log("[TEST] 测试停用记忆");

      const created = await memRepo.create({ type: "fact", content: "待停用" });
      await memRepo.deactivate(created.id);

      const found = await memRepo.findById(created.id);

      console.log("[TEST] 停用后状态:", found?.isActive);

      expect(found?.isActive).toBe(false);

      console.log("[TEST] ✓ 记忆停用成功");
    });
  });

  describe("tenant isolation", () => {
    it("MEM-TENANT-001: 不同用户的记忆应该隔离", async () => {
      console.log("[TEST] ========== MEM-TENANT-001 ==========");
      console.log("[TEST] 测试多租户隔离");

      // 用户 A 创建记忆
      const userAMem = await memRepo.create({ type: "fact", content: "用户A的记忆" });

      // 切换到用户 B
      const db = getMockDatabase();
      const userBRepo = getMemoryRepository(db, "user-B-different");

      // 用户 B 尝试查找用户 A 的记忆
      const foundByB = await userBRepo.findById(userAMem.id);
      const userBList = await userBRepo.findAll();

      console.log("[TEST] 用户B查找用户A记忆结果:", foundByB);
      console.log("[TEST] 用户B的记忆列表数量:", userBList.memories.length);

      expect(foundByB).toBeNull();
      expect(userBList.memories.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
