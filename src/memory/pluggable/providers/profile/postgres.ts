/**
 * PostgreSQL 画像记忆提供者
 *
 * 使用 PostgreSQL 数据库存储用户画像数据，委托给已有的
 * UserFactRepository、UserPreferencesV2Repository、BehaviorPatternRepository。
 * 适用于生产环境，数据持久化。
 *
 * @module memory/pluggable/providers/profile
 */

import { getLogger } from "../../../../logging/logger.js";
import type { MtBotConfig } from "../../../../config/config.js";
import type { Database } from "../../../../db/connection.js";
import {
  getUserFactRepository,
  getUserPreferencesV2Repository,
  getBehaviorPatternRepository,
  type UserFactRepository,
  type UserPreferencesV2Repository,
  type BehaviorPatternRepository,
} from "../../../../db/repositories/profile-memory.js";
import type {
  UserFactRecord,
  BehaviorPatternRecord,
  UserPreferencesV2Record,
} from "../../../../db/schema/profile-memory.js";
import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type { Message } from "../../interfaces/types.js";
import type {
  BehaviorPattern,
  ExtractedProfile,
  FactCategory,
  IProfileMemoryProvider,
  UserFact,
  UserPreferences,
} from "../../interfaces/profile-memory.js";
import { DEFAULT_USER_PREFERENCES } from "../../interfaces/profile-memory.js";
import { MemoryLLMService } from "../../llm/memory-llm-service.js";
import {
  buildProfileExtractionSystemPrompt,
  buildProfileExtractionUserMessage,
} from "../../llm/prompts.js";
import { parseProfileExtractionResponse } from "../../llm/response-parsers.js";
import { registerProvider } from "../factory.js";

const logger = getLogger();

// ==================== 类型转换工具 ====================

/**
 * 将 DB UserFactRecord 转换为接口 UserFact
 *
 * 剥离 DB 专有字段（userId, isActive, metadata）
 */
function toUserFact(record: UserFactRecord): UserFact {
  return {
    id: record.id,
    category: record.category as FactCategory,
    key: record.key,
    value: record.value,
    confidence: record.confidence,
    source: record.source as "explicit" | "inferred",
    extractedFrom: record.extractedFrom ?? undefined,
    sensitive: record.sensitive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    validUntil: record.validUntil ?? undefined,
  };
}

/**
 * 将 DB UserPreferencesV2Record 转换为接口 UserPreferences
 *
 * 剥离 DB 专有字段（id, userId, metadata, createdAt, updatedAt）
 */
function toUserPreferences(record: UserPreferencesV2Record): UserPreferences {
  return {
    language: record.language,
    timezone: record.timezone,
    responseStyle: record.responseStyle as UserPreferences["responseStyle"],
    confirmLevel: record.confirmLevel as UserPreferences["confirmLevel"],
    favoriteSkills: record.favoriteSkills ?? [],
    disabledSkills: record.disabledSkills ?? [],
    thinkingLevel: record.thinkingLevel as UserPreferences["thinkingLevel"],
    verboseLevel: record.verboseLevel as UserPreferences["verboseLevel"],
    notifications: record.notifications ?? { enabled: true, channels: [] },
  };
}

/**
 * 将 DB BehaviorPatternRecord 转换为接口 BehaviorPattern
 *
 * 剥离 DB 专有字段（userId, isActive, metadata, createdAt）
 */
function toBehaviorPattern(record: BehaviorPatternRecord): BehaviorPattern {
  return {
    id: record.id,
    type: record.type as BehaviorPattern["type"],
    pattern: record.pattern,
    evidence: record.evidence ?? [],
    confidence: record.confidence,
    confirmed: record.confirmed ?? undefined,
    updatedAt: record.updatedAt,
  };
}

// ==================== Provider 配置 ====================

/**
 * PostgreSQL Profile Provider 配置
 */
interface PostgresProfileConfig extends ProviderConfig {
  /** 数据库连接 URL */
  url?: string;
  /** 已有的 DB 实例（优先于 url） */
  db?: Database;
  /** MtBot 配置（用于 LLM 服务初始化） */
  cfg?: MtBotConfig;
}

// ==================== Provider 实现 ====================

/**
 * PostgreSQL 画像记忆提供者
 *
 * 桥接 IProfileMemoryProvider 接口与 DB Repository 层。
 * 将接口方法委托给 UserFactRepository、UserPreferencesV2Repository、
 * BehaviorPatternRepository，并在两者之间进行类型转换。
 *
 * @example
 * ```typescript
 * const provider = new PostgresProfileMemoryProvider({ url: 'postgresql://...' })
 * await provider.initialize()
 *
 * await provider.addFact('user-123', {
 *   category: 'work',
 *   key: 'company',
 *   value: 'MtBot',
 *   confidence: 1.0,
 *   source: 'explicit',
 *   sensitive: false,
 * })
 *
 * await provider.shutdown()
 * ```
 */
export class PostgresProfileMemoryProvider implements IProfileMemoryProvider {
  readonly name = "postgres-profile";
  readonly version = "1.0.0";

  private db: Database | null = null;
  private readonly config: PostgresProfileConfig;
  private llmService: MemoryLLMService | null = null;

  /**
   * 创建 PostgreSQL 画像记忆提供者
   *
   * @param config - 配置，包含 DB URL 或已有 DB 实例
   */
  constructor(config?: PostgresProfileConfig) {
    this.config = config ?? ({} as PostgresProfileConfig);
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化提供者
   *
   * 获取数据库连接。如果配置中提供了 db 实例则直接使用，
   * 否则通过 getDb() 获取全局连接池。
   */
  async initialize(): Promise<void> {
    logger.info("[postgres-profile] 初始化 PostgreSQL 画像记忆提供者");

    if (this.config.db) {
      this.db = this.config.db;
    } else {
      const { getDatabase } = await import("../../../../db/connection.js");
      this.db = getDatabase();
    }

    // 初始化 LLM 服务（用于画像自动提取）
    if (this.config.cfg) {
      this.llmService = new MemoryLLMService({ cfg: this.config.cfg });
      logger.info("[postgres-profile] LLM 服务已初始化");
    } else {
      logger.debug("[postgres-profile] 未提供 cfg，LLM 画像提取功能将降级");
    }

    logger.info("[postgres-profile] 初始化完成");
  }

  /**
   * 关闭提供者
   *
   * 释放 DB 引用（不关闭连接池，由全局管理）
   */
  async shutdown(): Promise<void> {
    logger.info("[postgres-profile] 关闭提供者");
    this.db = null;
    this.llmService = null;
    logger.info("[postgres-profile] 已关闭");
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.db) {
      return {
        status: "unhealthy",
        latency: 0,
        details: { error: "数据库未初始化" },
      };
    }

    return {
      status: "healthy",
      latency: 0,
      details: { provider: "postgres-profile" },
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取 DB 实例，未初始化则抛出异常
   */
  private getDatabase(): Database {
    if (!this.db) {
      throw new Error("[postgres-profile] 提供者未初始化，请先调用 initialize()");
    }
    return this.db;
  }

  /**
   * 创建 UserFactRepository 实例
   */
  private getFactRepo(userId: string): UserFactRepository {
    return getUserFactRepository(this.getDatabase(), userId);
  }

  /**
   * 创建 UserPreferencesV2Repository 实例
   */
  private getPrefsRepo(userId: string): UserPreferencesV2Repository {
    return getUserPreferencesV2Repository(this.getDatabase(), userId);
  }

  /**
   * 创建 BehaviorPatternRepository 实例
   */
  private getPatternRepo(userId: string): BehaviorPatternRepository {
    return getBehaviorPatternRepository(this.getDatabase(), userId);
  }

  // ==================== 事实管理 ====================

  /**
   * 添加用户事实
   */
  async addFact(
    userId: string,
    fact: Omit<UserFact, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    logger.info(`[postgres-profile] 添加事实 (用户: ${userId}, 类别: ${fact.category})`);

    const repo = this.getFactRepo(userId);
    const record = await repo.create({
      category: fact.category,
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      source: fact.source,
      extractedFrom: fact.extractedFrom ?? null,
      sensitive: fact.sensitive,
      validUntil: fact.validUntil ?? null,
    });

    logger.debug(`[postgres-profile] 事实已创建: ${record.id}`);
    return record.id;
  }

  /**
   * 更新用户事实
   */
  async updateFact(userId: string, factId: string, updates: Partial<UserFact>): Promise<void> {
    logger.info(`[postgres-profile] 更新事实: ${factId} (用户: ${userId})`);

    const repo = this.getFactRepo(userId);
    const dbUpdates: Record<string, unknown> = {};

    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence;
    if (updates.sensitive !== undefined) dbUpdates.sensitive = updates.sensitive;
    if (updates.validUntil !== undefined) dbUpdates.validUntil = updates.validUntil;

    await repo.update(factId, dbUpdates);
  }

  /**
   * 删除用户事实（软删除）
   */
  async deleteFact(userId: string, factId: string): Promise<void> {
    logger.info(`[postgres-profile] 删除事实: ${factId} (用户: ${userId})`);

    const repo = this.getFactRepo(userId);
    await repo.deactivate(factId);
  }

  /**
   * 获取用户事实
   */
  async getFacts(userId: string, category?: FactCategory): Promise<UserFact[]> {
    logger.debug(`[postgres-profile] 获取事实 (用户: ${userId}, 类别: ${category ?? "all"})`);

    const repo = this.getFactRepo(userId);
    const { facts } = await repo.findAll({
      category,
      activeOnly: true,
    });

    return facts.map(toUserFact);
  }

  /**
   * 搜索用户事实
   */
  async searchFacts(userId: string, query: string): Promise<UserFact[]> {
    logger.debug(`[postgres-profile] 搜索事实: "${query}" (用户: ${userId})`);

    const repo = this.getFactRepo(userId);
    const facts = await repo.search(query);

    return facts.map(toUserFact);
  }

  // ==================== 偏好管理 ====================

  /**
   * 获取用户偏好
   *
   * 不存在时自动创建默认偏好记录
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    logger.debug(`[postgres-profile] 获取偏好 (用户: ${userId})`);

    const repo = this.getPrefsRepo(userId);
    const record = await repo.getOrCreate();

    return toUserPreferences(record);
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    logger.info(`[postgres-profile] 更新偏好 (用户: ${userId})`);

    const repo = this.getPrefsRepo(userId);

    // 确保记录存在
    await repo.getOrCreate();

    // 构建 DB 更新对象
    const dbUpdates: Record<string, unknown> = {};

    if (updates.language !== undefined) dbUpdates.language = updates.language;
    if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
    if (updates.responseStyle !== undefined) dbUpdates.responseStyle = updates.responseStyle;
    if (updates.confirmLevel !== undefined) dbUpdates.confirmLevel = updates.confirmLevel;
    if (updates.favoriteSkills !== undefined) dbUpdates.favoriteSkills = updates.favoriteSkills;
    if (updates.disabledSkills !== undefined) dbUpdates.disabledSkills = updates.disabledSkills;
    if (updates.thinkingLevel !== undefined) dbUpdates.thinkingLevel = updates.thinkingLevel;
    if (updates.verboseLevel !== undefined) dbUpdates.verboseLevel = updates.verboseLevel;
    if (updates.notifications !== undefined) dbUpdates.notifications = updates.notifications;

    await repo.update(dbUpdates);
  }

  /**
   * 重置用户偏好
   *
   * 删除 DB 记录，下次 getPreferences 时自动创建默认值
   */
  async resetPreferences(userId: string): Promise<void> {
    logger.info(`[postgres-profile] 重置偏好 (用户: ${userId})`);

    const repo = this.getPrefsRepo(userId);
    await repo.delete();
  }

  // ==================== 行为模式 ====================

  /**
   * 添加行为模式
   */
  async addPattern(
    userId: string,
    pattern: Omit<BehaviorPattern, "id" | "updatedAt">,
  ): Promise<string> {
    logger.info(`[postgres-profile] 添加模式 (用户: ${userId}, 类型: ${pattern.type})`);

    const repo = this.getPatternRepo(userId);
    const record = await repo.create({
      type: pattern.type,
      pattern: pattern.pattern,
      evidence: pattern.evidence,
      confidence: pattern.confidence,
      confirmed: pattern.confirmed ?? null,
    });

    logger.debug(`[postgres-profile] 模式已创建: ${record.id}`);
    return record.id;
  }

  /**
   * 获取行为模式
   */
  async getPatterns(userId: string): Promise<BehaviorPattern[]> {
    logger.debug(`[postgres-profile] 获取模式 (用户: ${userId})`);

    const repo = this.getPatternRepo(userId);
    const { patterns } = await repo.findAll({ activeOnly: true });

    return patterns.map(toBehaviorPattern);
  }

  /**
   * 更新行为模式
   */
  async updatePattern(
    userId: string,
    patternId: string,
    updates: Partial<BehaviorPattern>,
  ): Promise<void> {
    logger.info(`[postgres-profile] 更新模式: ${patternId} (用户: ${userId})`);

    const repo = this.getPatternRepo(userId);
    const dbUpdates: Record<string, unknown> = {};

    if (updates.pattern !== undefined) dbUpdates.pattern = updates.pattern;
    if (updates.evidence !== undefined) dbUpdates.evidence = updates.evidence;
    if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence;
    if (updates.confirmed !== undefined) dbUpdates.confirmed = updates.confirmed;

    await repo.update(patternId, dbUpdates);
  }

  /**
   * 删除行为模式（软删除）
   */
  async deletePattern(userId: string, patternId: string): Promise<void> {
    logger.info(`[postgres-profile] 删除模式: ${patternId} (用户: ${userId})`);

    const repo = this.getPatternRepo(userId);
    await repo.deactivate(patternId);
  }

  /**
   * 确认行为模式
   */
  async confirmPattern(userId: string, patternId: string, confirmed: boolean): Promise<void> {
    logger.info(`[postgres-profile] 确认模式: ${patternId} = ${confirmed} (用户: ${userId})`);

    const repo = this.getPatternRepo(userId);
    await repo.confirm(patternId, confirmed);
  }

  // ==================== 自动提取 ====================

  /**
   * 从对话中提取画像
   *
   * 使用 LLM 分析对话内容，自动提取用户事实、更新已有事实、发现行为模式。
   * 无 LLM 服务或调用失败时优雅降级为空结果。
   *
   * @param userId - 用户 ID
   * @param messages - 对话消息列表
   * @returns 提取的画像信息（newFacts, updatedFacts, newPatterns）
   */
  async extractFromConversation(userId: string, messages: Message[]): Promise<ExtractedProfile> {
    logger.debug("[postgres-profile] 从对话提取画像", {
      userId,
      messageCount: messages.length,
    });

    const emptyResult: ExtractedProfile = {
      newFacts: [],
      updatedFacts: [],
      newPatterns: [],
    };

    // 无 LLM 服务时优雅降级
    if (!this.llmService) {
      logger.debug("[postgres-profile] LLM 服务未配置，返回空结果");
      return emptyResult;
    }

    // 检查 LLM 服务可用性
    const available = await this.llmService.isAvailable();
    if (!available) {
      logger.debug("[postgres-profile] LLM 服务不可用（无 API Key），返回空结果");
      return emptyResult;
    }

    try {
      // 获取用户已有事实，避免重复提取
      const existingFacts = await this.getFacts(userId);

      // 构建 prompt
      const systemPrompt = buildProfileExtractionSystemPrompt(existingFacts);
      const userMessage = buildProfileExtractionUserMessage(messages);

      // 调用 LLM 提取画像
      const result = await this.llmService.completeJSON(
        systemPrompt,
        userMessage,
        parseProfileExtractionResponse,
      );

      // LLM 调用失败或解析失败
      if (!result) {
        logger.warn("[postgres-profile] LLM 调用失败或响应解析失败");
        return emptyResult;
      }

      logger.info("[postgres-profile] 画像提取完成", {
        newFactsCount: result.newFacts.length,
        updatedFactsCount: result.updatedFacts.length,
        newPatternsCount: result.newPatterns.length,
      });

      // 转换 LLM 响应为 ExtractedProfile 格式
      return {
        newFacts: result.newFacts.map((f) => ({
          id: `${f.category}:${f.key}`,
          content: f.content,
          category: f.category as FactCategory,
          confidence: f.confidence,
        })),
        updatedFacts: result.updatedFacts.map((f) => ({
          id: f.id,
          content: f.content,
          previousValue: f.previousValue,
        })),
        newPatterns: result.newPatterns.map((p) => ({
          type: p.type as BehaviorPattern["type"],
          pattern: p.pattern,
          confidence: p.confidence,
        })),
      };
    } catch (error) {
      logger.error("[postgres-profile] 画像提取异常", {
        error: error instanceof Error ? error.message : String(error),
      });
      return emptyResult;
    }
  }

  // ==================== 导出 ====================

  /**
   * 导出用户画像
   *
   * 聚合三个 Repository 的数据，返回完整画像
   */
  async exportProfile(userId: string): Promise<{
    facts: UserFact[];
    preferences: UserPreferences;
    patterns: BehaviorPattern[];
  }> {
    logger.info(`[postgres-profile] 导出画像 (用户: ${userId})`);

    const [factsResult, prefsRecord, patternsResult] = await Promise.all([
      this.getFactRepo(userId).findAll({ activeOnly: true }),
      this.getPrefsRepo(userId).getOrCreate(),
      this.getPatternRepo(userId).findAll({ activeOnly: true }),
    ]);

    return {
      facts: factsResult.facts.map(toUserFact),
      preferences: toUserPreferences(prefsRecord),
      patterns: patternsResult.patterns.map(toBehaviorPattern),
    };
  }
}

// 自动注册提供者
registerProvider(
  "profile",
  "postgres",
  PostgresProfileMemoryProvider as unknown as new (
    options: Record<string, unknown>,
  ) => PostgresProfileMemoryProvider,
);
