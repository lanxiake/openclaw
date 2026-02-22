/**
 * queue-persistence - 消息队列 DB 持久化模块
 *
 * 将用户在 agent 执行期间发送的消息存入 DB 排队，
 * agent 完成后按 queueOrder 逐条出队发送。
 *
 * 利用 messages 表的 status='queued' + queueOrder 字段实现，
 * 无需额外建表。
 *
 * 多租户隔离通过 TenantScopedRepository 自动保证。
 */

import { type Database, getDatabase } from "../db/connection.js";
import {
  getConversationRepository,
  getMessageRepository,
} from "../db/repositories/conversations.js";
import { ensureConversation } from "./chat-persistence.js";
import { extractUserIdFromSessionKey } from "../routing/session-key.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/**
 * 安全获取数据库实例
 */
function tryGetDatabase(): Database | null {
  try {
    return getDatabase();
  } catch {
    logger.debug("[queue-persistence] 数据库不可用，跳过持久化");
    return null;
  }
}

/**
 * 排队消息数据
 */
export interface QueueableMessage {
  /** 消息文本内容 */
  content: string;
  /** 附件（可选） */
  attachments?: Array<{
    fileId: string;
    name: string;
    type: string;
    url?: string;
  }>;
}

/**
 * 排队消息返回格式
 */
export interface QueuedMessageResult {
  /** 消息 ID */
  id: string;
  /** 消息内容 */
  content: string | null;
  /** 附件 */
  attachments?: Array<{
    fileId: string;
    name: string;
    type: string;
    url?: string;
  }> | null;
  /** 排队顺序 */
  queueOrder: number | null;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 入队：将消息写入 DB 并标记 status='queued'
 *
 * @param sessionKey - Gateway sessionKey
 * @param message - 消息数据
 * @returns 入队后的消息 ID，失败返回 null
 */
export async function enqueueMessage(
  sessionKey: string,
  message: QueueableMessage,
): Promise<string | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (!userId) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return null;

    const { conversationId } = ctx;
    const msgRepo = getMessageRepository(db, userId);

    /** 计算排队顺序：取当前最大 queueOrder + 1 */
    const queued = await msgRepo.findQueuedByConversation(conversationId);
    const maxOrder = queued.reduce((max, m) => Math.max(max, m.queueOrder ?? 0), 0);

    const created = await msgRepo.create({
      conversationId,
      role: "user",
      content: message.content,
      attachments: message.attachments,
      status: "queued",
      queueOrder: maxOrder + 1,
    });

    logger.debug(
      `[queue-persistence] 消息已入队, id=${created.id}, order=${maxOrder + 1}, sessionKey=${sessionKey}`,
    );

    return created.id;
  } catch (error) {
    logger.error("[queue-persistence] enqueueMessage 失败:", error);
    return null;
  }
}

/**
 * 查看队列：获取指定会话的所有排队消息
 *
 * @param sessionKey - Gateway sessionKey
 * @returns 排队消息列表（按 queueOrder 升序），DB 不可用返回 null
 */
export async function listQueuedMessages(
  sessionKey: string,
): Promise<QueuedMessageResult[] | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (!userId) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return null;

    const { conversationId } = ctx;
    const msgRepo = getMessageRepository(db, userId);
    const queued = await msgRepo.findQueuedByConversation(conversationId);

    return queued.map((m) => ({
      id: m.id,
      content: m.content,
      attachments: m.attachments,
      queueOrder: m.queueOrder,
      createdAt: m.createdAt,
    }));
  } catch (error) {
    logger.error("[queue-persistence] listQueuedMessages 失败:", error);
    return null;
  }
}

/**
 * 出队：取出队列头部消息并标记为 sent
 *
 * @param sessionKey - Gateway sessionKey
 * @returns 出队的消息，队列为空或失败返回 null
 */
export async function dequeueMessage(sessionKey: string): Promise<QueuedMessageResult | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (!userId) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return null;

    const { conversationId } = ctx;
    const msgRepo = getMessageRepository(db, userId);
    const queued = await msgRepo.findQueuedByConversation(conversationId);

    if (queued.length === 0) return null;

    const first = queued[0]!;
    await msgRepo.updateStatus(first.id, "sent");

    logger.debug(`[queue-persistence] 消息已出队, id=${first.id}, sessionKey=${sessionKey}`);

    return {
      id: first.id,
      content: first.content,
      attachments: first.attachments,
      queueOrder: first.queueOrder,
      createdAt: first.createdAt,
    };
  } catch (error) {
    logger.error("[queue-persistence] dequeueMessage 失败:", error);
    return null;
  }
}

/**
 * 移除：删除指定排队消息
 *
 * @param sessionKey - Gateway sessionKey
 * @param messageId - 消息 ID
 */
export async function removeQueuedMessage(sessionKey: string, messageId: string): Promise<boolean> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (!userId) return false;

  const db = tryGetDatabase();
  if (!db) return false;

  try {
    const msgRepo = getMessageRepository(db, userId);
    await msgRepo.deleteById(messageId);

    logger.debug(`[queue-persistence] 排队消息已删除, id=${messageId}, sessionKey=${sessionKey}`);
    return true;
  } catch (error) {
    logger.error("[queue-persistence] removeQueuedMessage 失败:", error);
    return false;
  }
}

/**
 * 清空：删除指定会话的所有排队消息
 *
 * @param sessionKey - Gateway sessionKey
 */
export async function clearQueuedMessages(sessionKey: string): Promise<boolean> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (!userId) return false;

  const db = tryGetDatabase();
  if (!db) return false;

  try {
    const ctx = await ensureConversation(sessionKey);
    if (!ctx) return false;

    const { conversationId } = ctx;
    const msgRepo = getMessageRepository(db, userId);
    await msgRepo.deleteQueuedByConversation(conversationId);

    logger.debug(`[queue-persistence] 排队消息已清空, sessionKey=${sessionKey}`);
    return true;
  } catch (error) {
    logger.error("[queue-persistence] clearQueuedMessages 失败:", error);
    return false;
  }
}
