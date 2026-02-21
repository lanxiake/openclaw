/**
 * Agent Checkpoint 数据访问层
 *
 * AgentCheckpointRepository 继承 TenantScopedRepository，
 * 管理 Agent 运行中断时的断点快照。
 *
 * 核心功能：
 * - 保存断点（中断时自动调用）
 * - 按 sessionKey 查询可恢复断点
 * - 加载断点详情（恢复时使用）
 * - 标记已恢复 / 删除断点
 */

import { eq, and, desc, isNull } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  agentCheckpoints,
  type AgentCheckpoint,
  type AbortReason,
  type AgentStateSnapshot,
  type ConversationSnapshot,
  type CheckpointMetadata,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== AgentCheckpointRepository ====================

/**
 * Agent Checkpoint 仓库类
 *
 * 管理 Agent 运行中断时的断点快照
 */
export class AgentCheckpointRepository extends TenantScopedRepository {
  /**
   * 保存断点快照
   *
   * 在 Agent 运行被中断时调用，保存当前执行状态。
   *
   * @param data - 断点数据
   * @returns 保存后的 AgentCheckpoint 记录
   */
  async save(data: {
    sessionKey: string;
    runId: string;
    abortReason: AbortReason;
    conversationId?: string;
    agentState?: AgentStateSnapshot;
    conversationSnapshot?: ConversationSnapshot;
    metadata?: CheckpointMetadata;
  }): Promise<AgentCheckpoint> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[AgentCheckpointRepository] save, sessionKey=${data.sessionKey}, ` +
        `runId=${data.runId}, reason=${data.abortReason}`,
    );

    const [created] = await this.db
      .insert(agentCheckpoints)
      .values({
        id,
        userId: this.tenantId,
        conversationId: data.conversationId,
        sessionKey: data.sessionKey,
        runId: data.runId,
        abortReason: data.abortReason,
        agentState: data.agentState,
        conversationSnapshot: data.conversationSnapshot,
        metadata: data.metadata,
        createdAt: now,
      })
      .returning();

    logger.debug(`[AgentCheckpointRepository] 保存成功, id=${created!.id}`);
    return created!;
  }

  /**
   * 查找指定 sessionKey 的可恢复断点（未恢复过的，按时间倒序）
   *
   * @param sessionKey - Gateway sessionKey
   * @param limit - 数量限制
   * @returns 断点列表
   */
  async findResumableBySessionKey(
    sessionKey: string,
    limit: number = 10,
  ): Promise<AgentCheckpoint[]> {
    logger.debug(`[AgentCheckpointRepository] findResumableBySessionKey, sessionKey=${sessionKey}`);

    return this.db
      .select()
      .from(agentCheckpoints)
      .where(
        and(
          eq(agentCheckpoints.userId, this.tenantId),
          eq(agentCheckpoints.sessionKey, sessionKey),
          isNull(agentCheckpoints.resumedAt),
        ),
      )
      .orderBy(desc(agentCheckpoints.createdAt))
      .limit(limit);
  }

  /**
   * 根据 ID 加载断点详情
   *
   * @param id - 断点 ID
   * @returns 断点记录或 null
   */
  async findById(id: string): Promise<AgentCheckpoint | null> {
    logger.debug(`[AgentCheckpointRepository] findById, id=${id}`);

    const results = await this.db
      .select()
      .from(agentCheckpoints)
      .where(and(eq(agentCheckpoints.userId, this.tenantId), eq(agentCheckpoints.id, id)))
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * 标记断点已恢复
   *
   * 恢复后的断点不再出现在可恢复列表中。
   *
   * @param id - 断点 ID
   * @returns 更新后的记录或 null
   */
  async markResumed(id: string): Promise<AgentCheckpoint | null> {
    logger.debug(`[AgentCheckpointRepository] markResumed, id=${id}`);

    const now = new Date();
    const [updated] = await this.db
      .update(agentCheckpoints)
      .set({ resumedAt: now })
      .where(and(eq(agentCheckpoints.userId, this.tenantId), eq(agentCheckpoints.id, id)))
      .returning();

    if (updated) {
      logger.debug(`[AgentCheckpointRepository] 标记已恢复, id=${id}`);
    }

    return updated ?? null;
  }

  /**
   * 删除指定断点
   *
   * @param id - 断点 ID
   */
  async deleteById(id: string): Promise<void> {
    logger.debug(`[AgentCheckpointRepository] deleteById, id=${id}`);

    await this.db
      .delete(agentCheckpoints)
      .where(and(eq(agentCheckpoints.userId, this.tenantId), eq(agentCheckpoints.id, id)));
  }

  /**
   * 删除指定 sessionKey 的所有断点
   *
   * @param sessionKey - Gateway sessionKey
   */
  async deleteBySessionKey(sessionKey: string): Promise<void> {
    logger.debug(`[AgentCheckpointRepository] deleteBySessionKey, sessionKey=${sessionKey}`);

    await this.db
      .delete(agentCheckpoints)
      .where(
        and(
          eq(agentCheckpoints.userId, this.tenantId),
          eq(agentCheckpoints.sessionKey, sessionKey),
        ),
      );
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 AgentCheckpointRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getAgentCheckpointRepository(
  db: Database,
  userId: string,
): AgentCheckpointRepository {
  return new AgentCheckpointRepository(db, userId);
}
