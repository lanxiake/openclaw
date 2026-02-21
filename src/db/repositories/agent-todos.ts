/**
 * Agent Todo 数据访问层
 *
 * AgentTodoRepository 继承 TenantScopedRepository，
 * 管理 Agent 运行期间的 TodoWrite 快照。
 *
 * 核心策略：同一 (sessionKey, runId) 只保留最新快照（upsert）。
 */

import { eq, and, desc } from "drizzle-orm";

import { type Database } from "../connection.js";
import { agentTodos, type AgentTodo, type NewAgentTodo, type TodoItem } from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== AgentTodoRepository ====================

/**
 * Agent Todo 仓库类
 *
 * 管理 TodoWrite 工具调用产生的任务列表快照
 */
export class AgentTodoRepository extends TenantScopedRepository {
  /**
   * 保存或更新 Todo 快照
   *
   * 如果 (sessionKey, runId) 已存在，更新 items 和计数；
   * 否则创建新记录。
   *
   * @param data - Todo 快照数据
   * @returns 保存后的 AgentTodo 记录
   */
  async upsert(data: {
    sessionKey: string;
    runId: string;
    items: TodoItem[];
    conversationId?: string;
  }): Promise<AgentTodo> {
    const completedCount = data.items.filter((item) => item.status === "completed").length;
    const totalCount = data.items.length;
    const now = new Date();

    logger.debug(
      `[AgentTodoRepository] upsert, sessionKey=${data.sessionKey}, runId=${data.runId}, ` +
        `items=${totalCount}, completed=${completedCount}`,
    );

    /** 查找现有记录 */
    const existing = await this.db
      .select()
      .from(agentTodos)
      .where(
        and(
          eq(agentTodos.userId, this.tenantId),
          eq(agentTodos.sessionKey, data.sessionKey),
          eq(agentTodos.runId, data.runId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      /** 更新现有记录 */
      const [updated] = await this.db
        .update(agentTodos)
        .set({
          items: data.items,
          completedCount,
          totalCount,
          conversationId: data.conversationId ?? existing[0]!.conversationId,
          updatedAt: now,
        })
        .where(eq(agentTodos.id, existing[0]!.id))
        .returning();

      logger.debug(`[AgentTodoRepository] 更新成功, id=${updated!.id}`);
      return updated!;
    }

    /** 创建新记录 */
    const id = generateId();
    const [created] = await this.db
      .insert(agentTodos)
      .values({
        id,
        userId: this.tenantId,
        conversationId: data.conversationId,
        sessionKey: data.sessionKey,
        runId: data.runId,
        items: data.items,
        completedCount,
        totalCount,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[AgentTodoRepository] 创建成功, id=${created!.id}`);
    return created!;
  }

  /**
   * 查找指定 sessionKey + runId 的最新 Todo 快照
   *
   * @param sessionKey - Gateway sessionKey
   * @param runId - Agent run ID
   * @returns 最新快照或 null
   */
  async findBySessionKeyAndRunId(sessionKey: string, runId: string): Promise<AgentTodo | null> {
    const results = await this.db
      .select()
      .from(agentTodos)
      .where(
        and(
          eq(agentTodos.userId, this.tenantId),
          eq(agentTodos.sessionKey, sessionKey),
          eq(agentTodos.runId, runId),
        ),
      )
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * 查找指定 sessionKey 的所有 Todo 快照（按更新时间降序）
   *
   * @param sessionKey - Gateway sessionKey
   * @param limit - 数量限制
   * @returns Todo 快照列表
   */
  async findBySessionKey(sessionKey: string, limit: number = 20): Promise<AgentTodo[]> {
    return this.db
      .select()
      .from(agentTodos)
      .where(and(eq(agentTodos.userId, this.tenantId), eq(agentTodos.sessionKey, sessionKey)))
      .orderBy(desc(agentTodos.updatedAt))
      .limit(limit);
  }

  /**
   * 删除指定 sessionKey + runId 的 Todo 快照
   *
   * @param sessionKey - Gateway sessionKey
   * @param runId - Agent run ID
   */
  async deleteBySessionKeyAndRunId(sessionKey: string, runId: string): Promise<void> {
    logger.debug(`[AgentTodoRepository] 删除, sessionKey=${sessionKey}, runId=${runId}`);

    await this.db
      .delete(agentTodos)
      .where(
        and(
          eq(agentTodos.userId, this.tenantId),
          eq(agentTodos.sessionKey, sessionKey),
          eq(agentTodos.runId, runId),
        ),
      );
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 AgentTodoRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getAgentTodoRepository(db: Database, userId: string): AgentTodoRepository {
  return new AgentTodoRepository(db, userId);
}
