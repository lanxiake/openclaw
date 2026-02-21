/**
 * chat.checkpoint.* RPC 方法
 *
 * 提供 Agent 断点的管理和恢复接口。
 * Agent 运行中断时自动保存断点，客户端可通过这些 RPC 方法
 * 查询、加载和恢复断点。
 *
 * 方法列表：
 * - chat.checkpoint.save: 手动保存断点（"存档并停止"）
 * - chat.checkpoint.list: 查询可恢复的断点列表
 * - chat.checkpoint.load: 加载断点详情
 * - chat.checkpoint.delete: 删除指定断点
 * - chat.checkpoint.resume: 从断点恢复执行（标记断点已恢复）
 */

import {
  saveCheckpoint,
  listCheckpoints,
  loadCheckpoint,
  deleteCheckpoint,
  markCheckpointResumed,
} from "../checkpoint-persistence.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// ==================== chat.checkpoint.* Handlers ====================

export const chatCheckpointHandlers: GatewayRequestHandlers = {
  /**
   * chat.checkpoint.save - 手动保存断点
   *
   * 客户端调用"存档并停止"时触发。
   * 通常在 chat.abort 之后调用，传入刚中断的 runId。
   *
   * 参数:
   *   sessionKey: string
   *   runId: string - 被中断的 run ID
   *   abortReason?: "user_interrupt" | "timeout" | "error" - 默认 "user_interrupt"
   *   partialText?: string - 中断时的部分回复文本
   *   todoSnapshot?: Array<{ content: string; status: string }> - Todo 快照
   *   model?: string - 使用的模型
   *
   * 返回:
   *   id: string | null - 断点 ID
   */
  "chat.checkpoint.save": async ({ params, respond }) => {
    const { sessionKey, runId, abortReason, partialText, todoSnapshot, model } = params as {
      sessionKey?: string;
      runId?: string;
      abortReason?: string;
      partialText?: string;
      todoSnapshot?: Array<{ content: string; status: string }>;
      model?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!runId || typeof runId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "runId is required"));
      return;
    }

    /** 验证 abortReason 枚举值 */
    const validReasons = ["user_interrupt", "timeout", "error"] as const;
    const reason = validReasons.includes(abortReason as (typeof validReasons)[number])
      ? (abortReason as (typeof validReasons)[number])
      : "user_interrupt";

    const checkpointId = await saveCheckpoint(sessionKey, runId, reason, {
      conversationSnapshot:
        partialText || todoSnapshot
          ? {
              lastAssistantPartialText: partialText ?? "",
              todoSnapshot: todoSnapshot ?? [],
            }
          : undefined,
      metadata: model ? { model } : undefined,
    });

    if (!checkpointId) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "failed to save checkpoint"));
      return;
    }

    respond(true, { id: checkpointId, sessionKey, runId });
  },

  /**
   * chat.checkpoint.list - 查询可恢复的断点列表
   *
   * 参数:
   *   sessionKey: string
   *   limit?: number - 返回数量限制（默认 10，最大 50）
   *
   * 返回:
   *   checkpoints: Array<{ id, runId, abortReason, createdAt, ... }>
   *   total: number
   */
  "chat.checkpoint.list": async ({ params, respond }) => {
    const { sessionKey, limit } = params as {
      sessionKey?: string;
      limit?: number;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    const maxLimit = Math.min(typeof limit === "number" ? limit : 10, 50);
    const checkpoints = await listCheckpoints(sessionKey, maxLimit);

    if (!checkpoints) {
      respond(true, { sessionKey, checkpoints: [], total: 0 });
      return;
    }

    respond(true, {
      sessionKey,
      checkpoints: checkpoints.map((cp) => ({
        id: cp.id,
        runId: cp.runId,
        abortReason: cp.abortReason,
        conversationSnapshot: cp.conversationSnapshot,
        metadata: cp.metadata,
        createdAt: cp.createdAt.getTime(),
      })),
      total: checkpoints.length,
    });
  },

  /**
   * chat.checkpoint.load - 加载断点详情
   *
   * 用于在恢复前预览断点信息（todo 列表、部分回复等）。
   *
   * 参数:
   *   sessionKey: string
   *   checkpointId: string
   *
   * 返回:
   *   checkpoint: { id, runId, abortReason, agentState, conversationSnapshot, ... } | null
   */
  "chat.checkpoint.load": async ({ params, respond }) => {
    const { sessionKey, checkpointId } = params as {
      sessionKey?: string;
      checkpointId?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!checkpointId || typeof checkpointId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "checkpointId is required"));
      return;
    }

    const checkpoint = await loadCheckpoint(sessionKey, checkpointId);

    if (!checkpoint) {
      respond(true, { sessionKey, checkpointId, checkpoint: null });
      return;
    }

    respond(true, {
      sessionKey,
      checkpointId,
      checkpoint: {
        id: checkpoint.id,
        runId: checkpoint.runId,
        abortReason: checkpoint.abortReason,
        agentState: checkpoint.agentState,
        conversationSnapshot: checkpoint.conversationSnapshot,
        metadata: checkpoint.metadata,
        resumedAt: checkpoint.resumedAt?.getTime() ?? null,
        createdAt: checkpoint.createdAt.getTime(),
      },
    });
  },

  /**
   * chat.checkpoint.delete - 删除指定断点
   *
   * 参数:
   *   sessionKey: string
   *   checkpointId: string
   *
   * 返回:
   *   ok: boolean
   */
  "chat.checkpoint.delete": async ({ params, respond }) => {
    const { sessionKey, checkpointId } = params as {
      sessionKey?: string;
      checkpointId?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!checkpointId || typeof checkpointId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "checkpointId is required"));
      return;
    }

    const ok = await deleteCheckpoint(sessionKey, checkpointId);
    respond(true, { ok, sessionKey, checkpointId });
  },

  /**
   * chat.checkpoint.resume - 从断点恢复（标记断点已使用）
   *
   * 客户端调用此方法标记断点为已恢复。
   * 实际的 Agent 执行恢复通过 chat.send 发送恢复消息实现，
   * 此方法仅负责标记断点状态和返回断点数据。
   *
   * 参数:
   *   sessionKey: string
   *   checkpointId: string
   *
   * 返回:
   *   ok: boolean
   *   checkpoint: { ... } | null - 断点数据（供客户端构建恢复上下文）
   */
  "chat.checkpoint.resume": async ({ params, respond }) => {
    const { sessionKey, checkpointId } = params as {
      sessionKey?: string;
      checkpointId?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!checkpointId || typeof checkpointId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "checkpointId is required"));
      return;
    }

    /** 加载断点数据 */
    const checkpoint = await loadCheckpoint(sessionKey, checkpointId);
    if (!checkpoint) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "checkpoint not found or not accessible"),
      );
      return;
    }

    /** 检查是否已经恢复过 */
    if (checkpoint.resumedAt) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "checkpoint already resumed"),
      );
      return;
    }

    /** 标记已恢复 */
    const ok = await markCheckpointResumed(sessionKey, checkpointId);

    respond(true, {
      ok,
      sessionKey,
      checkpointId,
      checkpoint: ok
        ? {
            id: checkpoint.id,
            runId: checkpoint.runId,
            abortReason: checkpoint.abortReason,
            agentState: checkpoint.agentState,
            conversationSnapshot: checkpoint.conversationSnapshot,
            metadata: checkpoint.metadata,
            createdAt: checkpoint.createdAt.getTime(),
          }
        : null,
    });
  },
};
