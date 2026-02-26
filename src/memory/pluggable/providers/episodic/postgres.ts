/**
 * PostgreSQL 情节记忆提供者
 *
 * 使用 PostgreSQL user_memories 表存储对话摘要和关键事件。
 * 委托给 MemoryRepository，通过 type=episodic 和 category 区分数据类型。
 *
 * 数据映射：
 * - 对话摘要 → type=episodic, category=conversation, metadata 存 keyTopics/decisions 等
 * - 关键事件 → type=episodic, category=event, metadata 存 eventType/context 等
 *
 * @module memory/pluggable/providers/episodic
 */

import { getLogger } from "../../../../logging/logger.js";
import type { MtBotConfig } from "../../../../config/config.js";
import type { Database } from "../../../../db/connection.js";
import type { UserMemory } from "../../../../db/schema/memories.js";
import {
  getMemoryRepository,
  type MemoryRepository,
} from "../../../../db/repositories/memories.js";
import type { HealthStatus, ProviderConfig } from "../../interfaces/memory-provider.js";
import type { Message } from "../../interfaces/types.js";
import type {
  ConversationSummary,
  EpisodicQueryOptions,
  EpisodeSearchResult,
  EventQueryOptions,
  IEpisodicMemoryProvider,
  KeyEvent,
  KeyEventType,
  TimelineEntry,
} from "../../interfaces/episodic-memory.js";
import { MemoryLLMService } from "../../llm/memory-llm-service.js";
import {
  buildSummarizationSystemPrompt,
  buildSummarizationUserMessage,
} from "../../llm/prompts.js";
import { parseSummarizationResponse } from "../../llm/response-parsers.js";
import { registerProvider } from "../factory.js";

const logger = getLogger();

// ==================== 类型转换工具 ====================

/** metadata 中对话摘要的结构 */
interface ConversationMetadata {
  sessionId: string;
  keyTopics: string[];
  decisions: string[];
  messageCount: number;
  tokenCount: number;
}

/** metadata 中关键事件的结构 */
interface EventMetadata {
  eventType: KeyEventType;
  context: string;
  relatedSessions: string[];
}

/**
 * 将 DB UserMemory (category=conversation) 转换为 ConversationSummary
 */
function toConversationSummary(record: UserMemory): ConversationSummary {
  const meta = (record.metadata ?? {}) as Partial<ConversationMetadata>;

  return {
    id: record.id,
    sessionId: meta.sessionId ?? record.sourceId ?? "",
    summary: record.summary ?? record.content,
    keyTopics: meta.keyTopics ?? [],
    decisions: meta.decisions ?? [],
    messageCount: meta.messageCount ?? 0,
    tokenCount: meta.tokenCount ?? 0,
    timestamp: record.createdAt,
  };
}

/**
 * 将 DB UserMemory (category=event) 转换为 KeyEvent
 *
 * importance: DB 存 1-10，接口用 0-1
 */
function toKeyEvent(record: UserMemory): KeyEvent {
  const meta = (record.metadata ?? {}) as Partial<EventMetadata>;

  return {
    id: record.id,
    type: (meta.eventType ?? "important_info") as KeyEventType,
    description: record.content,
    context: meta.context ?? "",
    importance: record.importance / 10,
    relatedSessions: meta.relatedSessions ?? [],
    timestamp: record.createdAt,
    metadata: record.metadata ?? undefined,
  };
}

/**
 * 简单文本匹配搜索
 *
 * 返回 0-1 的匹配分数
 */
function textMatchScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return 0;

  let matchCount = 0;
  for (const word of words) {
    if (lowerText.includes(word)) {
      matchCount++;
    }
  }

  return matchCount / words.length;
}

/**
 * 反序列化存储的对话内容为 Message 数组
 *
 * 解析格式: "[role] content\n[role] content\n..."
 *
 * @param content - 存储的对话内容字符串
 * @returns 解析后的消息数组
 */
function deserializeMessages(content: string): Message[] {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(/^\[(\w+)\]\s(.*)$/);
      if (match) {
        return { role: match[1] as Message["role"], content: match[2] };
      }
      return null;
    })
    .filter((m): m is Message => m !== null);
}

/**
 * 估算 token 数量
 *
 * 中文约 1.5 字/token，英文约 4 字符/token
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// ==================== Provider 配置 ====================

/**
 * PostgreSQL Episodic Provider 配置
 */
interface PostgresEpisodicConfig extends ProviderConfig {
  /** 已有的 DB 实例（优先于自动获取） */
  db?: Database;
  /** MtBot 配置（用于 LLM 服务初始化） */
  cfg?: MtBotConfig;
}

// ==================== Provider 实现 ====================

/**
 * PostgreSQL 情节记忆提供者
 *
 * 桥接 IEpisodicMemoryProvider 接口与 MemoryRepository。
 * 使用 user_memories 表存储，通过 category 区分对话摘要和关键事件。
 *
 * @example
 * ```typescript
 * const provider = new PostgresEpisodicMemoryProvider({ db })
 * await provider.initialize()
 *
 * await provider.addConversation('user-123', 'session-1', messages)
 * const results = await provider.searchEpisodes('user-123', '架构')
 *
 * await provider.shutdown()
 * ```
 */
export class PostgresEpisodicMemoryProvider implements IEpisodicMemoryProvider {
  readonly name = "postgres-episodic";
  readonly version = "1.0.0";

  private db: Database | null = null;
  private readonly config: PostgresEpisodicConfig;
  private llmService: MemoryLLMService | null = null;

  /**
   * 创建 PostgreSQL 情节记忆提供者
   */
  constructor(config?: PostgresEpisodicConfig) {
    this.config = config ?? ({} as PostgresEpisodicConfig);
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化提供者
   */
  async initialize(): Promise<void> {
    logger.info("[postgres-episodic] 初始化 PostgreSQL 情节记忆提供者");

    if (this.config.db) {
      this.db = this.config.db;
    } else {
      const { getDatabase } = await import("../../../../db/connection.js");
      this.db = getDatabase();
    }

    // 初始化 LLM 服务（用于对话摘要生成）
    if (this.config.cfg) {
      this.llmService = new MemoryLLMService({ cfg: this.config.cfg });
      logger.info("[postgres-episodic] LLM 服务已初始化");
    } else {
      logger.debug("[postgres-episodic] 未提供 cfg，LLM 摘要功能将降级");
    }

    logger.info("[postgres-episodic] 初始化完成");
  }

  /**
   * 关闭提供者
   */
  async shutdown(): Promise<void> {
    logger.info("[postgres-episodic] 关闭提供者");
    this.db = null;
    this.llmService = null;
    logger.info("[postgres-episodic] 已关闭");
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
      details: { provider: "postgres-episodic" },
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取 DB 实例
   */
  private getDatabase(): Database {
    if (!this.db) {
      throw new Error("[postgres-episodic] 提供者未初始化，请先调用 initialize()");
    }
    return this.db;
  }

  /**
   * 创建 MemoryRepository 实例
   */
  private getRepo(userId: string): MemoryRepository {
    return getMemoryRepository(this.getDatabase(), userId);
  }

  // ==================== 对话历史 ====================

  /**
   * 添加对话到历史
   *
   * 将对话消息拼接为文本，存储为 episodic/conversation 类型记忆。
   * 自动生成简单摘要（取首尾消息），后续可接入 LLM 生成高质量摘要。
   */
  async addConversation(userId: string, sessionId: string, messages: Message[]): Promise<void> {
    logger.info(
      `[postgres-episodic] 添加对话: ${sessionId} (用户: ${userId}, 消息数: ${messages.length})`,
    );

    const repo = this.getRepo(userId);

    // 拼接对话内容
    const content = messages.map((m) => `[${m.role}] ${m.content}`).join("\n");

    // 生成简单摘要
    const firstMsg = messages[0]?.content.slice(0, 100) ?? "";
    const lastMsg = messages[messages.length - 1]?.content.slice(0, 100) ?? "";
    const summary =
      messages.length > 1 ? `对话: ${firstMsg}... → ${lastMsg}...` : `对话: ${firstMsg}...`;

    // 提取简单关键词
    const keyTopics = extractSimpleKeywords(messages);

    const tokenCount = estimateTokens(content);

    await repo.create({
      type: "episodic",
      category: "conversation",
      content,
      summary,
      sourceType: "conversation",
      sourceId: sessionId,
      importance: 5,
      metadata: {
        sessionId,
        keyTopics,
        decisions: [],
        messageCount: messages.length,
        tokenCount,
      } satisfies ConversationMetadata,
    });

    logger.debug(`[postgres-episodic] 对话已保存: ${sessionId}`);
  }

  /**
   * 生成对话摘要
   *
   * 优先使用 LLM 生成高质量摘要，失败时回退到保存时的简单摘要。
   * LLM 生成成功后会更新 DB 中的 summary 和 metadata。
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @returns 对话摘要
   */
  async summarizeConversation(userId: string, sessionId: string): Promise<ConversationSummary> {
    logger.debug(`[postgres-episodic] 获取摘要: ${sessionId} (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      category: "conversation",
      activeOnly: true,
      limit: 100,
    });

    // 按 sourceId 查找对应会话
    const record = memories.find((m) => m.sourceId === sessionId);

    if (!record) {
      throw new Error(`对话不存在: ${sessionId}`);
    }

    // 尝试使用 LLM 生成高质量摘要
    if (this.llmService && (await this.llmService.isAvailable())) {
      try {
        // 从存储的内容反序列化消息
        const messages = deserializeMessages(record.content);

        if (messages.length > 0) {
          const systemPrompt = buildSummarizationSystemPrompt();
          const userMessage = buildSummarizationUserMessage(messages);

          const parsed = await this.llmService.completeJSON(
            systemPrompt,
            userMessage,
            parseSummarizationResponse,
          );

          if (parsed && parsed.summary) {
            logger.info("[postgres-episodic] LLM 摘要生成成功", {
              sessionId,
              keyTopicsCount: parsed.keyTopics.length,
              decisionsCount: parsed.decisions.length,
            });

            // 更新 DB 中的摘要
            const meta = (record.metadata ?? {}) as Record<string, unknown>;
            await repo.update(record.id, {
              summary: parsed.summary,
              metadata: {
                ...meta,
                keyTopics: parsed.keyTopics,
                decisions: parsed.decisions,
              },
            });

            return {
              id: record.id,
              sessionId: (meta.sessionId as string) ?? record.sourceId ?? "",
              summary: parsed.summary,
              keyTopics: parsed.keyTopics,
              decisions: parsed.decisions,
              messageCount: (meta.messageCount as number) ?? 0,
              tokenCount: (meta.tokenCount as number) ?? 0,
              timestamp: record.createdAt,
            };
          }
        }
      } catch (error) {
        logger.warn("[postgres-episodic] LLM 摘要生成失败，回退到简单摘要", {
          error: error instanceof Error ? error.message : String(error),
          sessionId,
        });
      }
    }

    // 回退：返回保存时的简单摘要
    return toConversationSummary(record);
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(
    userId: string,
    options?: EpisodicQueryOptions,
  ): Promise<ConversationSummary[]> {
    logger.debug(`[postgres-episodic] 获取对话历史 (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      category: "conversation",
      activeOnly: true,
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
    });

    let summaries = memories.map(toConversationSummary);

    // 时间过滤
    if (options?.startDate) {
      summaries = summaries.filter((s) => s.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      summaries = summaries.filter((s) => s.timestamp <= options.endDate!);
    }

    // 话题过滤
    if (options?.topics && options.topics.length > 0) {
      const topicSet = new Set(options.topics.map((t) => t.toLowerCase()));
      summaries = summaries.filter((s) => s.keyTopics.some((t) => topicSet.has(t.toLowerCase())));
    }

    return summaries;
  }

  /**
   * 删除对话
   */
  async deleteConversation(userId: string, sessionId: string): Promise<void> {
    logger.info(`[postgres-episodic] 删除对话: ${sessionId} (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      category: "conversation",
      activeOnly: true,
      limit: 100,
    });

    const record = memories.find((m) => m.sourceId === sessionId);
    if (record) {
      await repo.deactivate(record.id);
    }
  }

  // ==================== 关键事件 ====================

  /**
   * 添加关键事件
   *
   * importance: 接口用 0-1，DB 存 1-10
   */
  async addKeyEvent(userId: string, event: Omit<KeyEvent, "id">): Promise<string> {
    logger.info(`[postgres-episodic] 添加事件 (用户: ${userId}, 类型: ${event.type})`);

    const repo = this.getRepo(userId);
    const record = await repo.create({
      type: "episodic",
      category: "event",
      content: event.description,
      importance: Math.round(event.importance * 10),
      sourceType: "system",
      metadata: {
        eventType: event.type,
        context: event.context,
        relatedSessions: event.relatedSessions,
      } satisfies EventMetadata,
    });

    logger.debug(`[postgres-episodic] 事件已创建: ${record.id}`);
    return record.id;
  }

  /**
   * 获取关键事件
   */
  async getKeyEvents(userId: string, options?: EventQueryOptions): Promise<KeyEvent[]> {
    logger.debug(`[postgres-episodic] 获取事件 (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      category: "event",
      activeOnly: true,
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
    });

    let events = memories.map(toKeyEvent);

    // 类型过滤
    if (options?.types && options.types.length > 0) {
      const typeSet = new Set(options.types);
      events = events.filter((e) => typeSet.has(e.type));
    }

    // 时间过滤
    if (options?.startDate) {
      events = events.filter((e) => e.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      events = events.filter((e) => e.timestamp <= options.endDate!);
    }

    // 重要性过滤
    if (options?.minImportance !== undefined) {
      events = events.filter((e) => e.importance >= options.minImportance!);
    }

    return events;
  }

  /**
   * 更新关键事件
   */
  async updateKeyEvent(userId: string, eventId: string, updates: Partial<KeyEvent>): Promise<void> {
    logger.info(`[postgres-episodic] 更新事件: ${eventId} (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const dbUpdates: Record<string, unknown> = {};

    if (updates.description !== undefined) {
      dbUpdates.content = updates.description;
    }
    if (updates.importance !== undefined) {
      dbUpdates.importance = Math.round(updates.importance * 10);
    }

    // 更新 metadata 中的字段
    if (
      updates.context !== undefined ||
      updates.type !== undefined ||
      updates.relatedSessions !== undefined
    ) {
      const existing = await repo.findById(eventId);
      const existingMeta = (existing?.metadata ?? {}) as Partial<EventMetadata>;

      dbUpdates.metadata = {
        ...existingMeta,
        ...(updates.type !== undefined ? { eventType: updates.type } : {}),
        ...(updates.context !== undefined ? { context: updates.context } : {}),
        ...(updates.relatedSessions !== undefined
          ? { relatedSessions: updates.relatedSessions }
          : {}),
      };
    }

    await repo.update(eventId, dbUpdates);
  }

  /**
   * 删除关键事件
   */
  async deleteKeyEvent(userId: string, eventId: string): Promise<void> {
    logger.info(`[postgres-episodic] 删除事件: ${eventId} (用户: ${userId})`);

    const repo = this.getRepo(userId);
    await repo.deactivate(eventId);
  }

  // ==================== 搜索 ====================

  /**
   * 搜索情节
   *
   * 当前使用简单文本匹配。后续可接入 Milvus 进行语义搜索。
   *
   * @future 接入 Milvus 向量搜索
   */
  async searchEpisodes(
    userId: string,
    query: string,
    options?: { limit?: number; minScore?: number; startDate?: Date; endDate?: Date },
  ): Promise<EpisodeSearchResult[]> {
    logger.debug(`[postgres-episodic] 搜索: "${query}" (用户: ${userId})`);

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      activeOnly: true,
      limit: 100,
    });

    const minScore = options?.minScore ?? 0.1;
    const results: EpisodeSearchResult[] = [];

    for (const record of memories) {
      // 时间过滤
      if (options?.startDate && record.createdAt < options.startDate) continue;
      if (options?.endDate && record.createdAt > options.endDate) continue;

      const searchText = `${record.content} ${record.summary ?? ""}`;
      const score = textMatchScore(searchText, query);

      if (score >= minScore) {
        const isConversation = record.category === "conversation";
        const meta = record.metadata as Record<string, unknown> | null;

        results.push({
          id: record.id,
          content: record.summary ?? record.content,
          score,
          type: isConversation ? "conversation" : "event",
          timestamp: record.createdAt,
          sessionId: isConversation
            ? ((meta?.sessionId as string) ?? record.sourceId ?? undefined)
            : undefined,
          metadata: isConversation ? undefined : (meta ?? undefined),
        });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, options?.limit ?? 10);
  }

  /**
   * 获取时间线
   */
  async getTimeline(userId: string, startDate: Date, endDate: Date): Promise<TimelineEntry[]> {
    logger.debug(
      `[postgres-episodic] 获取时间线: ${startDate.toISOString()} - ${endDate.toISOString()} (用户: ${userId})`,
    );

    const repo = this.getRepo(userId);
    const { memories } = await repo.findAll({
      type: "episodic",
      activeOnly: true,
      limit: 100,
    });

    const entries: TimelineEntry[] = [];

    for (const record of memories) {
      // 时间范围过滤
      if (record.createdAt < startDate || record.createdAt > endDate) continue;

      if (record.category === "conversation") {
        const meta = (record.metadata ?? {}) as Partial<ConversationMetadata>;
        entries.push({
          id: record.id,
          type: "conversation",
          title: meta.keyTopics?.slice(0, 3).join(", ") ?? "对话",
          description: record.summary ?? record.content,
          timestamp: record.createdAt,
          importance: record.importance / 10,
          metadata: {
            sessionId: meta.sessionId ?? record.sourceId,
            messageCount: meta.messageCount,
          },
        });
      } else if (record.category === "event") {
        const meta = (record.metadata ?? {}) as Partial<EventMetadata>;
        entries.push({
          id: record.id,
          type: meta.eventType === "milestone" ? "milestone" : "event",
          title: meta.eventType ?? "event",
          description: record.content,
          timestamp: record.createdAt,
          importance: record.importance / 10,
          metadata: {
            eventType: meta.eventType,
            context: meta.context,
          },
        });
      }
    }

    // 按时间倒序
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return entries;
  }
}

// ==================== 辅助函数 ====================

/**
 * 简单关键词提取
 *
 * 从消息中提取频率最高的词作为话题
 */
function extractSimpleKeywords(messages: Message[]): string[] {
  const allText = messages.map((m) => m.content).join(" ");
  const stopWords = new Set([
    "的",
    "是",
    "在",
    "了",
    "和",
    "与",
    "或",
    "有",
    "我",
    "你",
    "他",
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "this",
    "that",
  ]);

  const words = allText
    .toLowerCase()
    .split(/[\s,.!?;:'"()\[\]{}]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// 自动注册提供者
registerProvider(
  "episodic",
  "postgres",
  PostgresEpisodicMemoryProvider as unknown as new (
    options: Record<string, unknown>,
  ) => PostgresEpisodicMemoryProvider,
);
