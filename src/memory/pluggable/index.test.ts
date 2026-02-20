/**
 * 可插拔记忆系统测试
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  // 工厂
  registerProvider,
  unregisterProvider,
  createProvider,
  getAvailableProviders,
  hasProvider,
  getAllProviders,
  clearRegistry,
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,

  // 内置提供者
  MemoryEpisodicMemoryProvider,
  MemoryProfileMemoryProvider,
  SimpleKnowledgeMemoryProvider,

  // 配置
  validateConfig,
  safeValidateConfig,
  DEFAULT_DEV_CONFIG,

  // 管理器
  MemoryManager,
  createMemoryManager,

  // 类型
  type IEpisodicMemoryProvider,
  type HealthStatus,
} from "./index.js";

describe("MemoryProviderFactory", () => {
  beforeEach(() => {
    // 确保注册表干净
    clearRegistry();
    // 重新注册内置提供者
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("registerProvider", () => {
    it("应该成功注册提供者", () => {
      class TestProvider implements IEpisodicMemoryProvider {
        readonly name = "test";
        readonly version = "1.0.0";
        async initialize() {}
        async shutdown() {}
        async healthCheck(): Promise<HealthStatus> {
          return { status: "healthy", latency: 0 };
        }
        async createSession() {
          return "test-session";
        }
        async getSession() {
          return null;
        }
        async updateSession() {}
        async deleteSession() {}
        async listSessions() {
          return [];
        }
        async addMessage() {
          return "test-msg";
        }
        async getMessages() {
          return [];
        }
        async getContextWindow() {
          return [];
        }
        async setVariable() {}
        async getVariable() {
          return undefined;
        }
        async clearVariables() {}
        async addToolState() {}
        async updateToolState() {}
        async getToolStates() {
          return [];
        }
        async addPendingConfirm() {
          return "test-confirm";
        }
        async resolvePendingConfirm() {}
        async getPendingConfirms() {
          return [];
        }
      }

      registerProvider("episodic", "test", TestProvider);
      expect(hasProvider("episodic", "test")).toBe(true);
    });

    it("应该覆盖已存在的提供者", () => {
      class TestProvider1 implements IEpisodicMemoryProvider {
        readonly name = "test1";
        readonly version = "1.0.0";
        async initialize() {}
        async shutdown() {}
        async healthCheck(): Promise<HealthStatus> {
          return { status: "healthy", latency: 0 };
        }
        async createSession() {
          return "v1";
        }
        async getSession() {
          return null;
        }
        async updateSession() {}
        async deleteSession() {}
        async listSessions() {
          return [];
        }
        async addMessage() {
          return "v1";
        }
        async getMessages() {
          return [];
        }
        async getContextWindow() {
          return [];
        }
        async setVariable() {}
        async getVariable() {
          return undefined;
        }
        async clearVariables() {}
        async addToolState() {}
        async updateToolState() {}
        async getToolStates() {
          return [];
        }
        async addPendingConfirm() {
          return "v1";
        }
        async resolvePendingConfirm() {}
        async getPendingConfirms() {
          return [];
        }
      }

      class TestProvider2 implements IEpisodicMemoryProvider {
        readonly name = "test2";
        readonly version = "2.0.0";
        async initialize() {}
        async shutdown() {}
        async healthCheck(): Promise<HealthStatus> {
          return { status: "healthy", latency: 0 };
        }
        async createSession() {
          return "v2";
        }
        async getSession() {
          return null;
        }
        async updateSession() {}
        async deleteSession() {}
        async listSessions() {
          return [];
        }
        async addMessage() {
          return "v2";
        }
        async getMessages() {
          return [];
        }
        async getContextWindow() {
          return [];
        }
        async setVariable() {}
        async getVariable() {
          return undefined;
        }
        async clearVariables() {}
        async addToolState() {}
        async updateToolState() {}
        async getToolStates() {
          return [];
        }
        async addPendingConfirm() {
          return "v2";
        }
        async resolvePendingConfirm() {}
        async getPendingConfirms() {
          return [];
        }
      }

      registerProvider("episodic", "dup", TestProvider1);
      registerProvider("episodic", "dup", TestProvider2);

      const provider = createProvider<IEpisodicMemoryProvider>("episodic", {
        provider: "dup",
        options: {},
      });
      expect(provider.name).toBe("test2");
    });
  });

  describe("unregisterProvider", () => {
    it("应该成功注销提供者", () => {
      expect(hasProvider("episodic", "memory")).toBe(true);
      const result = unregisterProvider("episodic", "memory");
      expect(result).toBe(true);
      expect(hasProvider("episodic", "memory")).toBe(false);
    });

    it("应该对不存在的提供者返回 false", () => {
      const result = unregisterProvider("episodic", "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("createProvider", () => {
    it("应该成功创建已注册的提供者", () => {
      const provider = createProvider<IEpisodicMemoryProvider>("episodic", {
        provider: "memory",
        options: {},
      });

      expect(provider).toBeInstanceOf(MemoryEpisodicMemoryProvider);
      expect(provider.name).toBe("memory-episodic");
    });

    it("应该对未注册的提供者抛出错误", () => {
      expect(() => {
        createProvider("episodic", { provider: "nonexistent", options: {} });
      }).toThrow(/未知的记忆提供者/);
    });
  });

  describe("getAvailableProviders", () => {
    it("应该返回已注册的提供者列表", () => {
      const providers = getAvailableProviders("episodic");
      expect(providers).toContain("memory");
    });

    it("应该对无提供者的类型返回空数组", () => {
      // 注销 episodic 提供者后测试
      unregisterProvider("episodic", "memory");
      const providers = getAvailableProviders("episodic");
      expect(providers).toEqual([]);
    });
  });

  describe("getAllProviders", () => {
    it("应该返回所有已注册的提供者", () => {
      const all = getAllProviders();
      expect(all).toContainEqual({ type: "episodic", name: "memory" });
    });
  });
});
describe("配置验证", () => {
  describe("validateConfig", () => {
    it("应该验证有效配置", () => {
      const config = validateConfig(DEFAULT_DEV_CONFIG);
      expect(config).toEqual(DEFAULT_DEV_CONFIG);
    });

    it("应该对无效配置抛出错误", () => {
      expect(() => {
        validateConfig({});
      }).toThrow();
    });
  });

  describe("safeValidateConfig", () => {
    it("应该对有效配置返回成功", () => {
      const result = safeValidateConfig(DEFAULT_DEV_CONFIG);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(DEFAULT_DEV_CONFIG);
    });

    it("应该对无效配置返回错误", () => {
      const result = safeValidateConfig({});
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});

describe("MemoryEpisodicMemoryProvider", () => {
  let provider: MemoryEpisodicMemoryProvider;

  beforeEach(async () => {
    provider = new MemoryEpisodicMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe("对话历史", () => {
    it("应该添加对话并生成摘要", async () => {
      const userId = "user-123";
      const sessionId = "session-456";
      const messages = [
        { id: "1", role: "user" as const, content: "我喜欢编程和音乐", timestamp: new Date() },
        {
          id: "2",
          role: "assistant" as const,
          content: "很好！你喜欢什么编程语言？",
          timestamp: new Date(),
        },
      ];

      await provider.addConversation(userId, sessionId, messages);
      const summary = await provider.summarizeConversation(userId, sessionId);

      expect(summary).toBeTruthy();
      expect(summary.sessionId).toBe(sessionId);
      expect(summary.messageCount).toBe(2);
    });

    it("应该获取对话历史", async () => {
      const userId = "user-123";

      // 添加多个对话
      await provider.addConversation(userId, "session-1", [
        { id: "1", role: "user" as const, content: "Hello", timestamp: new Date() },
      ]);
      await provider.summarizeConversation(userId, "session-1");

      await provider.addConversation(userId, "session-2", [
        { id: "2", role: "user" as const, content: "World", timestamp: new Date() },
      ]);
      await provider.summarizeConversation(userId, "session-2");

      const history = await provider.getConversationHistory(userId);
      expect(history).toHaveLength(2);
    });
  });

  describe("关键事件", () => {
    it("应该添加和获取关键事件", async () => {
      const userId = "user-123";
      const eventId = await provider.addKeyEvent(userId, {
        type: "task_completed",
        description: "完成了项目文档",
        context: "项目管理相关",
        importance: 0.8,
        relatedSessions: [],
        timestamp: new Date(),
      });

      const events = await provider.getKeyEvents(userId);
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(eventId);
    });
  });
});

describe("MemoryProfileMemoryProvider", () => {
  let provider: MemoryProfileMemoryProvider;

  beforeEach(async () => {
    provider = new MemoryProfileMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe("事实管理", () => {
    it("应该添加和获取事实", async () => {
      const userId = "user-123";
      const factId = await provider.addFact(userId, {
        category: "work",
        key: "company",
        value: "OpenClaw",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });

      const facts = await provider.getFacts(userId);
      expect(facts).toHaveLength(1);
      expect(facts[0].id).toBe(factId);
      expect(facts[0].value).toBe("OpenClaw");
    });

    it("应该搜索事实", async () => {
      const userId = "user-123";
      await provider.addFact(userId, {
        category: "personal",
        key: "name",
        value: "张三",
        confidence: 1.0,
        source: "explicit",
        sensitive: false,
      });

      const results = await provider.searchFacts(userId, "张三");
      expect(results).toHaveLength(1);
    });
  });

  describe("偏好管理", () => {
    it("应该获取默认偏好", async () => {
      const prefs = await provider.getPreferences("user-123");
      expect(prefs.language).toBe("zh-CN");
      expect(prefs.responseStyle).toBe("detailed");
    });

    it("应该更新偏好", async () => {
      const userId = "user-123";
      await provider.updatePreferences(userId, {
        language: "en-US",
        responseStyle: "concise",
      });

      const prefs = await provider.getPreferences(userId);
      expect(prefs.language).toBe("en-US");
      expect(prefs.responseStyle).toBe("concise");
    });
  });
});

describe("SimpleKnowledgeMemoryProvider", () => {
  let provider: SimpleKnowledgeMemoryProvider;

  beforeEach(async () => {
    provider = new SimpleKnowledgeMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe("文档管理", () => {
    it("应该添加和获取文档", async () => {
      const userId = "user-123";
      const docId = await provider.addDocument(userId, {
        title: "测试文档",
        content: Buffer.from("这是测试内容"),
        mimeType: "text/plain",
        source: "upload",
      });

      const doc = await provider.getDocument(userId, docId);
      expect(doc).toBeTruthy();
      expect(doc?.title).toBe("测试文档");
      expect(doc?.status).toBe("indexed");
    });

    it("应该搜索文档", async () => {
      const userId = "user-123";
      await provider.addDocument(userId, {
        title: "编程指南",
        content: Buffer.from("TypeScript 是一种强类型的编程语言"),
        mimeType: "text/plain",
        source: "upload",
      });

      const results = await provider.searchSimilar(userId, "TypeScript");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
describe("工厂快捷方法", () => {
  beforeEach(() => {
    clearRegistry();
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
  });

  afterEach(() => {
    clearRegistry();
  });

  it("应该创建情节记忆提供者", () => {
    const provider = createEpisodicMemoryProvider({ provider: "memory", options: {} });
    expect(provider).toBeInstanceOf(MemoryEpisodicMemoryProvider);
  });

  it("应该创建画像记忆提供者", () => {
    const provider = createProfileMemoryProvider({ provider: "memory", options: {} });
    expect(provider).toBeInstanceOf(MemoryProfileMemoryProvider);
  });

  it("应该创建知识记忆提供者", () => {
    const provider = createKnowledgeMemoryProvider({ provider: "simple", options: {} });
    expect(provider).toBeInstanceOf(SimpleKnowledgeMemoryProvider);
  });
});

describe("MemoryManager", () => {
  beforeEach(() => {
    clearRegistry();
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("生命周期管理", () => {
    it("应该初始化所有提供者", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });

      expect(manager.status).toBe("uninitialized");

      await manager.initialize();

      expect(manager.status).toBe("ready");

      await manager.shutdown();
      expect(manager.status).toBe("shutdown");
    });

    it("应该正确关闭", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });

      await manager.initialize();
      await manager.shutdown();

      expect(manager.status).toBe("shutdown");
    });
  });

  describe("提供者访问", () => {
    it("应该提供情节记忆访问", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });
      await manager.initialize();

      await manager.episodic.addConversation("user-123", "session-1", [
        { id: "1", role: "user", content: "Hello", timestamp: new Date() },
      ]);

      await manager.shutdown();
    });

    it("应该提供画像记忆访问", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });
      await manager.initialize();

      const prefs = await manager.profile.getPreferences("user-123");
      expect(prefs.language).toBe("zh-CN");

      await manager.shutdown();
    });

    it("未初始化时访问提供者应抛出错误", () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });

      expect(() => manager.episodic).toThrow("未初始化");
    });
  });

  describe("健康检查", () => {
    it("应该返回健康状态", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });
      await manager.initialize();

      const health = await manager.healthCheck();

      expect(health.status).toBe("ready");
      expect(health.providers.episodic?.status).toBe("healthy");
      expect(health.providers.profile?.status).toBe("healthy");
      expect(health.providers.knowledge?.status).toBe("healthy");
      expect(health.checkedAt).toBeInstanceOf(Date);

      await manager.shutdown();
    });
  });

  describe("createMemoryManager 工厂函数", () => {
    it("应该创建管理器实例", async () => {
      const manager = createMemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });

      expect(manager).toBeInstanceOf(MemoryManager);
      expect(manager.status).toBe("uninitialized");

      await manager.initialize();
      expect(manager.status).toBe("ready");

      await manager.shutdown();
    });
  });
});
