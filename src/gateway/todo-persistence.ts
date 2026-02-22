/**
 * todo-persistence - Agent Todo DB 持久化模块
 *
 * 将 Agent 运行期间的 TodoWrite 工具调用快照写入 PostgreSQL。
 * 与 chat-persistence 类似，DB 不可用时优雅降级（仅靠客户端实时事件流）。
 *
 * 核心职责：
 * - 拦截 tool 事件中的 TodoWrite 调用，持久化到 agent_todos 表
 * - 提供 RPC 查询接口：按 sessionKey 获取最新 todo 列表
 * - 同一 (sessionKey, runId) 只保留最新快照（upsert）
 *
 * 多租户隔离通过 TenantScopedRepository 自动保证。
 */

import { type Database, getDatabase } from "../db/connection.js";
import { getAgentTodoRepository } from "../db/repositories/agent-todos.js";
import type { TodoItem, AgentTodo } from "../db/schema/agent-todos.js";
import { extractUserIdFromSessionKey } from "../routing/session-key.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/**
 * 安全获取数据库实例
 *
 * DATABASE_URL 未配置时返回 null，不抛出异常。
 */
function tryGetDatabase(): Database | null {
  try {
    return getDatabase();
  } catch {
    logger.debug("[todo-persistence] 数据库不可用，跳过持久化");
    return null;
  }
}

/**
 * 从 tool 事件的 args 中解析 TodoItem 列表
 *
 * TodoWrite 工具的参数格式：{ todos: TodoItem[] }
 *
 * @param args - 工具调用参数
 * @returns 解析后的 TodoItem 列表，解析失败返回 null
 */
export function parseTodoItemsFromArgs(args: unknown): TodoItem[] | null {
  if (!args || typeof args !== "object") return null;

  const argsObj = args as Record<string, unknown>;
  const todos = argsObj.todos;

  if (!Array.isArray(todos)) return null;

  const parsed = todos
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      content: typeof item.content === "string" ? item.content : "",
      activeForm: typeof item.activeForm === "string" ? item.activeForm : undefined,
      status: (["pending", "in_progress", "completed"].includes(item.status as string)
        ? item.status
        : "pending") as TodoItem["status"],
    }))
    .filter((item) => item.content.length > 0);

  return parsed.length > 0 ? parsed : null;
}

/**
 * 持久化 Todo 快照到 DB
 *
 * 在 server-chat.ts 中拦截 TodoWrite 工具事件后调用。
 * 失败时仅记录日志，不影响事件广播。
 *
 * @param sessionKey - Gateway sessionKey
 * @param runId - Agent run ID
 * @param items - Todo 项列表
 */
export async function persistTodoSnapshot(
  sessionKey: string,
  runId: string,
  items: TodoItem[],
): Promise<void> {
  const userId = extractUserIdFromSessionKey(sessionKey);

  if (!userId) {
    logger.debug("[todo-persistence] 无用户 ID，跳过持久化");
    return;
  }

  const db = tryGetDatabase();
  if (!db) return;

  try {
    const repo = getAgentTodoRepository(db, userId);
    await repo.upsert({
      sessionKey,
      runId,
      items,
    });

    logger.debug(
      `[todo-persistence] Todo 快照已持久化, sessionKey=${sessionKey}, runId=${runId}, ` +
        `items=${items.length}, completed=${items.filter((i) => i.status === "completed").length}`,
    );
  } catch (error) {
    logger.error("[todo-persistence] persistTodoSnapshot 失败:", error);
  }
}

/**
 * 从 DB 加载指定 sessionKey 的最新 Todo 列表
 *
 * 用于 chat.todo.list RPC 方法。
 *
 * @param sessionKey - Gateway sessionKey
 * @param limit - 返回的快照数量限制
 * @returns Todo 快照列表，DB 不可用时返回 null
 */
export async function loadTodosFromDb(
  sessionKey: string,
  limit: number = 10,
): Promise<AgentTodo[] | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);

  if (!userId) {
    return null;
  }

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const repo = getAgentTodoRepository(db, userId);
    const todos = await repo.findBySessionKey(sessionKey, limit);

    logger.debug(`[todo-persistence] 加载 ${todos.length} 个 Todo 快照, sessionKey=${sessionKey}`);

    return todos;
  } catch (error) {
    logger.error("[todo-persistence] loadTodosFromDb 失败:", error);
    return null;
  }
}

/**
 * 从 DB 加载指定 sessionKey + runId 的 Todo 快照
 *
 * 用于查询特定运行的 todo 状态。
 *
 * @param sessionKey - Gateway sessionKey
 * @param runId - Agent run ID
 * @returns Todo 快照或 null
 */
export async function loadTodoByRunId(
  sessionKey: string,
  runId: string,
): Promise<AgentTodo | null> {
  const userId = extractUserIdFromSessionKey(sessionKey);

  if (!userId) {
    return null;
  }

  const db = tryGetDatabase();
  if (!db) return null;

  try {
    const repo = getAgentTodoRepository(db, userId);
    return repo.findBySessionKeyAndRunId(sessionKey, runId);
  } catch (error) {
    logger.error("[todo-persistence] loadTodoByRunId 失败:", error);
    return null;
  }
}
