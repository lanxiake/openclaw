/**
 * PostgreSQL 画像记忆提供者单元测试
 *
 * 使用 mock Repository 层验证 Provider 的接口映射逻辑。
 * 不需要真实 DB 连接。
 *
 * @module memory/pluggable/providers/profile
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type {
  UserFactRecord,
  BehaviorPatternRecord,
  UserPreferencesV2Record,
} from "../../../db/schema/profile-memory.js";
import type {
  UserFact,
  UserPreferences,
  BehaviorPattern,
} from "../../interfaces/profile-memory.js";
import { DEFAULT_USER_PREFERENCES } from "../../interfaces/profile-memory.js";

// ==================== Mock Repository 工厂 ====================

/**
 * 创建 mock UserFactRepository
 */
function createMockFactRepo() {
  return {
    tenantId: "user-123",
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    search: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * 创建 mock UserPreferencesV2Repository
 */
function createMockPrefsRepo() {
  return {
    tenantId: "user-123",
    get: vi.fn(),
    getOrCreate: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addFavoriteSkill: vi.fn(),
    removeFavoriteSkill: vi.fn(),
    disableSkill: vi.fn(),
    enableSkill: vi.fn(),
  };
}

/**
 * 创建 mock BehaviorPatternRepository
 */
function createMockPatternRepo() {
  return {
    tenantId: "user-123",
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findHighConfidenceByType: vi.fn(),
    update: vi.fn(),
    addEvidence: vi.fn(),
    confirm: vi.fn(),
    deactivate: vi.fn(),
    delete: vi.fn(),
  };
}

// ==================== Mock DB Record 工厂 ====================

/**
 * 创建模拟的 DB 事实记录
 */
function createMockFactRecord(overrides?: Partial<UserFactRecord>): UserFactRecord {
  return {
    id: "fact-001",
    userId: "user-123",
    category: "work",
    key: "company",
    value: "MtBot",
    confidence: 0.9,
    source: "explicit",
    extractedFrom: null,
    sensitive: false,
    validUntil: null,
    metadata: null,
    isActive: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
    ...overrides,
  };
}

/**
 * 创建模拟的 DB 偏好记录
 */
function createMockPrefsRecord(
  overrides?: Partial<UserPreferencesV2Record>,
): UserPreferencesV2Record {
  return {
    id: "prefs-001",
    userId: "user-123",
    language: "zh-CN",
    timezone: "Asia/Shanghai",
    responseStyle: "detailed",
    confirmLevel: "medium",
    favoriteSkills: [],
    disabledSkills: [],
    thinkingLevel: "medium",
    verboseLevel: "normal",
    notifications: { enabled: true, channels: [] },
    metadata: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
    ...overrides,
  };
}

/**
 * 创建模拟的 DB 行为模式记录
 */
function createMockPatternRecord(
  overrides?: Partial<BehaviorPatternRecord>,
): BehaviorPatternRecord {
  return {
    id: "pattern-001",
    userId: "user-123",
    type: "work_style",
    pattern: "偏好在早上处理复杂任务",
    evidence: ["多次在上午提问技术问题"],
    confidence: 0.7,
    confirmed: null,
    metadata: null,
    isActive: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-02"),
    ...overrides,
  };
}

// ==================== 导入被测模块（延迟导入，便于后续 mock） ====================

// 我们将在测试中动态导入 PostgresProfileMemoryProvider
// 因为需要先 mock repository 工厂函数

describe("PostgresProfileMemoryProvider", () => {
  let provider: any;
  let mockFactRepo: ReturnType<typeof createMockFactRepo>;
  let mockPrefsRepo: ReturnType<typeof createMockPrefsRepo>;
  let mockPatternRepo: ReturnType<typeof createMockPatternRepo>;
  let mockDb: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();

    mockFactRepo = createMockFactRepo();
    mockPrefsRepo = createMockPrefsRepo();
    mockPatternRepo = createMockPatternRepo();
    mockDb = {};

    // Mock repository 工厂函数
    vi.doMock("../../../../db/repositories/profile-memory.js", () => ({
      getUserFactRepository: vi.fn().mockReturnValue(mockFactRepo),
      getUserPreferencesV2Repository: vi.fn().mockReturnValue(mockPrefsRepo),
      getBehaviorPatternRepository: vi.fn().mockReturnValue(mockPatternRepo),
      UserFactRepository: vi.fn(),
      UserPreferencesV2Repository: vi.fn(),
      BehaviorPatternRepository: vi.fn(),
    }));

    // Mock factory 注册（避免副作用）
    vi.doMock("../factory.js", () => ({
      registerProvider: vi.fn(),
    }));

    // 动态导入被测模块
    const mod = await import("./postgres.js");
    const PostgresProfileMemoryProvider = mod.PostgresProfileMemoryProvider;

    // 通过 config.db 传入 mock DB 实例，绕过动态 import getDb
    provider = new PostgresProfileMemoryProvider({ db: mockDb });
    await provider.initialize();
  });

  // ==================== 生命周期 ====================

  describe("生命周期", () => {
    it("应该正确初始化", () => {
      expect(provider.name).toBe("postgres-profile");
      expect(provider.version).toBe("1.0.0");
    });

    it("健康检查应该返回 healthy", async () => {
      const health = await provider.healthCheck();
      expect(health.status).toBe("healthy");
    });

    it("关闭后应该能正常调用", async () => {
      await expect(provider.shutdown()).resolves.not.toThrow();
    });
  });

  // ==================== 事实管理 ====================

  describe("事实管理", () => {
    it("addFact 应该调用 factRepo.create 并返回 ID", async () => {
      const dbRecord = createMockFactRecord();
      mockFactRepo.create.mockResolvedValue(dbRecord);

      const factId = await provider.addFact("user-123", {
        category: "work",
        key: "company",
        value: "MtBot",
        confidence: 0.9,
        source: "explicit",
        sensitive: false,
      });

      expect(factId).toBe("fact-001");
      expect(mockFactRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "work",
          key: "company",
          value: "MtBot",
          confidence: 0.9,
          source: "explicit",
          sensitive: false,
        }),
      );
    });

    it("updateFact 应该调用 factRepo.update", async () => {
      mockFactRepo.update.mockResolvedValue(createMockFactRecord({ value: "NewCo" }));

      await provider.updateFact("user-123", "fact-001", { value: "NewCo" });

      expect(mockFactRepo.update).toHaveBeenCalledWith(
        "fact-001",
        expect.objectContaining({ value: "NewCo" }),
      );
    });

    it("deleteFact 应该调用 factRepo.deactivate（软删除）", async () => {
      mockFactRepo.deactivate.mockResolvedValue(undefined);

      await provider.deleteFact("user-123", "fact-001");

      expect(mockFactRepo.deactivate).toHaveBeenCalledWith("fact-001");
    });

    it("getFacts 应该返回转换后的 UserFact 列表", async () => {
      const records = [
        createMockFactRecord(),
        createMockFactRecord({
          id: "fact-002",
          category: "hobby",
          key: "sport",
          value: "swimming",
        }),
      ];
      mockFactRepo.findAll.mockResolvedValue({ facts: records, total: 2 });

      const facts = await provider.getFacts("user-123");

      expect(facts).toHaveLength(2);
      expect(facts[0]).toMatchObject({
        id: "fact-001",
        category: "work",
        key: "company",
        value: "MtBot",
      });
    });

    it("getFacts 应该支持按类别过滤", async () => {
      mockFactRepo.findAll.mockResolvedValue({ facts: [createMockFactRecord()], total: 1 });

      await provider.getFacts("user-123", "work");

      expect(mockFactRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ category: "work" }),
      );
    });

    it("searchFacts 应该调用 factRepo.search", async () => {
      mockFactRepo.search.mockResolvedValue([createMockFactRecord()]);

      const results = await provider.searchFacts("user-123", "MtBot");

      expect(results).toHaveLength(1);
      expect(mockFactRepo.search).toHaveBeenCalledWith("MtBot");
    });
  });

  // ==================== 偏好管理 ====================

  describe("偏好管理", () => {
    it("getPreferences 应该返回转换后的 UserPreferences", async () => {
      mockPrefsRepo.getOrCreate.mockResolvedValue(createMockPrefsRecord());

      const prefs = await provider.getPreferences("user-123");

      expect(prefs).toMatchObject({
        language: "zh-CN",
        timezone: "Asia/Shanghai",
        responseStyle: "detailed",
        confirmLevel: "medium",
      });
    });

    it("getPreferences 不存在时应该返回默认值", async () => {
      mockPrefsRepo.getOrCreate.mockResolvedValue(createMockPrefsRecord());

      const prefs = await provider.getPreferences("user-123");

      expect(prefs.favoriteSkills).toEqual([]);
      expect(prefs.notifications.enabled).toBe(true);
    });

    it("updatePreferences 应该调用 prefsRepo.update", async () => {
      mockPrefsRepo.getOrCreate.mockResolvedValue(createMockPrefsRecord());
      mockPrefsRepo.update.mockResolvedValue(createMockPrefsRecord({ language: "en-US" }));

      await provider.updatePreferences("user-123", { language: "en-US" });

      expect(mockPrefsRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ language: "en-US" }),
      );
    });

    it("resetPreferences 应该调用 prefsRepo.delete", async () => {
      mockPrefsRepo.delete.mockResolvedValue(undefined);

      await provider.resetPreferences("user-123");

      expect(mockPrefsRepo.delete).toHaveBeenCalled();
    });
  });

  // ==================== 行为模式 ====================

  describe("行为模式", () => {
    it("addPattern 应该调用 patternRepo.create 并返回 ID", async () => {
      mockPatternRepo.create.mockResolvedValue(createMockPatternRecord());

      const patternId = await provider.addPattern("user-123", {
        type: "work_style",
        pattern: "偏好在早上处理复杂任务",
        evidence: ["多次在上午提问技术问题"],
        confidence: 0.7,
      });

      expect(patternId).toBe("pattern-001");
      expect(mockPatternRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "work_style",
          pattern: "偏好在早上处理复杂任务",
        }),
      );
    });

    it("getPatterns 应该返回转换后的 BehaviorPattern 列表", async () => {
      mockPatternRepo.findAll.mockResolvedValue({
        patterns: [createMockPatternRecord()],
        total: 1,
      });

      const patterns = await provider.getPatterns("user-123");

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toMatchObject({
        id: "pattern-001",
        type: "work_style",
        pattern: "偏好在早上处理复杂任务",
        confidence: 0.7,
      });
    });

    it("updatePattern 应该调用 patternRepo.update", async () => {
      mockPatternRepo.update.mockResolvedValue(createMockPatternRecord({ confidence: 0.9 }));

      await provider.updatePattern("user-123", "pattern-001", { confidence: 0.9 });

      expect(mockPatternRepo.update).toHaveBeenCalledWith(
        "pattern-001",
        expect.objectContaining({ confidence: 0.9 }),
      );
    });

    it("deletePattern 应该调用 patternRepo.deactivate（软删除）", async () => {
      mockPatternRepo.deactivate.mockResolvedValue(undefined);

      await provider.deletePattern("user-123", "pattern-001");

      expect(mockPatternRepo.deactivate).toHaveBeenCalledWith("pattern-001");
    });

    it("confirmPattern 应该调用 patternRepo.confirm", async () => {
      mockPatternRepo.confirm.mockResolvedValue(createMockPatternRecord({ confirmed: true }));

      await provider.confirmPattern("user-123", "pattern-001", true);

      expect(mockPatternRepo.confirm).toHaveBeenCalledWith("pattern-001", true);
    });
  });

  // ==================== 自动提取 ====================

  describe("自动提取", () => {
    it("extractFromConversation 应该返回空结果（LLM 待实现）", async () => {
      const result = await provider.extractFromConversation("user-123", [
        { role: "user", content: "我在 MtBot 工作" },
      ]);

      expect(result).toMatchObject({
        newFacts: [],
        updatedFacts: [],
        newPatterns: [],
      });
    });
  });

  // ==================== 导出 ====================

  describe("导出", () => {
    it("exportProfile 应该聚合三个 Repository 数据", async () => {
      mockFactRepo.findAll.mockResolvedValue({
        facts: [createMockFactRecord()],
        total: 1,
      });
      mockPrefsRepo.getOrCreate.mockResolvedValue(createMockPrefsRecord());
      mockPatternRepo.findAll.mockResolvedValue({
        patterns: [createMockPatternRecord()],
        total: 1,
      });

      const profile = await provider.exportProfile("user-123");

      expect(profile.facts).toHaveLength(1);
      expect(profile.preferences).toMatchObject({ language: "zh-CN" });
      expect(profile.patterns).toHaveLength(1);
    });
  });

  // ==================== 类型转换 ====================

  describe("DB Record → 接口类型转换", () => {
    it("DB UserFactRecord 应该正确转换为 UserFact", async () => {
      const dbRecord = createMockFactRecord({
        extractedFrom: "session-001",
        validUntil: new Date("2026-01-01"),
      });
      mockFactRepo.findAll.mockResolvedValue({ facts: [dbRecord], total: 1 });

      const facts: UserFact[] = await provider.getFacts("user-123");

      expect(facts[0].extractedFrom).toBe("session-001");
      expect(facts[0].validUntil).toEqual(new Date("2026-01-01"));
      // DB 的 isActive 不应出现在接口类型中
      expect((facts[0] as any).isActive).toBeUndefined();
      expect((facts[0] as any).userId).toBeUndefined();
    });

    it("DB BehaviorPatternRecord 应该正确转换为 BehaviorPattern", async () => {
      const dbRecord = createMockPatternRecord({ confirmed: true });
      mockPatternRepo.findAll.mockResolvedValue({ patterns: [dbRecord], total: 1 });

      const patterns: BehaviorPattern[] = await provider.getPatterns("user-123");

      expect(patterns[0].confirmed).toBe(true);
      // DB 的 isActive、userId 不应出现在接口类型中
      expect((patterns[0] as any).isActive).toBeUndefined();
      expect((patterns[0] as any).userId).toBeUndefined();
    });

    it("DB PreferencesRecord 应该正确转换为 UserPreferences", async () => {
      mockPrefsRepo.getOrCreate.mockResolvedValue(
        createMockPrefsRecord({
          favoriteSkills: ["skill-1"],
          notifications: { enabled: false, channels: ["email"] },
        }),
      );

      const prefs: UserPreferences = await provider.getPreferences("user-123");

      expect(prefs.favoriteSkills).toEqual(["skill-1"]);
      expect(prefs.notifications.enabled).toBe(false);
      expect(prefs.notifications.channels).toEqual(["email"]);
      // DB 专有字段不应出现
      expect((prefs as any).id).toBeUndefined();
      expect((prefs as any).userId).toBeUndefined();
    });
  });

  // ==================== 工厂创建 ====================

  describe("工厂创建", () => {
    it("应该通过 createProvider 创建 postgres profile 实例", async () => {
      // 重新 mock factory 模块以获取 registerProvider 的调用记录
      const { registerProvider } = await import("../factory.js");

      // registerProvider 在模块加载时被调用过（被 mock 了）
      // 这里验证 provider 实例的类型正确
      expect(provider.name).toBe("postgres-profile");
      expect(provider.version).toBe("1.0.0");
      expect(typeof provider.addFact).toBe("function");
      expect(typeof provider.getPreferences).toBe("function");
      expect(typeof provider.addPattern).toBe("function");
      expect(typeof provider.exportProfile).toBe("function");
    });
  });

  // ==================== 健康检查边界 ====================

  describe("健康检查", () => {
    it("未初始化时应该返回 unhealthy", async () => {
      const mod = await import("./postgres.js");
      const uninitializedProvider = new mod.PostgresProfileMemoryProvider({});

      const health = await uninitializedProvider.healthCheck();

      expect(health.status).toBe("unhealthy");
      expect(health.details).toHaveProperty("error");
    });

    it("关闭后应该返回 unhealthy", async () => {
      await provider.shutdown();

      const health = await provider.healthCheck();

      expect(health.status).toBe("unhealthy");
    });
  });

  // ==================== extractFromConversation LLM 集成 ====================

  describe("extractFromConversation - LLM 集成", () => {
    it("无 LLM 服务时应返回空结果（优雅降级）", async () => {
      // provider 没有传入 cfg，所以没有 LLM 服务
      const result = await provider.extractFromConversation("user-123", [
        { role: "user", content: "我叫张三，在 MtBot 工作" },
      ]);

      expect(result).toEqual({
        newFacts: [],
        updatedFacts: [],
        newPatterns: [],
      });
    });

    it("有 LLM 服务且可用时应调用 LLM 进行画像提取", async () => {
      vi.resetModules();

      const mockLLMResponse = {
        newFacts: [
          {
            content: "张三",
            category: "personal" as const,
            key: "name",
            confidence: 0.9,
          },
          {
            content: "MtBot",
            category: "work" as const,
            key: "company",
            confidence: 0.9,
          },
        ],
        updatedFacts: [],
        newPatterns: [],
      };

      // Mock LLM 服务 — 使用 class 形式
      vi.doMock("../../llm/memory-llm-service.js", () => ({
        MemoryLLMService: class {
          isAvailable = vi.fn().mockResolvedValue(true);
          completeJSON = vi.fn().mockResolvedValue(mockLLMResponse);
          resetAvailability = vi.fn();
        },
      }));

      // Mock prompts 和 parsers（避免实际调用）
      vi.doMock("../../llm/prompts.js", () => ({
        buildProfileExtractionSystemPrompt: vi.fn().mockReturnValue("system prompt"),
        buildProfileExtractionUserMessage: vi.fn().mockReturnValue("user message"),
      }));

      vi.doMock("../../llm/response-parsers.js", () => ({
        parseProfileExtractionResponse: vi.fn(),
      }));

      vi.doMock("../../../../db/repositories/profile-memory.js", () => ({
        getUserFactRepository: vi.fn().mockReturnValue(mockFactRepo),
        getUserPreferencesV2Repository: vi.fn().mockReturnValue(mockPrefsRepo),
        getBehaviorPatternRepository: vi.fn().mockReturnValue(mockPatternRepo),
        UserFactRepository: vi.fn(),
        UserPreferencesV2Repository: vi.fn(),
        BehaviorPatternRepository: vi.fn(),
      }));

      vi.doMock("../factory.js", () => ({
        registerProvider: vi.fn(),
      }));

      // Mock getFacts 返回空（没有已有事实）
      mockFactRepo.findAll.mockResolvedValue({ facts: [], total: 0 });

      const mod = await import("./postgres.js");
      const llmProvider = new mod.PostgresProfileMemoryProvider({
        db: mockDb,
        cfg: {} as any,
      });
      await llmProvider.initialize();

      const result = await llmProvider.extractFromConversation("user-123", [
        { role: "user", content: "我叫张三，在 MtBot 工作" },
      ]);

      expect(result.newFacts).toHaveLength(2);
      expect(result.newFacts[0]).toMatchObject({
        id: "personal:name",
        content: "张三",
        category: "personal",
        confidence: 0.9,
      });
      expect(result.updatedFacts).toEqual([]);
      expect(result.newPatterns).toEqual([]);
    });

    it("LLM 调用失败时应返回空结果", async () => {
      vi.resetModules();

      // Mock LLM 服务返回 null（调用失败）
      vi.doMock("../../llm/memory-llm-service.js", () => ({
        MemoryLLMService: class {
          isAvailable = vi.fn().mockResolvedValue(true);
          completeJSON = vi.fn().mockResolvedValue(null);
          resetAvailability = vi.fn();
        },
      }));

      vi.doMock("../../llm/prompts.js", () => ({
        buildProfileExtractionSystemPrompt: vi.fn().mockReturnValue("system prompt"),
        buildProfileExtractionUserMessage: vi.fn().mockReturnValue("user message"),
      }));

      vi.doMock("../../llm/response-parsers.js", () => ({
        parseProfileExtractionResponse: vi.fn(),
      }));

      vi.doMock("../../../../db/repositories/profile-memory.js", () => ({
        getUserFactRepository: vi.fn().mockReturnValue(mockFactRepo),
        getUserPreferencesV2Repository: vi.fn().mockReturnValue(mockPrefsRepo),
        getBehaviorPatternRepository: vi.fn().mockReturnValue(mockPatternRepo),
        UserFactRepository: vi.fn(),
        UserPreferencesV2Repository: vi.fn(),
        BehaviorPatternRepository: vi.fn(),
      }));

      vi.doMock("../factory.js", () => ({
        registerProvider: vi.fn(),
      }));

      mockFactRepo.findAll.mockResolvedValue({ facts: [], total: 0 });

      const mod = await import("./postgres.js");
      const llmProvider = new mod.PostgresProfileMemoryProvider({
        db: mockDb,
        cfg: {} as any,
      });
      await llmProvider.initialize();

      const result = await llmProvider.extractFromConversation("user-123", [
        { role: "user", content: "随便聊聊" },
      ]);

      expect(result).toEqual({
        newFacts: [],
        updatedFacts: [],
        newPatterns: [],
      });
    });

    it("LLM 服务不可用时应返回空结果", async () => {
      vi.resetModules();

      // Mock LLM 服务不可用（无 API Key）
      vi.doMock("../../llm/memory-llm-service.js", () => ({
        MemoryLLMService: class {
          isAvailable = vi.fn().mockResolvedValue(false);
          completeJSON = vi.fn();
          resetAvailability = vi.fn();
        },
      }));

      vi.doMock("../../llm/prompts.js", () => ({
        buildProfileExtractionSystemPrompt: vi.fn().mockReturnValue("system prompt"),
        buildProfileExtractionUserMessage: vi.fn().mockReturnValue("user message"),
      }));

      vi.doMock("../../llm/response-parsers.js", () => ({
        parseProfileExtractionResponse: vi.fn(),
      }));

      vi.doMock("../../../../db/repositories/profile-memory.js", () => ({
        getUserFactRepository: vi.fn().mockReturnValue(mockFactRepo),
        getUserPreferencesV2Repository: vi.fn().mockReturnValue(mockPrefsRepo),
        getBehaviorPatternRepository: vi.fn().mockReturnValue(mockPatternRepo),
        UserFactRepository: vi.fn(),
        UserPreferencesV2Repository: vi.fn(),
        BehaviorPatternRepository: vi.fn(),
      }));

      vi.doMock("../factory.js", () => ({
        registerProvider: vi.fn(),
      }));

      const mod = await import("./postgres.js");
      const llmProvider = new mod.PostgresProfileMemoryProvider({
        db: mockDb,
        cfg: {} as any,
      });
      await llmProvider.initialize();

      const result = await llmProvider.extractFromConversation("user-123", [
        { role: "user", content: "我叫张三" },
      ]);

      expect(result).toEqual({
        newFacts: [],
        updatedFacts: [],
        newPatterns: [],
      });
    });
  });
});
