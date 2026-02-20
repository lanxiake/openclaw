/**
 * 记忆捕获 Hook (agent_end)
 *
 * 在 Agent 完成后将对话内容保存到情节记忆系统。
 * 该 hook 以 fire-and-forget 方式运行，不阻塞后续流程。
 *
 * 捕获内容：
 * 1. 对话消息（仅 user/assistant 文本内容）
 * 2. 会话元数据（时长、成功状态）
 *
 * @module hooks/bundled/session-memory/capture
 */

import { randomUUID } from "node:crypto";
import { getGatewayMemoryService } from "../../../gateway/memory-service.js";
import type { Message } from "../../../memory/pluggable/interfaces/types.js";
import type { PluginHookAgentEndEvent, PluginHookAgentContext } from "../../../plugins/types.js";

/** 保存到情节记忆的最大消息条数 */
const MAX_MESSAGES_TO_SAVE = 50;

/** 最少需要的 user+assistant 消息对数（低于此值不保存） */
const MIN_MEANINGFUL_MESSAGES = 2;

/**
 * 从 sessionKey 提取用户标识
 *
 * @param sessionKey - 会话键
 * @returns userId 字符串
 */
function resolveUserId(sessionKey: string | undefined): string | undefined {
  if (!sessionKey || sessionKey.trim().length === 0) {
    return undefined;
  }
  return sessionKey;
}

/**
 * 提取消息中的文本内容
 *
 * 处理两种消息格式：
 * 1. content 为字符串
 * 2. content 为 ContentBlock 数组（仅提取 type=text 的块）
 *
 * @param content - 消息内容（unknown 类型）
 * @returns 提取的文本，无文本时返回 null
 */
function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as Record<string, unknown>).type === "text" &&
        "text" in block &&
        typeof (block as Record<string, unknown>).text === "string"
      ) {
        textParts.push((block as Record<string, unknown>).text as string);
      }
    }
    return textParts.length > 0 ? textParts.join("\n") : null;
  }

  return null;
}

/**
 * 将 Agent 消息列表转换为记忆系统的 Message 格式
 *
 * 仅保留 user 和 assistant 角色的文本消息，
 * 跳过 system、tool 等角色。
 *
 * @param rawMessages - Agent 的原始消息列表
 * @returns 转换后的 Message 列表
 */
function convertMessages(rawMessages: unknown[]): Message[] {
  const messages: Message[] = [];

  for (const raw of rawMessages) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const msg = raw as Record<string, unknown>;
    const role = msg.role;

    // 仅保留 user 和 assistant 消息
    if (role !== "user" && role !== "assistant") {
      continue;
    }

    const text = extractTextContent(msg.content);
    if (!text) {
      continue;
    }

    messages.push({
      id: randomUUID(),
      role: role as "user" | "assistant",
      content: text,
      createdAt: new Date(),
    });
  }

  return messages;
}

/**
 * 创建记忆捕获 hook handler
 *
 * 使用工厂函数模式以便测试时可以注入依赖。
 *
 * @returns agent_end hook handler
 */
export function createCaptureHandler(): (
  event: PluginHookAgentEndEvent,
  ctx: PluginHookAgentContext,
) => Promise<void> {
  return async (event: PluginHookAgentEndEvent, ctx: PluginHookAgentContext): Promise<void> => {
    // 1. 检查前置条件
    const userId = resolveUserId(ctx.sessionKey);
    if (!userId) {
      console.log("[memory-capture] 无 sessionKey，跳过记忆捕获");
      return;
    }

    // 不保存失败的会话
    if (!event.success) {
      console.log("[memory-capture] 会话失败，跳过记忆捕获");
      return;
    }

    // 无消息时跳过
    if (!event.messages || event.messages.length === 0) {
      console.log("[memory-capture] 无消息，跳过记忆捕获");
      return;
    }

    let service: ReturnType<typeof getGatewayMemoryService>;
    try {
      service = getGatewayMemoryService();
    } catch {
      console.log("[memory-capture] 记忆服务未初始化，跳过");
      return;
    }

    if (!service.isReady) {
      console.log("[memory-capture] 记忆服务不可用，跳过");
      return;
    }

    try {
      // 2. 转换消息格式
      const messages = convertMessages(event.messages);

      // 3. 检查消息数量是否足够
      if (messages.length < MIN_MEANINGFUL_MESSAGES) {
        console.log(`[memory-capture] 有效消息不足 (${messages.length})，跳过`);
        return;
      }

      // 4. 截断过长的消息列表（保留最近的消息）
      const truncatedMessages =
        messages.length > MAX_MESSAGES_TO_SAVE ? messages.slice(-MAX_MESSAGES_TO_SAVE) : messages;

      // 5. 生成会话 ID
      const sessionId = `session-${Date.now()}-${randomUUID().slice(0, 8)}`;

      // 6. 保存到情节记忆
      await service.manager.episodic.addConversation(userId, sessionId, truncatedMessages);

      console.log(
        `[memory-capture] 保存对话: ${truncatedMessages.length} 条消息, ` +
          `sessionId=${sessionId}, userId=${userId.slice(0, 30)}...`,
      );
    } catch (error) {
      console.error(
        "[memory-capture] 记忆捕获失败:",
        error instanceof Error ? error.message : String(error),
      );
      // 不抛出异常，agent_end hook 是 fire-and-forget
    }
  };
}
