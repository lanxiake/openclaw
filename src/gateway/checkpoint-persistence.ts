/**
 * checkpoint-persistence - Agent 断点 DB 持久化模块
 *
 * 在 Agent 运行中断时（用户中断/超时/错误），
 * 自动保存执行状态到 agent_checkpoints 表，
 * 后续可通过 chat.resume RPC 从断点恢复。
 *
 * 与 chat-persistence / todo-persistence 类似，
 * DB 不可用时优雅降级（仅失去断点恢复能力）。
 *
 * 多租户隔离通过 TenantScopedRepository 自动保证。
 */

import { type Database, getDatabase } from "../db/connection.js";
import { getAgentCheckpointRepository } from "../db/repositories/agent-checkpoints.js";
import type {
  AgentCheckpoint,
  AbortReason,
  AgentStateSnapshot,
  ConversationSnapshot,
  CheckpointMetadata,
} from "../db/schema/agent-checkpoints.js";
import { ensureConversation } from "./chat-persistence.js";
import { extractUserIdFromSessionKey, DEFAULT_USER_ID } from "../routing/session-key.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/**
 * 安全获取数据库实例
 */
function tryGetDatabase(): Database | null {
  try {
    return getDatabase();
  } catch {
    logger.debug("[checkpoint-persistence] 数据库不可用，跳过持久化");
    return null;
  }
}

/**
 * 保存断点快照到 DB
 *
 * 在 server-chat.ts 或 chat-abort.ts 中检测到中断后调用。
 * 失败时仅记录日志，不影响中断流程。
 *
 * @param sessionKey - Gateway sessionKey
 * @param runId - 被中断的 Agent run ID
 * @param abortReason - 中断原因
 * @param options - 可选的状态快照和元数据
 * @returns 保存后的断点 ID，失败返回 null
 */
export async function saveCheckpoint(
  sessionKey: string,
  runId: string,
  abortReason: AbortReason,
  options?: {
    agentState?: AgentStateSnapshot;
    conversationSnapshot?: ConversationSnapshot;
    metadata?: CheckpointMetadata;
  },
): Promise<string | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (userId === DEFAULT_USER_ID) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    /** 获取关联的 conversationId */
    const ctx = await ensureConversation(sessionKey);
    const conversationId = ctx?.conversationId;

    const repo = getAgentCheckpointRepository(db, userId);
    const checkpoint = await repo.save({
      sessionKey,
      runId,
      abortReason,
      conversationId,
      agentState: options?.agentState,
      conversationSnapshot: options?.conversationSnapshot,
      metadata: options?.metadata,
    });

    logger.debug(
      `[checkpoint-persistence] 断点已保存, id=${checkpoint.id}, ` +
        `runId=${runId}, reason=${abortReason}, sessionKey=${sessionKey}`,
    );

    return checkpoint.id;
  } catch (error) {
    logger.error("[checkpoint-persistence] saveCheckpoint 失败:", error);
    return null;
  }
}

/**
 * 查询可恢复的断点列表
 *
 * 用于 chat.checkpoint.list RPC 方法。
 *
 * @param sessionKey - Gateway sessionKey
 * @param limit - 数量限制
 * @returns 断点列表，DB 不可用返回 null
 */
export async function listCheckpoints(
  sessionKey: string,
  limit: number = 10,
): Promise<AgentCheckpoint[] | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (userId === DEFAULT_USER_ID) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const repo = getAgentCheckpointRepository(db, userId);
    const checkpoints = await repo.findResumableBySessionKey(sessionKey, limit);

    logger.debug(
      `[checkpoint-persistence] 查询到 ${checkpoints.length} 个可恢复断点, ` +
        `sessionKey=${sessionKey}`,
    );

    return checkpoints;
  } catch (error) {
    logger.error("[checkpoint-persistence] listCheckpoints 失败:", error);
    return null;
  }
}

/**
 * 加载断点详情
 *
 * 用于 chat.checkpoint.load RPC 和恢复流程。
 *
 * @param sessionKey - Gateway sessionKey（用于验证归属）
 * @param checkpointId - 断点 ID
 * @returns 断点记录或 null
 */
export async function loadCheckpoint(
  sessionKey: string,
  checkpointId: string,
): Promise<AgentCheckpoint | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (userId === DEFAULT_USER_ID) return null;

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const repo = getAgentCheckpointRepository(db, userId);
    const checkpoint = await repo.findById(checkpointId);

    if (!checkpoint) {
      logger.debug(`[checkpoint-persistence] 断点不存在, id=${checkpointId}`);
      return null;
    }

    /** 验证 sessionKey 归属 */
    if (checkpoint.sessionKey !== sessionKey) {
      logger.warn(
        `[checkpoint-persistence] sessionKey 不匹配, ` +
          `expected=${sessionKey}, actual=${checkpoint.sessionKey}`,
      );
      return null;
    }

    return checkpoint;
  } catch (error) {
    logger.error("[checkpoint-persistence] loadCheckpoint 失败:", error);
    return null;
  }
}

/**
 * 标记断点已恢复
 *
 * 恢复执行成功后调用，防止重复恢复。
 *
 * @param sessionKey - Gateway sessionKey
 * @param checkpointId - 断点 ID
 * @returns 是否成功标记
 */
export async function markCheckpointResumed(
  sessionKey: string,
  checkpointId: string,
): Promise<boolean> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (userId === DEFAULT_USER_ID) return false;

  const db = tryGetDatabase();
  if (!db) return false;

  try {
    const repo = getAgentCheckpointRepository(db, userId);
    const updated = await repo.markResumed(checkpointId);

    if (updated) {
      logger.debug(
        `[checkpoint-persistence] 断点已标记恢复, id=${checkpointId}, sessionKey=${sessionKey}`,
      );
      return true;
    }

    return false;
  } catch (error) {
    logger.error("[checkpoint-persistence] markCheckpointResumed 失败:", error);
    return false;
  }
}

/**
 * 删除断点
 *
 * @param sessionKey - Gateway sessionKey
 * @param checkpointId - 断点 ID
 * @returns 是否成功删除
 */
export async function deleteCheckpoint(sessionKey: string, checkpointId: string): Promise<boolean> {
  const userId = extractUserIdFromSessionKey(sessionKey);
  if (userId === DEFAULT_USER_ID) return false;

  const db = tryGetDatabase();
  if (!db) return false;

  try {
    const repo = getAgentCheckpointRepository(db, userId);
    await repo.deleteById(checkpointId);

    logger.debug(
      `[checkpoint-persistence] 断点已删除, id=${checkpointId}, sessionKey=${sessionKey}`,
    );
    return true;
  } catch (error) {
    logger.error("[checkpoint-persistence] deleteCheckpoint 失败:", error);
    return false;
  }
}
