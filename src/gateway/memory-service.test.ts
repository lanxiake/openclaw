/**
 * Gateway 记忆服务测试
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GatewayMemoryService,
  getGatewayMemoryService,
  initializeGatewayMemoryService,
  shutdownGatewayMemoryService,
  resetGatewayMemoryService,
} from "./memory-service.js";

// 模拟 OpenClaw 配置
const mockConfig = {
  // 最小化配置
};

describe("GatewayMemoryService", () => {
  let service: GatewayMemoryService;

  beforeEach(() => {
    // 重置全局服务
    resetGatewayMemoryService();
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
    resetGatewayMemoryService();
  });

  describe("生命周期", () => {
    it("应该创建服务实例", () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false, // 禁用 SQLite 适配器以避免依赖
      });

      expect(service).toBeDefined();
      expect(service.status).toBe("uninitialized");
    });

    it("应该初始化服务", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      await service.initialize();
      expect(service.status).toBe("ready");
      expect(service.isReady).toBe(true);
    });

    it("应该关闭服务", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      await service.initialize();
      await service.shutdown();
      expect(service.status).toBe("shutdown");
      expect(service.isReady).toBe(false);
    });

    it("应该能重复初始化", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      await service.initialize();
      await service.initialize();
      expect(service.status).toBe("ready");
    });

    it("应该能重复关闭", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      await service.initialize();
      await service.shutdown();
      await service.shutdown();
      expect(service.status).toBe("shutdown");
    });
  });

  describe("记忆管理器访问", () => {
    beforeEach(async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });
      await service.initialize();
    });

    it("应该提供记忆管理器访问", () => {
      const manager = service.manager;
      expect(manager).toBeDefined();
    });

    it("未初始化时访问管理器应抛出错误", async () => {
      const uninitializedService = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      expect(() => uninitializedService.manager).toThrow("未初始化");
    });
  });

  describe("健康检查", () => {
    it("应该返回健康状态", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });
      await service.initialize();

      const health = await service.healthCheck();
      expect(health).toBeDefined();
      expect(health.status).toBe("ready");
      expect(health.checkedAt).toBeInstanceOf(Date);
    });

    it("未初始化时应返回未初始化状态", async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });

      const health = await service.healthCheck();
      expect(health.status).toBe("uninitialized");
    });
  });

  describe("便捷方法", () => {
    beforeEach(async () => {
      service = new GatewayMemoryService({
        openclawConfig: mockConfig as never,
        agentId: "test-agent",
        useSQLiteKnowledge: false,
      });
      await service.initialize();
    });

    it("应该创建会话", async () => {
      const sessionId = await service.createSession("user-123");
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
    });

    it("应该添加消息", async () => {
      const sessionId = await service.createSession("user-123");
      await service.addMessage(sessionId, "user", "Hello");
      // 验证消息已添加
      const messages = await service.manager.working.getMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("应该搜索知识库", async () => {
      const results = await service.searchKnowledge("user-123", "测试查询");
      expect(Array.isArray(results)).toBe(true);
    });

    it("应该添加用户事实", async () => {
      const factId = await service.addUserFact("user-123", "profession", "Software Engineer", 0.9);
      expect(factId).toBeDefined();
    });

    it("应该记录关键事件", async () => {
      await service.recordEvent("user-123", "task_completed", "完成任务", "session-1");
      // 验证事件已记录
      const events = await service.manager.episodic.getKeyEvents("user-123", {});
      expect(events).toHaveLength(1);
    });
  });
});

describe("全局服务管理", () => {
  beforeEach(() => {
    resetGatewayMemoryService();
  });

  afterEach(async () => {
    await shutdownGatewayMemoryService();
    resetGatewayMemoryService();
  });

  it("首次调用时应创建服务", () => {
    const service = getGatewayMemoryService({
      openclawConfig: {} as never,
      agentId: "test",
      useSQLiteKnowledge: false,
    });
    expect(service).toBeDefined();
  });

  it("重复调用应返回同一实例", () => {
    const service1 = getGatewayMemoryService({
      openclawConfig: {} as never,
      agentId: "test",
      useSQLiteKnowledge: false,
    });
    const service2 = getGatewayMemoryService();
    expect(service1).toBe(service2);
  });

  it("无配置首次调用应抛出错误", () => {
    expect(() => getGatewayMemoryService()).toThrow("首次调用必须提供配置");
  });

  it("应该初始化全局服务", async () => {
    const service = await initializeGatewayMemoryService({
      openclawConfig: {} as never,
      agentId: "test",
      useSQLiteKnowledge: false,
    });
    expect(service.isReady).toBe(true);
  });

  it("应该关闭全局服务", async () => {
    await initializeGatewayMemoryService({
      openclawConfig: {} as never,
      agentId: "test",
      useSQLiteKnowledge: false,
    });
    await shutdownGatewayMemoryService();
    // 关闭后重置，再次获取需要配置
    resetGatewayMemoryService();
    expect(() => getGatewayMemoryService()).toThrow("首次调用必须提供配置");
  });
});
