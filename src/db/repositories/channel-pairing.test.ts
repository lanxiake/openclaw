/**
 * ChannelPairingRequestRepository + ChannelBindingRepository 测试
 *
 * 测试频道配对请求的 CRUD、过期清理、配对码唯一性
 * 测试频道绑定的添加、移除、查询、去重
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  ChannelPairingRequestRepository,
  ChannelBindingRepository,
  getChannelPairingRequestRepository,
  getChannelBindingRepository,
} from "./channel-pairing.js";

// ==================== ChannelPairingRequestRepository 测试 ====================

describe("ChannelPairingRequestRepository", () => {
  let pairingRepo: ChannelPairingRequestRepository;

  beforeEach(() => {
    console.log("[TEST] ========== ChannelPairingRequestRepository 测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    pairingRepo = getChannelPairingRequestRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== ChannelPairingRequestRepository 测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("upsertRequest", () => {
    it("CPR-UPSERT-001: 应该创建新的配对请求", async () => {
      console.log("[TEST] ========== CPR-UPSERT-001 ==========");

      const result = await pairingRepo.upsertRequest("telegram", "12345", {
        username: "testuser",
        firstName: "Test",
      });

      console.log("[TEST] 配对码:", result.code);
      console.log("[TEST] 是否新建:", result.created);

      expect(result.code).toBeTruthy();
      expect(result.code).toHaveLength(8);
      expect(result.created).toBe(true);
    });

    it("CPR-UPSERT-002: 同一 sender 重复请求应返回已有配对码", async () => {
      console.log("[TEST] ========== CPR-UPSERT-002 ==========");

      const first = await pairingRepo.upsertRequest("telegram", "12345");
      const second = await pairingRepo.upsertRequest("telegram", "12345");

      console.log("[TEST] 第一次配对码:", first.code);
      console.log("[TEST] 第二次配对码:", second.code);

      expect(first.code).toBe(second.code);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
    });

    it("CPR-UPSERT-003: 不同频道相同 sender 应创建独立请求", async () => {
      console.log("[TEST] ========== CPR-UPSERT-003 ==========");

      const tg = await pairingRepo.upsertRequest("telegram", "12345");
      const dc = await pairingRepo.upsertRequest("discord", "12345");

      expect(tg.created).toBe(true);
      expect(dc.created).toBe(true);
      expect(tg.code).not.toBe(dc.code);
    });

    it("CPR-UPSERT-004: 超过 MAX_PENDING 限制应返回空码", async () => {
      console.log("[TEST] ========== CPR-UPSERT-004 ==========");

      // 创建 3 个 pending 请求（MAX = 3）
      await pairingRepo.upsertRequest("telegram", "user1");
      await pairingRepo.upsertRequest("telegram", "user2");
      await pairingRepo.upsertRequest("telegram", "user3");

      // 第 4 个应该被拒绝
      const result = await pairingRepo.upsertRequest("telegram", "user4");

      console.log("[TEST] 第4个请求码:", result.code);

      expect(result.code).toBe("");
      expect(result.created).toBe(false);
    });
  });

  describe("findByCode", () => {
    it("CPR-FIND-001: 应该根据配对码找到请求", async () => {
      console.log("[TEST] ========== CPR-FIND-001 ==========");

      const { code } = await pairingRepo.upsertRequest("telegram", "12345", {
        username: "testuser",
      });
      const found = await pairingRepo.findByCode(code);

      expect(found).not.toBeNull();
      expect(found!.code).toBe(code);
      expect(found!.senderId).toBe("12345");
      expect(found!.channel).toBe("telegram");
      expect(found!.senderMeta).toEqual({ username: "testuser" });
    });

    it("CPR-FIND-002: 不存在的配对码应返回 null", async () => {
      console.log("[TEST] ========== CPR-FIND-002 ==========");

      const found = await pairingRepo.findByCode("NOTEXIST");

      expect(found).toBeNull();
    });

    it("CPR-FIND-003: 空字符串应返回 null", async () => {
      console.log("[TEST] ========== CPR-FIND-003 ==========");

      const found = await pairingRepo.findByCode("");

      expect(found).toBeNull();
    });
  });

  describe("findPending", () => {
    it("CPR-PENDING-001: 应该返回指定频道的 pending 请求", async () => {
      console.log("[TEST] ========== CPR-PENDING-001 ==========");

      await pairingRepo.upsertRequest("telegram", "user1");
      await pairingRepo.upsertRequest("telegram", "user2");
      await pairingRepo.upsertRequest("discord", "user3");

      const tgPending = await pairingRepo.findPending("telegram");
      const dcPending = await pairingRepo.findPending("discord");

      expect(tgPending).toHaveLength(2);
      expect(dcPending).toHaveLength(1);
    });

    it("CPR-PENDING-002: 无数据时应返回空数组", async () => {
      console.log("[TEST] ========== CPR-PENDING-002 ==========");

      const pending = await pairingRepo.findPending("telegram");

      expect(pending).toEqual([]);
    });
  });

  describe("approve", () => {
    it("CPR-APPROVE-001: 应该成功审批配对请求", async () => {
      console.log("[TEST] ========== CPR-APPROVE-001 ==========");

      const { code } = await pairingRepo.upsertRequest("telegram", "12345", {
        username: "testuser",
      });
      const result = await pairingRepo.approve(code);

      console.log("[TEST] 审批结果:", result);

      expect(result).not.toBeNull();
      expect(result!.senderId).toBe("12345");
      expect(result!.channel).toBe("telegram");
      expect(result!.senderMeta).toEqual({ username: "testuser" });
    });

    it("CPR-APPROVE-002: 审批后再次查找应返回 null（已非 pending）", async () => {
      console.log("[TEST] ========== CPR-APPROVE-002 ==========");

      const { code } = await pairingRepo.upsertRequest("telegram", "12345");
      await pairingRepo.approve(code);

      // 再次查找 pending 状态应返回 null
      const found = await pairingRepo.findByCode(code);

      expect(found).toBeNull();
    });

    it("CPR-APPROVE-003: 不存在的配对码应返回 null", async () => {
      console.log("[TEST] ========== CPR-APPROVE-003 ==========");

      const result = await pairingRepo.approve("NOTEXIST");

      expect(result).toBeNull();
    });
  });

  describe("countPending", () => {
    it("CPR-COUNT-001: 应该正确统计 pending 数量", async () => {
      console.log("[TEST] ========== CPR-COUNT-001 ==========");

      await pairingRepo.upsertRequest("telegram", "user1");
      await pairingRepo.upsertRequest("telegram", "user2");

      const count = await pairingRepo.countPending("telegram");

      expect(count).toBe(2);
    });

    it("CPR-COUNT-002: 不同频道应独立计数", async () => {
      console.log("[TEST] ========== CPR-COUNT-002 ==========");

      await pairingRepo.upsertRequest("telegram", "user1");
      await pairingRepo.upsertRequest("discord", "user2");

      const tgCount = await pairingRepo.countPending("telegram");
      const dcCount = await pairingRepo.countPending("discord");

      expect(tgCount).toBe(1);
      expect(dcCount).toBe(1);
    });
  });
});

// ==================== ChannelBindingRepository 测试 ====================

describe("ChannelBindingRepository", () => {
  let bindingRepo: ChannelBindingRepository;

  beforeEach(() => {
    console.log("[TEST] ========== ChannelBindingRepository 测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    bindingRepo = getChannelBindingRepository(db);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== ChannelBindingRepository 测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("addBinding + listAllowedSenders", () => {
    it("CB-ADD-001: 应该添加绑定并出现在列表中", async () => {
      console.log("[TEST] ========== CB-ADD-001 ==========");

      const result = await bindingRepo.addBinding("telegram", "12345");

      console.log("[TEST] changed:", result.changed);
      console.log("[TEST] allowFrom:", result.allowFrom);

      expect(result.changed).toBe(true);
      expect(result.allowFrom).toContain("12345");
    });

    it("CB-ADD-002: 重复添加同一绑定不应改变", async () => {
      console.log("[TEST] ========== CB-ADD-002 ==========");

      const first = await bindingRepo.addBinding("telegram", "12345");
      const second = await bindingRepo.addBinding("telegram", "12345");

      expect(first.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(second.allowFrom).toHaveLength(1);
    });

    it("CB-ADD-003: 不同频道的同一用户应独立绑定", async () => {
      console.log("[TEST] ========== CB-ADD-003 ==========");

      await bindingRepo.addBinding("telegram", "12345");
      await bindingRepo.addBinding("discord", "12345");

      const tgList = await bindingRepo.listAllowedSenders("telegram");
      const dcList = await bindingRepo.listAllowedSenders("discord");

      expect(tgList).toContain("12345");
      expect(dcList).toContain("12345");
    });

    it("CB-ADD-004: 空字符串不应添加", async () => {
      console.log("[TEST] ========== CB-ADD-004 ==========");

      const result = await bindingRepo.addBinding("telegram", "  ");

      expect(result.changed).toBe(false);
    });

    it("CB-ADD-005: 应该支持 displayName", async () => {
      console.log("[TEST] ========== CB-ADD-005 ==========");

      await bindingRepo.addBinding("telegram", "12345", "Test User");
      const binding = await bindingRepo.findByChannelUser("telegram", "12345");

      expect(binding).not.toBeNull();
      expect(binding!.displayName).toBe("Test User");
    });
  });

  describe("removeBinding", () => {
    it("CB-REMOVE-001: 应该移除已有绑定", async () => {
      console.log("[TEST] ========== CB-REMOVE-001 ==========");

      await bindingRepo.addBinding("telegram", "12345");
      const result = await bindingRepo.removeBinding("telegram", "12345");

      expect(result.changed).toBe(true);
      expect(result.allowFrom).not.toContain("12345");
    });

    it("CB-REMOVE-002: 移除不存在的绑定不应报错", async () => {
      console.log("[TEST] ========== CB-REMOVE-002 ==========");

      const result = await bindingRepo.removeBinding("telegram", "99999");

      expect(result.changed).toBe(false);
    });
  });

  describe("isAllowed", () => {
    it("CB-ALLOWED-001: 已绑定用户应返回 true", async () => {
      console.log("[TEST] ========== CB-ALLOWED-001 ==========");

      await bindingRepo.addBinding("telegram", "12345");
      const allowed = await bindingRepo.isAllowed("telegram", "12345");

      expect(allowed).toBe(true);
    });

    it("CB-ALLOWED-002: 未绑定用户应返回 false", async () => {
      console.log("[TEST] ========== CB-ALLOWED-002 ==========");

      const allowed = await bindingRepo.isAllowed("telegram", "99999");

      expect(allowed).toBe(false);
    });
  });

  describe("findByChannelUser", () => {
    it("CB-FIND-001: 应该找到已有绑定", async () => {
      console.log("[TEST] ========== CB-FIND-001 ==========");

      await bindingRepo.addBinding("telegram", "12345", "Test User");
      const binding = await bindingRepo.findByChannelUser("telegram", "12345");

      expect(binding).not.toBeNull();
      expect(binding!.channelUserId).toBe("12345");
      expect(binding!.channel).toBe("telegram");
      expect(binding!.verified).toBe(true);
    });

    it("CB-FIND-002: 不存在应返回 null", async () => {
      console.log("[TEST] ========== CB-FIND-002 ==========");

      const binding = await bindingRepo.findByChannelUser("telegram", "99999");

      expect(binding).toBeNull();
    });
  });

  describe("listAllowedSenders", () => {
    it("CB-LIST-001: 空频道应返回空数组", async () => {
      console.log("[TEST] ========== CB-LIST-001 ==========");

      const list = await bindingRepo.listAllowedSenders("telegram");

      expect(list).toEqual([]);
    });

    it("CB-LIST-002: 应该返回所有已绑定的 ID", async () => {
      console.log("[TEST] ========== CB-LIST-002 ==========");

      await bindingRepo.addBinding("telegram", "user1");
      await bindingRepo.addBinding("telegram", "user2");
      await bindingRepo.addBinding("telegram", "user3");

      const list = await bindingRepo.listAllowedSenders("telegram");

      expect(list).toHaveLength(3);
      expect(list).toContain("user1");
      expect(list).toContain("user2");
      expect(list).toContain("user3");
    });
  });
});
