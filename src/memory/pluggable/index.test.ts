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
  createWorkingMemoryProvider,
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,
  createObjectStorageProvider,

  // 内置提供者
  MemoryWorkingMemoryProvider,
  MemoryEpisodicMemoryProvider,
  MemoryProfileMemoryProvider,
  SimpleKnowledgeMemoryProvider,
  LocalObjectStorageProvider,

  // 配置
  validateConfig,
  safeValidateConfig,
  DEFAULT_DEV_CONFIG,

  // 管理器
  MemoryManager,
  createMemoryManager,

  // 类型
  type IWorkingMemoryProvider,
  type HealthStatus,
} from "./index.js";

describe("MemoryProviderFactory", () => {
  beforeEach(() => {
    // 确保注册表干净
    clearRegistry();
    // 重新注册内置提供者
    registerProvider("working", "memory", MemoryWorkingMemoryProvider);
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
    registerProvider("storage", "local", LocalObjectStorageProvider);
  });

  afterEach(() => {
    clearRegistry();
  });

  describe("registerProvider", () => {
    it("应该成功注册提供者", () => {
      class TestProvider implements IWorkingMemoryProvider {
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

      registerProvider("working", "test", TestProvider);
      expect(hasProvider("working", "test")).toBe(true);
    });

    it("应该覆盖已存在的提供者", () => {
      class TestProvider1 implements IWorkingMemoryProvider {
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

      class TestProvider2 implements IWorkingMemoryProvider {
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

      registerProvider("working", "dup", TestProvider1);
      registerProvider("working", "dup", TestProvider2);

      const provider = createProvider<IWorkingMemoryProvider>("working", {
        provider: "dup",
        options: {},
      });
      expect(provider.name).toBe("test2");
    });
  });

  describe("unregisterProvider", () => {
    it("应该成功注销提供者", () => {
      expect(hasProvider("working", "memory")).toBe(true);
      const result = unregisterProvider("working", "memory");
      expect(result).toBe(true);
      expect(hasProvider("working", "memory")).toBe(false);
    });

    it("应该对不存在的提供者返回 false", () => {
      const result = unregisterProvider("working", "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("createProvider", () => {
    it("应该成功创建已注册的提供者", () => {
      const provider = createProvider<IWorkingMemoryProvider>("working", {
        provider: "memory",
        options: {},
      });

      expect(provider).toBeInstanceOf(MemoryWorkingMemoryProvider);
      expect(provider.name).toBe("memory-working");
    });

    it("应该对未注册的提供者抛出错误", () => {
      expect(() => {
        createProvider("working", { provider: "nonexistent", options: {} });
      }).toThrow(/未知的记忆提供者/);
    });
  });

  describe("getAvailableProviders", () => {
    it("应该返回已注册的提供者列表", () => {
      const providers = getAvailableProviders("working");
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
      expect(all).toContainEqual({ type: "working", name: "memory" });
    });
  });

  describe("createWorkingMemoryProvider", () => {
    it("应该创建工作记忆提供者", () => {
      const provider = createWorkingMemoryProvider({
        provider: "memory",
        options: {},
      });

      expect(provider).toBeInstanceOf(MemoryWorkingMemoryProvider);
    });
  });
});

describe("MemoryWorkingMemoryProvider", () => {
  let provider: MemoryWorkingMemoryProvider;

  beforeEach(async () => {
    provider = new MemoryWorkingMemoryProvider();
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe("会话管理", () => {
    it("应该创建会话", async () => {
      const sessionId = await provider.createSession("user-123");
      expect(sessionId).toBeTruthy();

      const session = await provider.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe("user-123");
    });

    it("应该删除会话", async () => {
      const sessionId = await provider.createSession("user-123");
      await provider.deleteSession(sessionId);

      const session = await provider.getSession(sessionId);
      expect(session).toBeNull();
    });

    it("应该列出用户会话", async () => {
      await provider.createSession("user-123");
      await provider.createSession("user-123");
      await provider.createSession("user-456");

      const sessions = await provider.listSessions("user-123");
      expect(sessions).toHaveLength(2);
    });
  });

  describe("消息管理", () => {
    it("应该添加和获取消息", async () => {
      const sessionId = await provider.createSession("user-123");

      await provider.addMessage(sessionId, {
        role: "user",
        content: "Hello",
      });
      await provider.addMessage(sessionId, {
        role: "assistant",
        content: "Hi there!",
      });

      const messages = await provider.getMessages(sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Hello");
      expect(messages[1].content).toBe("Hi there!");
    });

    it("应该限制返回消息数量", async () => {
      const sessionId = await provider.createSession("user-123");

      for (let i = 0; i < 10; i++) {
        await provider.addMessage(sessionId, {
          role: "user",
          content: `Message ${i}`,
        });
      }

      const messages = await provider.getMessages(sessionId, 3);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("Message 7");
    });

    it("应该按 token 限制获取上下文窗口", async () => {
      const sessionId = await provider.createSession("user-123");

      // 每条消息约 10 个 token (40 字符 / 4)
      await provider.addMessage(sessionId, {
        role: "user",
        content: "A".repeat(40),
      });
      await provider.addMessage(sessionId, {
        role: "user",
        content: "B".repeat(40),
      });
      await provider.addMessage(sessionId, {
        role: "user",
        content: "C".repeat(40),
      });

      const messages = await provider.getContextWindow(sessionId, 25);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("B".repeat(40));
    });
  });

  describe("变量管理", () => {
    it("应该设置和获取变量", async () => {
      const sessionId = await provider.createSession("user-123");

      await provider.setVariable(sessionId, "foo", "bar");
      const value = await provider.getVariable(sessionId, "foo");
      expect(value).toBe("bar");
    });

    it("应该清除变量", async () => {
      const sessionId = await provider.createSession("user-123");

      await provider.setVariable(sessionId, "foo", "bar");
      await provider.clearVariables(sessionId);

      const value = await provider.getVariable(sessionId, "foo");
      expect(value).toBeUndefined();
    });
  });

  describe("健康检查", () => {
    it("应该返回健康状态", async () => {
      const status = await provider.healthCheck();
      expect(status.status).toBe("healthy");
      expect(status.latency).toBe(0);
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

  describe("实体管理", () => {
    it("应该添加和获取实体", async () => {
      const userId = "user-123";
      const entityId = await provider.addEntity(userId, {
        name: "张三",
        type: "person",
        properties: { age: 30 },
      });

      const entity = await provider.getEntity(userId, entityId);
      expect(entity).toBeTruthy();
      expect(entity?.name).toBe("张三");
    });
  });
});

describe("LocalObjectStorageProvider", () => {
  let provider: LocalObjectStorageProvider;
  const testBasePath = "./.test-storage-" + Date.now();

  beforeEach(async () => {
    provider = new LocalObjectStorageProvider({
      provider: "local",
      options: { basePath: testBasePath },
    });
    await provider.initialize();
  });

  afterEach(async () => {
    await provider.shutdown();
    // 清理测试目录
    const fs = await import("node:fs/promises");
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch {
      // 忽略错误
    }
  });

  describe("存储桶管理", () => {
    it("应该创建和列出存储桶", async () => {
      await provider.createBucket("test-bucket");

      const buckets = await provider.listBuckets();
      expect(buckets.some((b) => b.name === "test-bucket")).toBe(true);
    });

    it("应该检查存储桶是否存在", async () => {
      await provider.createBucket("exists-bucket");

      expect(await provider.bucketExists("exists-bucket")).toBe(true);
      expect(await provider.bucketExists("not-exists")).toBe(false);
    });
  });

  describe("文件操作", () => {
    it("应该上传和下载文件", async () => {
      await provider.createBucket("files");

      const content = Buffer.from("Hello, World!");
      await provider.upload("files", "test.txt", content);

      const downloaded = await provider.download("files", "test.txt");
      expect(downloaded.toString()).toBe("Hello, World!");
    });

    it("应该检查文件是否存在", async () => {
      await provider.createBucket("files");
      await provider.upload("files", "exists.txt", Buffer.from("test"));

      expect(await provider.exists("files", "exists.txt")).toBe(true);
      expect(await provider.exists("files", "not-exists.txt")).toBe(false);
    });

    it("应该列出文件", async () => {
      await provider.createBucket("files");
      await provider.upload("files", "file1.txt", Buffer.from("1"));
      await provider.upload("files", "file2.txt", Buffer.from("2"));

      const result = await provider.list("files");
      expect(result.objects).toHaveLength(2);
    });
  });
});

describe("工厂快捷方法", () => {
  beforeEach(() => {
    clearRegistry();
    registerProvider("working", "memory", MemoryWorkingMemoryProvider);
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
    registerProvider("storage", "local", LocalObjectStorageProvider);
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

  it("应该创建对象存储提供者", () => {
    const provider = createObjectStorageProvider({
      provider: "local",
      options: { basePath: "./.test" },
    });
    expect(provider).toBeInstanceOf(LocalObjectStorageProvider);
  });
});

describe("MemoryManager", () => {
  beforeEach(() => {
    clearRegistry();
    registerProvider("working", "memory", MemoryWorkingMemoryProvider);
    registerProvider("episodic", "memory", MemoryEpisodicMemoryProvider);
    registerProvider("profile", "memory", MemoryProfileMemoryProvider);
    registerProvider("knowledge", "simple", SimpleKnowledgeMemoryProvider);
    registerProvider("storage", "local", LocalObjectStorageProvider);
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
    it("应该提供工作记忆访问", async () => {
      const manager = new MemoryManager({
        config: DEFAULT_DEV_CONFIG,
      });
      await manager.initialize();

      const sessionId = await manager.working.createSession("user-123");
      expect(sessionId).toBeTruthy();

      await manager.shutdown();
    });

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

      expect(() => manager.working).toThrow("未初始化");
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
      expect(health.providers.working?.status).toBe("healthy");
      expect(health.providers.episodic?.status).toBe("healthy");
      expect(health.providers.profile?.status).toBe("healthy");
      expect(health.providers.knowledge?.status).toBe("healthy");
      expect(health.providers.storage?.status).toBe("healthy");
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
