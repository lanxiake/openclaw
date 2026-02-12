/**
 * ConversationRepository 和 MessageRepository 测试
 *
 * 测试对话和消息的 CRUD 操作，以及多租户隔离
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearMockDatabase,
  disableMockDatabase,
  enableMockDatabase,
  getMockDatabase,
} from "../mock-connection.js";
import {
  ConversationRepository,
  MessageRepository,
  getConversationRepository,
  getMessageRepository,
} from "./conversations.js";

// ==================== ConversationRepository 测试 ====================

describe("ConversationRepository", () => {
  let convRepo: ConversationRepository;
  const testUserId = "user-conv-test-001";

  beforeEach(() => {
    console.log("[TEST] ========== ConversationRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    convRepo = getConversationRepository(db, testUserId);
    clearMockDatabase();
  });

  afterEach(() => {
    console.log("[TEST] ========== ConversationRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("CONV-CREATE-001: 应该创建对话并自动设置 userId", async () => {
      console.log("[TEST] ========== CONV-CREATE-001 ==========");
      console.log("[TEST] 测试创建对话");

      const conv = await convRepo.create({
        title: "测试对话",
        type: "chat",
      });

      console.log("[TEST] 创建的对话ID:", conv.id);
      console.log("[TEST] 对话 userId:", conv.userId);
      console.log("[TEST] 对话标题:", conv.title);

      expect(conv.id).toBeTruthy();
      expect(conv.userId).toBe(testUserId);
      expect(conv.title).toBe("测试对话");
      expect(conv.type).toBe("chat");
      expect(conv.status).toBe("active");
      expect(conv.messageCount).toBe(0);
      expect(conv.createdAt).toBeInstanceOf(Date);

      console.log("[TEST] ✓ 对话创建成功，userId 自动设置");
    });

    it("CONV-CREATE-002: 应该创建带完整配置的对话", async () => {
      console.log("[TEST] ========== CONV-CREATE-002 ==========");
      console.log("[TEST] 测试创建带完整配置的对话");

      const conv = await convRepo.create({
        title: "Agent 任务",
        type: "agent",
        deviceId: "device-001",
        agentConfig: {
          modelId: "gpt-4",
          temperature: 0.7,
          maxTokens: 4096,
        },
        metadata: { source: "web" },
      });

      console.log("[TEST] 对话类型:", conv.type);
      console.log("[TEST] Agent 配置:", JSON.stringify(conv.agentConfig));

      expect(conv.type).toBe("agent");
      expect(conv.deviceId).toBe("device-001");
      expect(conv.agentConfig?.modelId).toBe("gpt-4");
      expect(conv.metadata?.source).toBe("web");

      console.log("[TEST] ✓ 带完整配置的对话创建成功");
    });
  });

  describe("findById", () => {
    it("CONV-FIND-001: 应该根据 ID 查找自己的对话", async () => {
      console.log("[TEST] ========== CONV-FIND-001 ==========");
      console.log("[TEST] 测试查找自己的对话");

      const created = await convRepo.create({
        title: "查找测试",
        type: "chat",
      });

      const found = await convRepo.findById(created.id);

      console.log("[TEST] 查找结果:", found ? "找到" : "未找到");

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe("查找测试");

      console.log("[TEST] ✓ 成功查找到自己的对话");
    });

    it("CONV-FIND-002: 不存在的 ID 应该返回 null", async () => {
      console.log("[TEST] ========== CONV-FIND-002 ==========");
      console.log("[TEST] 测试查找不存在的对话");

      const found = await convRepo.findById("non-existent-id");

      expect(found).toBeNull();

      console.log("[TEST] ✓ 不存在的对话正确返回 null");
    });
  });

  describe("findAll", () => {
    it("CONV-FIND-003: 应该只返回当前用户的对话", async () => {
      console.log("[TEST] ========== CONV-FIND-003 ==========");
      console.log("[TEST] 测试 findAll 只返回当前用户的对话");

      // 创建两个对话
      await convRepo.create({ title: "对话1", type: "chat" });
      await convRepo.create({ title: "对话2", type: "task" });

      const result = await convRepo.findAll();

      console.log("[TEST] 查询到的对话数:", result.conversations.length);

      expect(result.conversations.length).toBe(2);
      expect(result.conversations.every((c) => c.userId === testUserId)).toBe(true);

      console.log("[TEST] ✓ findAll 正确返回当前用户的对话");
    });

    it("CONV-FIND-004: 应该支持分页", async () => {
      console.log("[TEST] ========== CONV-FIND-004 ==========");
      console.log("[TEST] 测试分页功能");

      // 创建 5 个对话
      for (let i = 1; i <= 5; i++) {
        await convRepo.create({ title: `对话${i}`, type: "chat" });
      }

      const page1 = await convRepo.findAll({ limit: 2, offset: 0 });
      const page2 = await convRepo.findAll({ limit: 2, offset: 2 });

      console.log("[TEST] 第一页数量:", page1.conversations.length);
      console.log("[TEST] 第二页数量:", page2.conversations.length);
      console.log("[TEST] 总数:", page1.total);

      expect(page1.conversations.length).toBe(2);
      expect(page2.conversations.length).toBe(2);
      expect(page1.total).toBe(5);

      console.log("[TEST] ✓ 分页功能正常");
    });

    it("CONV-FIND-005: 应该支持按状态过滤", async () => {
      console.log("[TEST] ========== CONV-FIND-005 ==========");
      console.log("[TEST] 测试按状态过滤");

      await convRepo.create({ title: "活跃对话", type: "chat" });
      const archived = await convRepo.create({ title: "归档对话", type: "chat" });
      await convRepo.updateStatus(archived.id, "archived");

      const activeOnly = await convRepo.findAll({ status: "active" });
      const archivedOnly = await convRepo.findAll({ status: "archived" });

      console.log("[TEST] 活跃对话数:", activeOnly.conversations.length);
      console.log("[TEST] 归档对话数:", archivedOnly.conversations.length);

      expect(activeOnly.conversations.length).toBe(1);
      expect(archivedOnly.conversations.length).toBe(1);

      console.log("[TEST] ✓ 按状态过滤正常");
    });
  });

  describe("update", () => {
    it("CONV-UPDATE-001: 应该更新对话标题", async () => {
      console.log("[TEST] ========== CONV-UPDATE-001 ==========");
      console.log("[TEST] 测试更新对话标题");

      const created = await convRepo.create({ title: "原标题", type: "chat" });
      const updated = await convRepo.update(created.id, { title: "新标题" });

      console.log("[TEST] 更新后标题:", updated?.title);

      expect(updated?.title).toBe("新标题");

      console.log("[TEST] ✓ 对话标题更新成功");
    });
  });

  describe("updateStatus", () => {
    it("CONV-STATUS-001: 应该更新对话状态", async () => {
      console.log("[TEST] ========== CONV-STATUS-001 ==========");
      console.log("[TEST] 测试更新对话状态");

      const created = await convRepo.create({ title: "测试", type: "chat" });
      const updated = await convRepo.updateStatus(created.id, "archived");

      console.log("[TEST] 更新后状态:", updated?.status);

      expect(updated?.status).toBe("archived");

      console.log("[TEST] ✓ 对话状态更新成功");
    });
  });

  describe("delete (soft)", () => {
    it("CONV-DELETE-001: 应该软删除对话", async () => {
      console.log("[TEST] ========== CONV-DELETE-001 ==========");
      console.log("[TEST] 测试软删除对话");

      const created = await convRepo.create({ title: "待删除", type: "chat" });
      await convRepo.softDelete(created.id);

      const found = await convRepo.findById(created.id);
      const activeList = await convRepo.findAll({ status: "active" });

      console.log("[TEST] 删除后查找结果:", found?.status);
      console.log(
        "[TEST] 活跃列表中是否存在:",
        activeList.conversations.some((c) => c.id === created.id),
      );

      expect(found?.status).toBe("deleted");
      expect(activeList.conversations.some((c) => c.id === created.id)).toBe(false);

      console.log("[TEST] ✓ 软删除成功");
    });
  });

  describe("tenant isolation", () => {
    it("CONV-TENANT-001: 不同用户的对话应该隔离", async () => {
      console.log("[TEST] ========== CONV-TENANT-001 ==========");
      console.log("[TEST] 测试多租户隔离");

      // 用户 A 创建对话
      const userAConv = await convRepo.create({ title: "用户A的对话", type: "chat" });

      // 切换到用户 B
      const db = getMockDatabase();
      const userBRepo = getConversationRepository(db, "user-B-different");

      // 用户 B 尝试查找用户 A 的对话
      const foundByB = await userBRepo.findById(userAConv.id);
      const userBList = await userBRepo.findAll();

      console.log("[TEST] 用户B查找用户A对话结果:", foundByB);
      console.log("[TEST] 用户B的对话列表数量:", userBList.conversations.length);

      expect(foundByB).toBeNull();
      expect(userBList.conversations.length).toBe(0);

      console.log("[TEST] ✓ 多租户隔离正常，用户B无法访问用户A的对话");
    });
  });
});

// ==================== MessageRepository 测试 ====================

describe("MessageRepository", () => {
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  const testUserId = "user-msg-test-001";
  let testConversationId: string;

  beforeEach(async () => {
    console.log("[TEST] ========== MessageRepository测试开始 ==========");
    enableMockDatabase();
    const db = getMockDatabase();
    convRepo = getConversationRepository(db, testUserId);
    msgRepo = getMessageRepository(db, testUserId);
    clearMockDatabase();

    // 创建测试对话
    const conv = await convRepo.create({ title: "消息测试对话", type: "chat" });
    testConversationId = conv.id;
    console.log("[TEST] 测试对话ID:", testConversationId);
  });

  afterEach(() => {
    console.log("[TEST] ========== MessageRepository测试结束 ==========\n");
    disableMockDatabase();
  });

  describe("create", () => {
    it("MSG-CREATE-001: 应该创建用户消息", async () => {
      console.log("[TEST] ========== MSG-CREATE-001 ==========");
      console.log("[TEST] 测试创建用户消息");

      const msg = await msgRepo.create({
        conversationId: testConversationId,
        role: "user",
        content: "你好，AI！",
      });

      console.log("[TEST] 消息ID:", msg.id);
      console.log("[TEST] 消息角色:", msg.role);
      console.log("[TEST] 消息内容:", msg.content);

      expect(msg.id).toBeTruthy();
      expect(msg.userId).toBe(testUserId);
      expect(msg.conversationId).toBe(testConversationId);
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("你好，AI！");
      expect(msg.contentType).toBe("text");

      console.log("[TEST] ✓ 用户消息创建成功");
    });

    it("MSG-CREATE-002: 应该创建 AI 回复消息", async () => {
      console.log("[TEST] ========== MSG-CREATE-002 ==========");
      console.log("[TEST] 测试创建 AI 回复消息");

      const msg = await msgRepo.create({
        conversationId: testConversationId,
        role: "assistant",
        content: "你好！有什么可以帮助你的？",
        modelId: "gpt-4",
        tokenCount: 15,
      });

      console.log("[TEST] 消息角色:", msg.role);
      console.log("[TEST] 模型ID:", msg.modelId);
      console.log("[TEST] Token数:", msg.tokenCount);

      expect(msg.role).toBe("assistant");
      expect(msg.modelId).toBe("gpt-4");
      expect(msg.tokenCount).toBe(15);

      console.log("[TEST] ✓ AI 回复消息创建成功");
    });

    it("MSG-CREATE-003: 应该创建带工具调用的消息", async () => {
      console.log("[TEST] ========== MSG-CREATE-003 ==========");
      console.log("[TEST] 测试创建带工具调用的消息");

      const msg = await msgRepo.create({
        conversationId: testConversationId,
        role: "assistant",
        content: null,
        toolCalls: [{ id: "call_1", name: "search", arguments: { query: "天气" } }],
      });

      console.log("[TEST] 工具调用:", JSON.stringify(msg.toolCalls));

      expect(msg.toolCalls).toHaveLength(1);
      expect(msg.toolCalls?.[0].name).toBe("search");

      console.log("[TEST] ✓ 带工具调用的消息创建成功");
    });
  });

  describe("findByConversation", () => {
    it("MSG-FIND-001: 应该按对话查询消息", async () => {
      console.log("[TEST] ========== MSG-FIND-001 ==========");
      console.log("[TEST] 测试按对话查询消息");

      await msgRepo.create({ conversationId: testConversationId, role: "user", content: "消息1" });
      await msgRepo.create({
        conversationId: testConversationId,
        role: "assistant",
        content: "消息2",
      });
      await msgRepo.create({ conversationId: testConversationId, role: "user", content: "消息3" });

      const result = await msgRepo.findByConversation(testConversationId);

      console.log("[TEST] 查询到的消息数:", result.messages.length);

      expect(result.messages.length).toBe(3);
      expect(result.total).toBe(3);

      console.log("[TEST] ✓ 按对话查询消息成功");
    });

    it("MSG-FIND-002: 应该支持分页", async () => {
      console.log("[TEST] ========== MSG-FIND-002 ==========");
      console.log("[TEST] 测试消息分页");

      for (let i = 1; i <= 5; i++) {
        await msgRepo.create({
          conversationId: testConversationId,
          role: "user",
          content: `消息${i}`,
        });
      }

      const page1 = await msgRepo.findByConversation(testConversationId, { limit: 2, offset: 0 });
      const page2 = await msgRepo.findByConversation(testConversationId, { limit: 2, offset: 2 });

      console.log("[TEST] 第一页数量:", page1.messages.length);
      console.log("[TEST] 第二页数量:", page2.messages.length);

      expect(page1.messages.length).toBe(2);
      expect(page2.messages.length).toBe(2);
      expect(page1.total).toBe(5);

      console.log("[TEST] ✓ 消息分页正常");
    });
  });

  describe("tenant isolation", () => {
    it("MSG-TENANT-001: 不同用户无法查看其他用户的消息", async () => {
      console.log("[TEST] ========== MSG-TENANT-001 ==========");
      console.log("[TEST] 测试消息多租户隔离");

      // 用户 A 创建消息
      await msgRepo.create({
        conversationId: testConversationId,
        role: "user",
        content: "用户A的消息",
      });

      // 切换到用户 B
      const db = getMockDatabase();
      const userBMsgRepo = getMessageRepository(db, "user-B-different");

      // 用户 B 尝试查询用户 A 的对话消息
      const userBResult = await userBMsgRepo.findByConversation(testConversationId);

      console.log("[TEST] 用户B查询到的消息数:", userBResult.messages.length);

      expect(userBResult.messages.length).toBe(0);

      console.log("[TEST] ✓ 消息多租户隔离正常");
    });
  });
});
