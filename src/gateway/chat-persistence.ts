/**
 * chat-persistence - 消息双写持久化模块
 *
 * 在 chat.send 流程中将消息同步写入 PostgreSQL 数据库，
 * 与现有 JSONL 文件持久化并行运行（双写过渡期）。
 *
 * 核心职责：
 * - sessionKey → conversationId 映射管理
 * - 用户消息和 AI 消息的 DB 持久化
 * - conversation 自动创建/更新
 *
 * 多租户隔离通过 TenantScopedRepository 基类自动保证。
 */

import { type Database, getDatabase } from "../db/connection.js";
import {
  getConversationRepository,
  getMessageRepository,
} from "../db/repositories/conversations.js";

import { extractUserIdFromSessionKey, DEFAULT_USER_ID } from "../routing/session-key.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/**
 * 安全获取数据库实例
 *
 * DATABASE_URL 未配置时返回 null，不抛出异常。
 * 用于双写场景：DB 不可用时优雅降级到仅 JSONL。
 */
function tryGetDatabase(): Database | null {
  try {
    return getDatabase();
  } catch {
    logger.debug("[chat-persistence] 数据库不可用，跳过 DB 持久化");
    return null;
  }
}

/**
 * 消息持久化所需的消息数据
 */
export interface PersistableMessage {
  /** 消息角色 */
  role: "user" | "assistant" | "system" | "tool";
  /** 消息文本内容 */
  content: string;
  /** 附件列表（可选） */
  attachments?: Array<{
    fileId: string;
    name: string;
    type: string;
    url?: string;
  }>;
  /** 工具调用记录（可选，assistant 消息） */
  toolCalls?: Record<string, unknown>[];
  /** 工具执行结果（可选，tool 消息） */
  toolResults?: Record<string, unknown>[];
  /** Token 消耗数（可选） */
  tokenCount?: number;
  /** 使用的模型 ID（可选） */
  modelId?: string;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * sessionKey → conversationId 内存缓存
 *
 * 避免每次消息都查询 DB。Gateway 重启后缓存清空，
 * 首次消息会触发 DB 查询或创建。
 */
const sessionConversationCache = new Map<string, string>();

/**
 * 清理 sessionKey → conversationId 缓存
 *
 * 用于测试或 Gateway 重置
 */
export function clearPersistenceCache(): void {
  sessionConversationCache.clear();
  logger.debug("[chat-persistence] 缓存已清空");
}

/**
 * 获取或创建 sessionKey 对应的 conversation
 *
 * 先查内存缓存，再查 DB，最后创建新记录。
 * 内部安全获取 DB，DATABASE_URL 未配置时返回 null。
 *
 * @param sessionKey - Gateway sessionKey
 * @returns conversationId 和 userId，DB 不可用时返回 null
 */
export async function ensureConversation(
  sessionKey: string,
): Promise<{ conversationId: string; userId: string } | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);

  if (userId === DEFAULT_USER_ID) {
    logger.debug("[chat-persistence] 默认用户，跳过 DB 持久化");
    return null;
  }

  /** 1. 查内存缓存 */
  const cachedId = sessionConversationCache.get(sessionKey);
  if (cachedId) {
    return { conversationId: cachedId, userId };
  }

  /** 2. 获取 DB 实例 */
  const db = tryGetDatabase();
  if (!db) return null;

  /** 3. 查 DB 或创建 */
  try {
    const convRepo = getConversationRepository(db, userId);
    const { conversation } = await convRepo.findOrCreateBySessionKey(sessionKey, {
      type: "chat",
      title: null,
    });

    sessionConversationCache.set(sessionKey, conversation.id);
    logger.debug(
      `[chat-persistence] conversation 已就绪, id=${conversation.id}, sessionKey=${sessionKey}`,
    );
    return { conversationId: conversation.id, userId };
  } catch (error) {
    logger.error("[chat-persistence] ensureConversation 失败:", error);
    return null;
  }
}

/**
 * 持久化用户消息到 DB
 *
 * 在 chat.send 接收到用户消息后调用。
 * 失败时仅记录日志，不影响主流程（JSONL 仍正常写入）。
 *
 * @param sessionKey - Gateway sessionKey
 * @param message - 用户消息数据
 */
export async function persistUserMessage(
  sessionKey: string,
  message: PersistableMessage,
): Promise<void> {
  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return;

    const db = tryGetDatabase();
    if (!db) return;

    const { conversationId, userId } = ctx;
    const msgRepo = getMessageRepository(db, userId);

    await msgRepo.create({
      conversationId,
      role: message.role,
      content: message.content,
      attachments: message.attachments,
      metadata: message.metadata,
    });

    const convRepo = getConversationRepository(db, userId);
    await convRepo.incrementMessageCount(conversationId);

    logger.debug(`[chat-persistence] 用户消息已持久化, conversationId=${conversationId}`);
  } catch (error) {
    logger.error("[chat-persistence] persistUserMessage 失败:", error);
  }
}

/**
 * 持久化 AI 回复消息到 DB
 *
 * 在 broadcastChatFinal 时调用。
 * 失败时仅记录日志，不影响主流程。
 *
 * @param sessionKey - Gateway sessionKey
 * @param message - AI 消息数据
 */
export async function persistAssistantMessage(
  sessionKey: string,
  message: PersistableMessage,
): Promise<void> {
  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return;

    const db = tryGetDatabase();
    if (!db) return;

    const { conversationId, userId } = ctx;
    const msgRepo = getMessageRepository(db, userId);

    await msgRepo.create({
      conversationId,
      role: "assistant",
      content: message.content,
      toolCalls: message.toolCalls,
      toolResults: message.toolResults,
      tokenCount: message.tokenCount,
      modelId: message.modelId,
      metadata: message.metadata,
    });

    const convRepo = getConversationRepository(db, userId);
    await convRepo.incrementMessageCount(conversationId);

    logger.debug(`[chat-persistence] AI 消息已持久化, conversationId=${conversationId}`);
  } catch (error) {
    logger.error("[chat-persistence] persistAssistantMessage 失败:", error);
  }
}

/**
 * 从 DB 加载会话消息历史
 *
 * chat.history 优先使用此方法，降级到 JSONL 读取。
 *
 * @param sessionKey - Gateway sessionKey
 * @param limit - 消息数量限制
 * @returns 消息列表，如果 DB 中无数据返回 null（触发降级）
 */
export async function loadMessagesFromDb(
  sessionKey: string,
  limit: number = 50,
): Promise<Array<{
  role: string;
  content: string | null;
  toolCalls?: Record<string, unknown>[] | null;
  attachments?: Array<{ fileId: string; name: string; type: string; url?: string }> | null;
  createdAt: Date;
}> | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);

  if (userId === DEFAULT_USER_ID) {
    return null;
  }

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const convRepo = getConversationRepository(db, userId);
    const conversation = await convRepo.findBySessionKey(sessionKey);

    if (!conversation) {
      logger.debug(
        `[chat-persistence] 未找到 conversation, sessionKey=${sessionKey}, 降级到 JSONL`,
      );
      return null;
    }

    const msgRepo = getMessageRepository(db, userId);
    const { messages } = await msgRepo.findByConversation(conversation.id, { limit });

    logger.debug(
      `[chat-persistence] 从 DB 加载 ${messages.length} 条消息, conversationId=${conversation.id}`,
    );

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      attachments: msg.attachments,
      createdAt: msg.createdAt,
    }));
  } catch (error) {
    logger.error("[chat-persistence] loadMessagesFromDb 失败:", error);
    return null;
  }
}
