/**
 * AssistantConfigRepository 测试
 *
 * 测试用户助手配置的 CRUD 操作、findDefault，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import { AssistantConfigRepository, getAssistantConfigRepository } from "./assistant-configs.js";

describe("AssistantConfigRepository", () => {
  let configRepo: AssistantConfigRepository;
  const testUserId = "user-config-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== AssistantConfigRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    configRepo = getAssistantConfigRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== AssistantConfigRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("CONFIG-CREATE-001: 应该创建配置并自动设置 userId", async () => {
      console.log("[TEST] ========== CONFIG-CREATE-001 ==========");

      const config = await configRepo.create({
        name: "我的助手",
        personality: { tone: "friendly", humor: 7 },
        modelConfig: { modelId: "gpt-4", temperature: 0.7 },
      });

      console.log("[TEST] 配置ID:", config.id);
      console.log("[TEST] 配置 userId:", config.userId);

      expect(config.id).toBeTruthy();
      expect(config.userId).toBe(testUserId);
      expect(config.name).toBe("我的助手");
      expect(config.isDefault).toBe(false);
      expect(config.personality?.tone).toBe("friendly");
      expect(config.modelConfig?.modelId).toBe("gpt-4");

      console.log("[TEST] ✓ 配置创建成功");
    });
  });

  describe("findDefault", () => {
    it("CONFIG-DEFAULT-001: 应该查找默认配置", async () => {
      console.log("[TEST] ========== CONFIG-DEFAULT-001 ==========");

      await configRepo.create({ name: "普通配置" });
      await configRepo.create({ name: "默认配置", isDefault: true });

      const defaultConfig = await configRepo.findDefault();

      console.log("[TEST] 默认配置:", defaultConfig?.name);

      expect(defaultConfig).toBeTruthy();
      expect(defaultConfig?.name).toBe("默认配置");
      expect(defaultConfig?.isDefault).toBe(true);

      console.log("[TEST] ✓ findDefault 正常");
    });

    it("CONFIG-DEFAULT-002: 无默认配置时应返回 null", async () => {
      console.log("[TEST] ========== CONFIG-DEFAULT-002 ==========");

      await configRepo.create({ name: "非默认配置" });

      const defaultConfig = await configRepo.findDefault();
      expect(defaultConfig).toBeNull();

      console.log("[TEST] ✓ 无默认配置返回 null");
    });
  });

  describe("findAll", () => {
    it("CONFIG-FIND-001: 应该返回当前用户的所有配置", async () => {
      console.log("[TEST] ========== CONFIG-FIND-001 ==========");

      await configRepo.create({ name: "配置1" });
      await configRepo.create({ name: "配置2" });

      const result = await configRepo.findAll();

      expect(result.configs.length).toBe(2);
      expect(result.total).toBe(2);

      console.log("[TEST] ✓ findAll 正常");
    });
  });

  describe("update", () => {
    it("CONFIG-UPDATE-001: 应该更新配置", async () => {
      console.log("[TEST] ========== CONFIG-UPDATE-001 ==========");

      const created = await configRepo.create({ name: "原名称" });
      const updated = await configRepo.update(created.id, {
        name: "新名称",
        isDefault: true,
      });

      expect(updated?.name).toBe("新名称");
      expect(updated?.isDefault).toBe(true);

      console.log("[TEST] ✓ 配置更新成功");
    });
  });

  describe("delete", () => {
    it("CONFIG-DELETE-001: 应该删除配置", async () => {
      console.log("[TEST] ========== CONFIG-DELETE-001 ==========");

      const created = await configRepo.create({ name: "待删除" });
      await configRepo.delete(created.id);
      const found = await configRepo.findById(created.id);

      expect(found).toBeNull();

      console.log("[TEST] ✓ 配置删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("CONFIG-TENANT-001: 不同用户的配置应该隔离", async () => {
      console.log("[TEST] ========== CONFIG-TENANT-001 ==========");

      const userAConfig = await configRepo.create({ name: "用户A配置" });

      const db = getMockDatabase();
      const userBRepo = getAssistantConfigRepository(db, "user-B-different");

      const foundByB = await userBRepo.findById(userAConfig.id);
      const userBList = await userBRepo.findAll();

      expect(foundByB).toBeNull();
      expect(userBList.configs.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常");
    });
  });
});
