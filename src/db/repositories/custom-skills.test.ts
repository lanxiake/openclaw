/**
 * CustomSkillRepository 测试
 *
 * 测试用户自建技能的 CRUD 操作、状态过滤，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { CustomSkillRepository, getCustomSkillRepository } from "./custom-skills.js";

describe("CustomSkillRepository", () => {
  let skillRepo: CustomSkillRepository;
  const testUserId = "user-skill-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== CustomSkillRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    skillRepo = getCustomSkillRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== CustomSkillRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("SKILL-CREATE-001: 应该创建技能并自动设置 userId", async () => {
      console.log("[TEST] ========== SKILL-CREATE-001 ==========");

      const skill = await skillRepo.create({
        name: "天气查询",
        description: "查询当前天气",
        manifest: { entry: "index.ts", tools: [] },
      });

      console.log("[TEST] 技能ID:", skill.id);
      console.log("[TEST] 技能 userId:", skill.userId);

      expect(skill.id).toBeTruthy();
      expect(skill.userId).toBe(testUserId);
      expect(skill.name).toBe("天气查询");
      expect(skill.status).toBe("draft");
      expect(skill.version).toBe("1.0.0");
      expect(skill.isPublished).toBe(false);

      console.log("[TEST] ✓ 技能创建成功");
    });
  });

  describe("findById", () => {
    it("SKILL-FIND-001: 应该根据 ID 查找技能", async () => {
      console.log("[TEST] ========== SKILL-FIND-001 ==========");

      const created = await skillRepo.create({
        name: "测试技能",
        manifest: { entry: "main.ts" },
      });

      const found = await skillRepo.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.name).toBe("测试技能");

      console.log("[TEST] ✓ 查找技能成功");
    });

    it("SKILL-FIND-002: 不存在的 ID 应该返回 null", async () => {
      console.log("[TEST] ========== SKILL-FIND-002 ==========");

      const found = await skillRepo.findById("non-existent");
      expect(found).toBeNull();

      console.log("[TEST] ✓ 不存在返回 null");
    });
  });

  describe("findAll", () => {
    it("SKILL-FIND-003: 应该支持按状态过滤", async () => {
      console.log("[TEST] ========== SKILL-FIND-003 ==========");

      await skillRepo.create({ name: "草稿技能", manifest: {} });
      const ready = await skillRepo.create({ name: "就绪技能", manifest: {} });
      await skillRepo.update(ready.id, { status: "ready" });

      const drafts = await skillRepo.findAll({ status: "draft" });
      const readyList = await skillRepo.findAll({ status: "ready" });

      console.log("[TEST] 草稿数:", drafts.skills.length);
      console.log("[TEST] 就绪数:", readyList.skills.length);

      expect(drafts.skills.length).toBe(1);
      expect(readyList.skills.length).toBe(1);

      console.log("[TEST] ✓ 按状态过滤正常");
    });
  });

  describe("update", () => {
    it("SKILL-UPDATE-001: 应该更新技能", async () => {
      console.log("[TEST] ========== SKILL-UPDATE-001 ==========");

      const created = await skillRepo.create({ name: "原名称", manifest: {} });
      const updated = await skillRepo.update(created.id, {
        name: "新名称",
        status: "ready",
      });

      expect(updated?.name).toBe("新名称");
      expect(updated?.status).toBe("ready");

      console.log("[TEST] ✓ 技能更新成功");
    });
  });

  describe("delete", () => {
    it("SKILL-DELETE-001: 应该删除技能", async () => {
      console.log("[TEST] ========== SKILL-DELETE-001 ==========");

      const created = await skillRepo.create({ name: "待删除", manifest: {} });
      await skillRepo.delete(created.id);
      const found = await skillRepo.findById(created.id);

      expect(found).toBeNull();

      console.log("[TEST] ✓ 技能删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("SKILL-TENANT-001: 不同用户的技能应该隔离", async () => {
      console.log("[TEST] ========== SKILL-TENANT-001 ==========");

      const userASkill = await skillRepo.create({ name: "用户A技能", manifest: {} });

      const db = getMockDatabase();
      const userBRepo = getCustomSkillRepository(db, "user-B-different");

      const foundByB = await userBRepo.findById(userASkill.id);
      const userBList = await userBRepo.findAll();

      expect(foundByB).toBeNull();
      expect(userBList.skills.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
