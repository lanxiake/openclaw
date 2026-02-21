/**
 * 记忆系统 RPC 方法
 *
 * 提供用户记忆管理相关的 API，包括：
 *
 * Profile（画像记忆）:
 * - memory.profile.fact.add      - 添加用户事实
 * - memory.profile.fact.list     - 列出用户事实
 * - memory.profile.fact.search   - 搜索用户事实
 * - memory.profile.fact.update   - 更新用户事实
 * - memory.profile.fact.delete   - 删除用户事实
 * - memory.profile.preferences.get    - 获取用户偏好
 * - memory.profile.preferences.update - 更新用户偏好
 * - memory.profile.preferences.reset  - 重置用户偏好
 * - memory.profile.pattern.list    - 列出行为模式
 * - memory.profile.pattern.add     - 添加行为模式
 * - memory.profile.pattern.update  - 更新行为模式
 * - memory.profile.pattern.delete  - 删除行为模式
 * - memory.profile.pattern.confirm - 确认/否定模式
 * - memory.profile.export          - 导出完整画像
 *
 * Episodic（情节记忆）:
 * - memory.episodic.conversation.add     - 添加对话
 * - memory.episodic.conversation.history - 获取对话历史
 * - memory.episodic.conversation.summary - 生成摘要
 * - memory.episodic.conversation.delete  - 删除对话
 * - memory.episodic.event.add    - 添加关键事件
 * - memory.episodic.event.list   - 列出关键事件
 * - memory.episodic.event.update - 更新关键事件
 * - memory.episodic.event.delete - 删除关键事件
 * - memory.episodic.search       - 搜索情节
 * - memory.episodic.timeline     - 获取时间线
 *
 * 通用:
 * - memory.health - 记忆系统健康状态
 *
 * @module gateway/server-methods/memory
 */

import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";
import { getGatewayMemoryService } from "../memory-service.js";
import type {
  FactCategory,
  BehaviorPatternType,
} from "../../memory/pluggable/interfaces/profile-memory.js";
import type { KeyEventType } from "../../memory/pluggable/interfaces/episodic-memory.js";
import type { Message } from "../../memory/pluggable/interfaces/types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const logger = createSubsystemLogger("memory/rpc");

// ==================== 辅助函数 ====================

/**
 * 从 handler 选项中提取已认证用户的 userId
 *
 * @returns userId 或 null（未认证时）
 */
function getUserId(client: Parameters<GatewayRequestHandler>[0]["client"]): string | null {
  return client?.authenticatedUser?.userId ?? null;
}

/**
 * 检查用户认证并返回 userId，未认证时自动回复错误
 *
 * @returns userId 或 null（已回复错误）
 */
function requireAuth(
  client: Parameters<GatewayRequestHandler>[0]["client"],
  respond: Parameters<GatewayRequestHandler>[0]["respond"],
): string | null {
  const userId = getUserId(client);
  if (!userId) {
    respond(true, {
      success: false,
      error: "未认证，请先登录",
    });
    return null;
  }
  return userId;
}

/**
 * 获取记忆管理器，未就绪时自动回复错误
 *
 * @returns 记忆管理器或 null（已回复错误）
 */
function getMemoryManager(respond: Parameters<GatewayRequestHandler>[0]["respond"]) {
  try {
    const service = getGatewayMemoryService();
    if (!service.isReady) {
      logger.warn("记忆服务未就绪", { status: service.status });
      respond(true, {
        success: false,
        error: "记忆服务未就绪",
      });
      return null;
    }
    return service.manager;
  } catch (error) {
    logger.error("获取记忆服务失败", { error: String(error) });
    respond(true, {
      success: false,
      error: "记忆服务不可用",
    });
    return null;
  }
}

// ==================== Profile: 事实管理 ====================

/**
 * 添加用户事实
 */
const addFact: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("添加事实", { userId, category: params.category });

  try {
    const factId = await manager.profile.addFact(userId, {
      category: params.category as FactCategory,
      key: params.key as string,
      value: params.value as string,
      confidence: (params.confidence as number) ?? 0.8,
      source: (params.source as "explicit" | "inferred") ?? "explicit",
      sensitive: (params.sensitive as boolean) ?? false,
    });

    logger.debug("事实已添加", { factId });
    respond(true, {
      success: true,
      factId,
    });
  } catch (error) {
    logger.error("添加事实失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "添加事实失败",
    });
  }
};

/**
 * 列出用户事实
 */
const listFacts: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const category = params.category as string | undefined;
  logger.debug("查询事实", { userId, category: category ?? "all" });

  try {
    const facts = await manager.profile.getFacts(userId, category as FactCategory | undefined);

    logger.debug("事实查询结果", { count: facts.length });
    respond(true, {
      success: true,
      facts,
      total: facts.length,
    });
  } catch (error) {
    logger.error("查询事实失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "查询事实失败",
    });
  }
};

/**
 * 搜索用户事实
 */
const searchFacts: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const query = params.query as string;
  logger.debug("搜索事实", { userId, query });

  try {
    const facts = await manager.profile.searchFacts(userId, query);

    logger.debug("搜索结果", { count: facts.length });
    respond(true, {
      success: true,
      facts,
      total: facts.length,
    });
  } catch (error) {
    logger.error("搜索事实失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "搜索事实失败",
    });
  }
};

/**
 * 更新用户事实
 */
const updateFact: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const factId = params.factId as string;
  logger.debug("更新事实", { userId, factId });

  try {
    const updates: Record<string, unknown> = {};
    if (params.value !== undefined) updates.value = params.value;
    if (params.confidence !== undefined) updates.confidence = params.confidence;
    if (params.sensitive !== undefined) updates.sensitive = params.sensitive;

    await manager.profile.updateFact(userId, factId, updates);

    logger.debug("事实已更新");
    respond(true, {
      success: true,
      message: "事实已更新",
    });
  } catch (error) {
    logger.error("更新事实失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新事实失败",
    });
  }
};

/**
 * 删除用户事实
 */
const deleteFact: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const factId = params.factId as string;
  logger.debug("删除事实", { userId, factId });

  try {
    await manager.profile.deleteFact(userId, factId);

    logger.debug("事实已删除");
    respond(true, {
      success: true,
      message: "事实已删除",
    });
  } catch (error) {
    logger.error("删除事实失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "删除事实失败",
    });
  }
};

// ==================== Profile: 偏好管理 ====================

/**
 * 获取用户偏好
 */
const getPreferences: GatewayRequestHandler = async ({ client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("获取偏好", { userId });

  try {
    const preferences = await manager.profile.getPreferences(userId);

    logger.debug("偏好已获取", { language: preferences.language });
    respond(true, {
      success: true,
      preferences,
    });
  } catch (error) {
    logger.error("获取偏好失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取偏好失败",
    });
  }
};

/**
 * 更新用户偏好
 */
const updatePreferences: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("更新偏好", { userId, keys: Object.keys(params) });

  try {
    const updates: Record<string, unknown> = {};
    const allowedKeys = [
      "language",
      "timezone",
      "responseStyle",
      "confirmLevel",
      "favoriteSkills",
      "disabledSkills",
      "thinkingLevel",
      "verboseLevel",
      "notifications",
    ];

    for (const key of allowedKeys) {
      if (params[key] !== undefined) {
        updates[key] = params[key];
      }
    }

    await manager.profile.updatePreferences(userId, updates);

    logger.debug("偏好已更新");
    respond(true, {
      success: true,
      message: "偏好已更新",
    });
  } catch (error) {
    logger.error("更新偏好失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新偏好失败",
    });
  }
};

/**
 * 重置用户偏好
 */
const resetPreferences: GatewayRequestHandler = async ({ client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("重置偏好", { userId });

  try {
    await manager.profile.resetPreferences(userId);

    logger.debug("偏好已重置");
    respond(true, {
      success: true,
      message: "偏好已重置为默认值",
    });
  } catch (error) {
    logger.error("重置偏好失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "重置偏好失败",
    });
  }
};

// ==================== Profile: 行为模式 ====================

/**
 * 列出行为模式
 */
const listPatterns: GatewayRequestHandler = async ({ client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("查询行为模式", { userId });

  try {
    const patterns = await manager.profile.getPatterns(userId);

    logger.debug("行为模式查询结果", { count: patterns.length });
    respond(true, {
      success: true,
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    logger.error("查询行为模式失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "查询行为模式失败",
    });
  }
};

/**
 * 添加行为模式
 */
const addPattern: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("添加行为模式", { userId, type: params.type });

  try {
    const patternId = await manager.profile.addPattern(userId, {
      type: params.type as BehaviorPatternType,
      pattern: params.pattern as string,
      evidence: (params.evidence as string[]) ?? [],
      confidence: (params.confidence as number) ?? 0.5,
    });

    logger.debug("行为模式已添加", { patternId });
    respond(true, {
      success: true,
      patternId,
    });
  } catch (error) {
    logger.error("添加行为模式失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "添加行为模式失败",
    });
  }
};

/**
 * 更新行为模式
 */
const updatePattern: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const patternId = params.patternId as string;
  logger.debug("更新行为模式", { userId, patternId });

  try {
    const updates: Record<string, unknown> = {};
    if (params.confidence !== undefined) updates.confidence = params.confidence;
    if (params.evidence !== undefined) updates.evidence = params.evidence;
    if (params.pattern !== undefined) updates.pattern = params.pattern;

    await manager.profile.updatePattern(userId, patternId, updates);

    logger.debug("行为模式已更新");
    respond(true, {
      success: true,
      message: "行为模式已更新",
    });
  } catch (error) {
    logger.error("更新行为模式失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新行为模式失败",
    });
  }
};

/**
 * 删除行为模式
 */
const deletePattern: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const patternId = params.patternId as string;
  logger.debug("删除行为模式", { userId, patternId });

  try {
    await manager.profile.deletePattern(userId, patternId);

    logger.debug("行为模式已删除");
    respond(true, {
      success: true,
      message: "行为模式已删除",
    });
  } catch (error) {
    logger.error("删除行为模式失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "删除行为模式失败",
    });
  }
};

/**
 * 确认/否定行为模式
 */
const confirmPattern: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const patternId = params.patternId as string;
  const confirmed = params.confirmed as boolean;
  logger.debug("确认行为模式", { userId, patternId, confirmed });

  try {
    await manager.profile.confirmPattern(userId, patternId, confirmed);

    logger.debug("行为模式确认状态已更新");
    respond(true, {
      success: true,
      message: confirmed ? "行为模式已确认" : "行为模式已否定",
    });
  } catch (error) {
    logger.error("确认行为模式失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "确认行为模式失败",
    });
  }
};

// ==================== Profile: 导出 ====================

/**
 * 导出完整用户画像
 */
const exportProfile: GatewayRequestHandler = async ({ client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("导出画像", { userId });

  try {
    const profile = await manager.profile.exportProfile(userId);

    logger.debug("画像已导出", {
      factsCount: profile.facts.length,
      patternsCount: profile.patterns.length,
    });
    respond(true, {
      success: true,
      profile,
    });
  } catch (error) {
    logger.error("导出画像失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "导出画像失败",
    });
  }
};

// ==================== Episodic: 对话历史 ====================

/**
 * 添加对话
 */
const addConversation: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const sessionId = params.sessionId as string;
  const rawMessages = params.messages as Array<{ role: string; content: string }>;
  logger.debug("添加对话", { userId, sessionId, messageCount: rawMessages.length });

  try {
    // 补充 Message 接口必需的 id 和 createdAt 字段
    const messages: Message[] = rawMessages.map((msg, index) => ({
      id: `${sessionId}-${index}`,
      role: msg.role as Message["role"],
      content: msg.content,
      createdAt: new Date(),
    }));

    await manager.episodic.addConversation(userId, sessionId, messages);

    logger.debug("对话已添加");
    respond(true, {
      success: true,
      message: "对话已添加",
    });
  } catch (error) {
    logger.error("添加对话失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "添加对话失败",
    });
  }
};

/**
 * 获取对话历史列表
 */
const getConversationHistory: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const limit = params.limit as number | undefined;
  const offset = params.offset as number | undefined;
  logger.debug("获取对话历史", { userId, limit, offset });

  try {
    const history = await manager.episodic.getConversationHistory(userId, {
      limit,
      offset,
    });

    logger.debug("对话历史", { count: history.length });
    respond(true, {
      success: true,
      history,
      total: history.length,
    });
  } catch (error) {
    logger.error("获取对话历史失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取对话历史失败",
    });
  }
};

/**
 * 获取对话摘要
 */
const getConversationSummary: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const sessionId = params.sessionId as string;
  logger.debug("获取对话摘要", { userId, sessionId });

  try {
    const summary = await manager.episodic.summarizeConversation(userId, sessionId);

    logger.debug("对话摘要已生成", { topicsCount: summary.keyTopics.length });
    respond(true, {
      success: true,
      summary,
    });
  } catch (error) {
    logger.error("获取对话摘要失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取对话摘要失败",
    });
  }
};

/**
 * 删除对话
 */
const deleteConversation: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const sessionId = params.sessionId as string;
  logger.debug("删除对话", { userId, sessionId });

  try {
    await manager.episodic.deleteConversation(userId, sessionId);

    logger.debug("对话已删除");
    respond(true, {
      success: true,
      message: "对话已删除",
    });
  } catch (error) {
    logger.error("删除对话失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "删除对话失败",
    });
  }
};

// ==================== Episodic: 关键事件 ====================

/**
 * 添加关键事件
 */
const addKeyEvent: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  logger.debug("添加关键事件", { userId, type: params.type });

  try {
    const eventId = await manager.episodic.addKeyEvent(userId, {
      type: params.type as KeyEventType,
      description: params.description as string,
      context: (params.context as string) ?? "",
      importance: (params.importance as number) ?? 0.5,
      relatedSessions: (params.relatedSessions as string[]) ?? [],
      timestamp: params.timestamp ? new Date(params.timestamp as string) : new Date(),
    });

    logger.debug("关键事件已添加", { eventId });
    respond(true, {
      success: true,
      eventId,
    });
  } catch (error) {
    logger.error("添加关键事件失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "添加关键事件失败",
    });
  }
};

/**
 * 列出关键事件
 */
const listKeyEvents: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const types = params.types as KeyEventType[] | undefined;
  const limit = params.limit as number | undefined;
  logger.debug("查询关键事件", { userId, types, limit });

  try {
    const events = await manager.episodic.getKeyEvents(userId, {
      types,
      limit,
    });

    logger.debug("关键事件查询结果", { count: events.length });
    respond(true, {
      success: true,
      events,
      total: events.length,
    });
  } catch (error) {
    logger.error("查询关键事件失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "查询关键事件失败",
    });
  }
};

/**
 * 更新关键事件
 */
const updateKeyEvent: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const eventId = params.eventId as string;
  logger.debug("更新关键事件", { userId, eventId });

  try {
    const updates: Record<string, unknown> = {};
    if (params.description !== undefined) updates.description = params.description;
    if (params.importance !== undefined) updates.importance = params.importance;
    if (params.context !== undefined) updates.context = params.context;

    await manager.episodic.updateKeyEvent(userId, eventId, updates);

    logger.debug("关键事件已更新");
    respond(true, {
      success: true,
      message: "关键事件已更新",
    });
  } catch (error) {
    logger.error("更新关键事件失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "更新关键事件失败",
    });
  }
};

/**
 * 删除关键事件
 */
const deleteKeyEvent: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const eventId = params.eventId as string;
  logger.debug("删除关键事件", { userId, eventId });

  try {
    await manager.episodic.deleteKeyEvent(userId, eventId);

    logger.debug("关键事件已删除");
    respond(true, {
      success: true,
      message: "关键事件已删除",
    });
  } catch (error) {
    logger.error("删除关键事件失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "删除关键事件失败",
    });
  }
};

// ==================== Episodic: 搜索和时间线 ====================

/**
 * 搜索情节记忆
 */
const searchEpisodes: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const query = params.query as string;
  const limit = params.limit as number | undefined;
  logger.debug("搜索情节", { userId, query });

  try {
    const results = await manager.episodic.searchEpisodes(userId, query, {
      limit,
    });

    logger.debug("搜索结果", { count: results.length });
    respond(true, {
      success: true,
      results,
      total: results.length,
    });
  } catch (error) {
    logger.error("搜索情节失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "搜索情节失败",
    });
  }
};

/**
 * 获取时间线
 */
const getTimeline: GatewayRequestHandler = async ({ params, client, respond }) => {
  const userId = requireAuth(client, respond);
  if (!userId) return;

  const manager = getMemoryManager(respond);
  if (!manager) return;

  const startDate = new Date(params.startDate as string);
  const endDate = new Date(params.endDate as string);
  logger.debug("获取时间线", {
    userId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  try {
    const timeline = await manager.episodic.getTimeline(userId, startDate, endDate);

    logger.debug("时间线条目", { count: timeline.length });
    respond(true, {
      success: true,
      timeline,
      total: timeline.length,
    });
  } catch (error) {
    logger.error("获取时间线失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取时间线失败",
    });
  }
};

// ==================== 通用 ====================

/**
 * 记忆系统健康检查
 */
const memoryHealth: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("健康检查");

  try {
    const service = getGatewayMemoryService();
    const report = await service.healthCheck();

    logger.debug("健康状态", { status: report.status });
    respond(true, {
      success: true,
      health: report,
    });
  } catch (error) {
    logger.error("健康检查失败", { error: error instanceof Error ? error.message : String(error) });
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "健康检查失败",
    });
  }
};

// ==================== 导出 ====================

/**
 * 记忆系统 RPC 方法注册表
 */
export const memoryHandlers: GatewayRequestHandlers = {
  // Profile: 事实管理
  "memory.profile.fact.add": addFact,
  "memory.profile.fact.list": listFacts,
  "memory.profile.fact.search": searchFacts,
  "memory.profile.fact.update": updateFact,
  "memory.profile.fact.delete": deleteFact,

  // Profile: 偏好管理
  "memory.profile.preferences.get": getPreferences,
  "memory.profile.preferences.update": updatePreferences,
  "memory.profile.preferences.reset": resetPreferences,

  // Profile: 行为模式
  "memory.profile.pattern.list": listPatterns,
  "memory.profile.pattern.add": addPattern,
  "memory.profile.pattern.update": updatePattern,
  "memory.profile.pattern.delete": deletePattern,
  "memory.profile.pattern.confirm": confirmPattern,

  // Profile: 导出
  "memory.profile.export": exportProfile,

  // Episodic: 对话历史
  "memory.episodic.conversation.add": addConversation,
  "memory.episodic.conversation.history": getConversationHistory,
  "memory.episodic.conversation.summary": getConversationSummary,
  "memory.episodic.conversation.delete": deleteConversation,

  // Episodic: 关键事件
  "memory.episodic.event.add": addKeyEvent,
  "memory.episodic.event.list": listKeyEvents,
  "memory.episodic.event.update": updateKeyEvent,
  "memory.episodic.event.delete": deleteKeyEvent,

  // Episodic: 搜索和时间线
  "memory.episodic.search": searchEpisodes,
  "memory.episodic.timeline": getTimeline,

  // 通用
  "memory.health": memoryHealth,
};
