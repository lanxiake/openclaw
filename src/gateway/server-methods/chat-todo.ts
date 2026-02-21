/**
 * chat.todo.* RPC 方法
 *
 * 提供 Agent Todo 列表的查询和管理接口。
 * 客户端可通过这些 RPC 方法获取历史 Todo 快照。
 *
 * 方法列表：
 * - chat.todo.list: 查询指定会话的 Todo 快照列表
 * - chat.todo.get: 查询指定 runId 的 Todo 快照
 */

import { loadTodosFromDb, loadTodoByRunId } from "../todo-persistence.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// ==================== chat.todo.* Handlers ====================

export const chatTodoHandlers: GatewayRequestHandlers = {
  /**
   * chat.todo.list - 查询会话的 Todo 快照列表
   *
   * 参数:
   *   sessionKey: string - Gateway sessionKey
   *   limit?: number - 返回数量限制（默认 10）
   *
   * 返回:
   *   todos: Array<{ runId, items, completedCount, totalCount, updatedAt }>
   */
  "chat.todo.list": async ({ params, respond }) => {
    const { sessionKey, limit } = params as {
      sessionKey?: string;
      limit?: number;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    const maxLimit = Math.min(typeof limit === "number" ? limit : 10, 50);

    const todos = await loadTodosFromDb(sessionKey, maxLimit);

    if (!todos) {
      respond(true, { sessionKey, todos: [], total: 0 });
      return;
    }

    respond(true, {
      sessionKey,
      todos: todos.map((t) => ({
        id: t.id,
        runId: t.runId,
        items: t.items,
        completedCount: t.completedCount,
        totalCount: t.totalCount,
        updatedAt: t.updatedAt.getTime(),
      })),
      total: todos.length,
    });
  },

  /**
   * chat.todo.get - 查询指定 runId 的 Todo 快照
   *
   * 参数:
   *   sessionKey: string - Gateway sessionKey
   *   runId: string - Agent run ID
   *
   * 返回:
   *   todo: { runId, items, completedCount, totalCount, updatedAt } | null
   */
  "chat.todo.get": async ({ params, respond }) => {
    const { sessionKey, runId } = params as {
      sessionKey?: string;
      runId?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!runId || typeof runId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "runId is required"));
      return;
    }

    const todo = await loadTodoByRunId(sessionKey, runId);

    if (!todo) {
      respond(true, { sessionKey, runId, todo: null });
      return;
    }

    respond(true, {
      sessionKey,
      runId,
      todo: {
        id: todo.id,
        runId: todo.runId,
        items: todo.items,
        completedCount: todo.completedCount,
        totalCount: todo.totalCount,
        updatedAt: todo.updatedAt.getTime(),
      },
    });
  },
};
