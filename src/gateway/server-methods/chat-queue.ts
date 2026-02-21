/**
 * chat.queue.* RPC 方法
 *
 * 提供消息队列的服务端管理接口。
 * 客户端在 agent 执行期间，将用户消息入队到 DB，
 * agent 完成后出队逐条发送。
 *
 * 方法列表：
 * - chat.queue.enqueue: 消息入队
 * - chat.queue.dequeue: 消息出队（取头部，标记为 sent）
 * - chat.queue.list: 查看当前队列
 * - chat.queue.remove: 移除指定排队消息
 * - chat.queue.clear: 清空队列
 */

import {
  enqueueMessage,
  dequeueMessage,
  listQueuedMessages,
  removeQueuedMessage,
  clearQueuedMessages,
} from "../queue-persistence.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// ==================== chat.queue.* Handlers ====================

export const chatQueueHandlers: GatewayRequestHandlers = {
  /**
   * chat.queue.enqueue - 消息入队
   *
   * 参数:
   *   sessionKey: string
   *   content: string - 消息文本
   *   attachments?: Array<{ fileId, name, type, url? }>
   *
   * 返回:
   *   id: string - 入队消息的 ID
   */
  "chat.queue.enqueue": async ({ params, respond }) => {
    const { sessionKey, content, attachments } = params as {
      sessionKey?: string;
      content?: string;
      attachments?: Array<{
        fileId: string;
        name: string;
        type: string;
        url?: string;
      }>;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "content is required"));
      return;
    }

    const id = await enqueueMessage(sessionKey, {
      content: content.trim(),
      attachments,
    });

    if (!id) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "failed to enqueue message"));
      return;
    }

    respond(true, { id, sessionKey });
  },

  /**
   * chat.queue.dequeue - 消息出队
   *
   * 参数:
   *   sessionKey: string
   *
   * 返回:
   *   message: { id, content, attachments, queueOrder, createdAt } | null
   */
  "chat.queue.dequeue": async ({ params, respond }) => {
    const { sessionKey } = params as { sessionKey?: string };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    const message = await dequeueMessage(sessionKey);

    respond(true, {
      sessionKey,
      message: message
        ? {
            id: message.id,
            content: message.content,
            attachments: message.attachments,
            queueOrder: message.queueOrder,
            createdAt: message.createdAt.getTime(),
          }
        : null,
    });
  },

  /**
   * chat.queue.list - 查看队列
   *
   * 参数:
   *   sessionKey: string
   *
   * 返回:
   *   messages: Array<{ id, content, attachments, queueOrder, createdAt }>
   *   total: number
   */
  "chat.queue.list": async ({ params, respond }) => {
    const { sessionKey } = params as { sessionKey?: string };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    const messages = await listQueuedMessages(sessionKey);

    if (!messages) {
      respond(true, { sessionKey, messages: [], total: 0 });
      return;
    }

    respond(true, {
      sessionKey,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        attachments: m.attachments,
        queueOrder: m.queueOrder,
        createdAt: m.createdAt.getTime(),
      })),
      total: messages.length,
    });
  },

  /**
   * chat.queue.remove - 移除指定排队消息
   *
   * 参数:
   *   sessionKey: string
   *   messageId: string
   *
   * 返回:
   *   ok: boolean
   */
  "chat.queue.remove": async ({ params, respond }) => {
    const { sessionKey, messageId } = params as {
      sessionKey?: string;
      messageId?: string;
    };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    if (!messageId || typeof messageId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "messageId is required"));
      return;
    }

    const ok = await removeQueuedMessage(sessionKey, messageId);
    respond(true, { ok, sessionKey, messageId });
  },

  /**
   * chat.queue.clear - 清空队列
   *
   * 参数:
   *   sessionKey: string
   *
   * 返回:
   *   ok: boolean
   */
  "chat.queue.clear": async ({ params, respond }) => {
    const { sessionKey } = params as { sessionKey?: string };

    if (!sessionKey || typeof sessionKey !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey is required"));
      return;
    }

    const ok = await clearQueuedMessages(sessionKey);
    respond(true, { ok, sessionKey });
  },
};
