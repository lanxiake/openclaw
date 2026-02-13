/**
 * 消息持久化服务测试
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import * as userContextStore from "./user-context-store.js";
import type { UserAgentContext } from "./user-context.js";
import {
  persistUserMessage,
  persistAssistantMessage,
  getConversationHistory,
  getUserConversations,
} from "./message-persistence.js";

// Mock 数据库连接和仓库
vi.mock("../db/connection.js", () => ({
  getDatabase: vi.fn(() => ({})),
}));

vi.mock("../db/repositories/conversations.js", () => {
  const mockConversationRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    incrementMessageCount: vi.fn(),
  };

  const mockMessageRepo = {
    create: vi.fn(),
    findByConversation: vi.fn(),
  };

  return {
    getConversationRepository: vi.fn(() => mockConversationRepo),
    getMessageRepository: vi.fn(() => mockMessageRepo),
    __mockConversationRepo: mockConversationRepo,
    __mockMessageRepo: mockMessageRepo,
  };
});

// 获取 mock 仓库引用
const getMockRepos = async () => {
  const module = await import("../db/repositories/conversations.js");
  return {
    conversationRepo: (module as unknown as { __mockConversationRepo: ReturnType<typeof vi.fn> })
      .__mockConversationRepo,
    messageRepo: (module as unknown as { __mockMessageRepo: ReturnType<typeof vi.fn> })
      .__mockMessageRepo,
  };
};

describe("message-persistence", () => {
  const mockUserContext: UserAgentContext = {
    userId: "test-user-123",
    isDefaultUser: false,
    devices: [],
    quotas: [],
    loadedAt: new Date(),
    assistantConfig: {
      configId: "config-1",
      name: "Test Config",
      systemPrompt: "Be helpful",
      modelConfig: {
        modelId: "gpt-4",
        temperature: 0.7,
      },
    },
  };

  const defaultUserContext: UserAgentContext = {
    userId: "default",
    isDefaultUser: true,
    devices: [],
    quotas: [],
    loadedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("persistUserMessage", () => {
    it("默认用户跳过持久化", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(defaultUserContext);

      const result = await persistUserMessage({
        content: "Hello",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });

    it("无用户上下文跳过持久化", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(undefined);

      const result = await persistUserMessage({
        content: "Hello",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });

    it("创建新对话并持久化消息", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo, messageRepo } = await getMockRepos();

      conversationRepo.create.mockResolvedValue({
        id: "conv-123",
        userId: "test-user-123",
        title: "Hello",
        type: "chat",
        status: "active",
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      messageRepo.create.mockResolvedValue({
        id: "msg-456",
        conversationId: "conv-123",
        userId: "test-user-123",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      });

      conversationRepo.incrementMessageCount.mockResolvedValue(undefined);

      const result = await persistUserMessage({
        content: "Hello",
        deviceId: "device-1",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-456");
      expect(result.conversationId).toBe("conv-123");
      expect(conversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Hello",
          type: "chat",
          deviceId: "device-1",
        }),
      );
      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conv-123",
          role: "user",
          content: "Hello",
        }),
      );
      expect(conversationRepo.incrementMessageCount).toHaveBeenCalledWith("conv-123");
    });

    it("在现有对话中持久化消息", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo, messageRepo } = await getMockRepos();

      messageRepo.create.mockResolvedValue({
        id: "msg-789",
        conversationId: "existing-conv",
        userId: "test-user-123",
        role: "user",
        content: "Follow up message",
        createdAt: new Date(),
      });

      conversationRepo.incrementMessageCount.mockResolvedValue(undefined);

      const result = await persistUserMessage({
        conversationId: "existing-conv",
        content: "Follow up message",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-789");
      expect(result.conversationId).toBe("existing-conv");
      expect(conversationRepo.create).not.toHaveBeenCalled();
    });

    it("长消息标题截断", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo, messageRepo } = await getMockRepos();

      const longContent =
        "This is a very long message that should be truncated when used as a conversation title";

      conversationRepo.create.mockResolvedValue({
        id: "conv-123",
        userId: "test-user-123",
        title: longContent.slice(0, 47) + "...",
        type: "chat",
        status: "active",
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      messageRepo.create.mockResolvedValue({
        id: "msg-456",
        conversationId: "conv-123",
        userId: "test-user-123",
        role: "user",
        content: longContent,
        createdAt: new Date(),
      });

      conversationRepo.incrementMessageCount.mockResolvedValue(undefined);

      await persistUserMessage({
        content: longContent,
      });

      expect(conversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^.{50}$/),
        }),
      );
    });

    it("处理数据库错误", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo } = await getMockRepos();

      conversationRepo.create.mockRejectedValue(new Error("Database connection failed"));

      const result = await persistUserMessage({
        content: "Hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("persistAssistantMessage", () => {
    it("默认用户跳过持久化", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(defaultUserContext);

      const result = await persistAssistantMessage({
        conversationId: "conv-123",
        content: "Hello! How can I help?",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });

    it("成功持久化 AI 回复", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo, messageRepo } = await getMockRepos();

      conversationRepo.findById.mockResolvedValue({
        id: "conv-123",
        userId: "test-user-123",
        title: "Test",
        type: "chat",
        status: "active",
        messageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      messageRepo.create.mockResolvedValue({
        id: "msg-789",
        conversationId: "conv-123",
        userId: "test-user-123",
        role: "assistant",
        content: "Hello! How can I help?",
        tokenCount: 150,
        modelId: "gpt-4",
        createdAt: new Date(),
      });

      conversationRepo.incrementMessageCount.mockResolvedValue(undefined);

      const result = await persistAssistantMessage({
        conversationId: "conv-123",
        content: "Hello! How can I help?",
        tokenCount: 150,
        modelId: "gpt-4",
        toolCalls: [{ name: "search", args: { query: "test" } }],
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-789");
      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conv-123",
          role: "assistant",
          content: "Hello! How can I help?",
          tokenCount: 150,
          modelId: "gpt-4",
          toolCalls: [{ name: "search", args: { query: "test" } }],
        }),
      );
    });

    it("对话不存在时返回错误", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo } = await getMockRepos();

      conversationRepo.findById.mockResolvedValue(null);

      const result = await persistAssistantMessage({
        conversationId: "non-existent",
        content: "Hello!",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Conversation not found");
    });
  });

  describe("getConversationHistory", () => {
    it("默认用户返回 null", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(defaultUserContext);

      const result = await getConversationHistory("conv-123");

      expect(result).toBeNull();
    });

    it("成功获取对话历史", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo, messageRepo } = await getMockRepos();

      conversationRepo.findById.mockResolvedValue({
        id: "conv-123",
        userId: "test-user-123",
        title: "Test",
        type: "chat",
        status: "active",
        messageCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockMessages = [
        { id: "msg-1", role: "user", content: "Hello" },
        { id: "msg-2", role: "assistant", content: "Hi there!" },
      ];

      messageRepo.findByConversation.mockResolvedValue({
        messages: mockMessages,
        total: 2,
      });

      const result = await getConversationHistory("conv-123", { limit: 10 });

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2);
      expect(result?.total).toBe(2);
    });

    it("对话不存在返回 null", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo } = await getMockRepos();

      conversationRepo.findById.mockResolvedValue(null);

      const result = await getConversationHistory("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getUserConversations", () => {
    it("默认用户返回 null", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(defaultUserContext);

      const result = await getUserConversations();

      expect(result).toBeNull();
    });

    it("成功获取对话列表", async () => {
      vi.spyOn(userContextStore, "getUserContext").mockReturnValue(mockUserContext);

      const { conversationRepo } = await getMockRepos();

      const mockConversations = [
        { id: "conv-1", title: "Chat 1", type: "chat" },
        { id: "conv-2", title: "Chat 2", type: "chat" },
      ];

      conversationRepo.findAll.mockResolvedValue({
        conversations: mockConversations,
        total: 2,
      });

      const result = await getUserConversations({ limit: 10, status: "active" });

      expect(result).not.toBeNull();
      expect(result?.conversations).toHaveLength(2);
      expect(result?.total).toBe(2);
      expect(conversationRepo.findAll).toHaveBeenCalledWith({ limit: 10, status: "active" });
    });
  });
});
