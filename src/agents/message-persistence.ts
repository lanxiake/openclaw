/**
 * 消息持久化服务
 *
 * 负责将 Agent 对话消息持久化到数据库，包括：
 * - 用户消息写入
 * - AI 回复写入
 * - 对话创建和更新
 * - Token 使用量记录
 */

import { getDatabase } from "../db/connection.js";
import {
  getConversationRepository,
  getMessageRepository,
} from "../db/repositories/conversations.js";
import { getUsageQuotaRepository } from "../db/repositories/usage-quotas.js";
import type { Conversation, Message, AgentConfig } from "../db/schema/conversations.js";
import { getLogger } from "../logging/logger.js";
import { getUserContext } from "./user-context-store.js";

const logger = getLogger();

// ==================== 类型定义 ====================

/**
 * 持久化用户消息的参数
 */
export interface PersistUserMessageParams {
  /** 对话 ID（可选，不传则创建新对话） */
  conversationId?: string;
  /** 消息内容 */
  content: string;
  /** 附件列表 */
  attachments?: Array<{
    fileId: string;
    name: string;
    type: string;
    url?: string;
  }>;
  /** 设备 ID */
  deviceId?: string;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 持久化 AI 回复的参数
 */
export interface PersistAssistantMessageParams {
  /** 对话 ID */
  conversationId: string;
  /** 回复内容 */
  content: string;
  /** Token 消耗数 */
  tokenCount?: number;
  /** 使用的模型 ID */
  modelId?: string;
  /** 工具调用记录 */
  toolCalls?: Record<string, unknown>[];
  /** 工具执行结果 */
  toolResults?: Record<string, unknown>[];
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 持久化结果
 */
export interface PersistMessageResult {
  /** 是否成功 */
  success: boolean;
  /** 消息 ID */
  messageId?: string;
  /** 对话 ID */
  conversationId?: string;
  /** 错误信息 */
  error?: string;
}

// ==================== 核心函数 ====================

/**
 * 持久化用户消息
 *
 * 如果未提供 conversationId，会自动创建新对话
 *
 * @param params - 持久化参数
 * @returns 持久化结果
 */
export async function persistUserMessage(
  params: PersistUserMessageParams,
): Promise<PersistMessageResult> {
  const userContext = getUserContext();

  // 检查用户上下文
  if (!userContext || userContext.isDefaultUser) {
    logger.debug("[message-persistence] 跳过持久化：默认用户或无用户上下文");
    return { success: true };
  }

  const userId = userContext.userId;

  try {
    const db = getDatabase();
    const conversationRepo = getConversationRepository(db, userId);
    const messageRepo = getMessageRepository(db, userId);

    let conversationId = params.conversationId;

    // 如果没有对话 ID，创建新对话
    if (!conversationId) {
      logger.debug(`[message-persistence] 创建新对话, userId=${userId}`);

      const conversation = await conversationRepo.create({
        title: generateConversationTitle(params.content),
        type: "chat",
        deviceId: params.deviceId,
        agentConfig: buildAgentConfigSnapshot(userContext.assistantConfig),
      });

      conversationId = conversation.id;
      logger.debug(`[message-persistence] 新对话创建成功, conversationId=${conversationId}`);
    }

    // 创建用户消息
    const message = await messageRepo.create({
      conversationId,
      role: "user",
      content: params.content,
      contentType: "text",
      attachments: params.attachments,
      metadata: params.metadata,
    });

    // 更新对话的消息计数和最后消息时间
    await conversationRepo.incrementMessageCount(conversationId);

    logger.debug(
      `[message-persistence] 用户消息持久化成功, messageId=${message.id}, conversationId=${conversationId}`,
    );

    return {
      success: true,
      messageId: message.id,
      conversationId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[message-persistence] 用户消息持久化失败: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 持久化 AI 回复
 *
 * @param params - 持久化参数
 * @returns 持久化结果
 */
export async function persistAssistantMessage(
  params: PersistAssistantMessageParams,
): Promise<PersistMessageResult> {
  const userContext = getUserContext();

  // 检查用户上下文
  if (!userContext || userContext.isDefaultUser) {
    logger.debug("[message-persistence] 跳过持久化：默认用户或无用户上下文");
    return { success: true };
  }

  const userId = userContext.userId;

  try {
    const db = getDatabase();
    const conversationRepo = getConversationRepository(db, userId);
    const messageRepo = getMessageRepository(db, userId);

    // 验证对话存在
    const conversation = await conversationRepo.findById(params.conversationId);
    if (!conversation) {
      logger.warn(
        `[message-persistence] 对话不存在, conversationId=${params.conversationId}, userId=${userId}`,
      );
      return {
        success: false,
        error: "Conversation not found",
      };
    }

    // 创建 AI 回复消息
    const message = await messageRepo.create({
      conversationId: params.conversationId,
      role: "assistant",
      content: params.content,
      contentType: "markdown",
      tokenCount: params.tokenCount,
      modelId: params.modelId,
      toolCalls: params.toolCalls,
      toolResults: params.toolResults,
      metadata: params.metadata,
    });

    // 更新对话的消息计数和最后消息时间
    await conversationRepo.incrementMessageCount(params.conversationId);

    // 扣减 token 配额（如果有 tokenCount）
    if (params.tokenCount && params.tokenCount > 0) {
      try {
        const quotaRepo = getUsageQuotaRepository(db, userId);
        await quotaRepo.incrementUsage("tokens", params.tokenCount);
        logger.debug(
          `[message-persistence] Token 配额扣减成功, userId=${userId}, amount=${params.tokenCount}`,
        );
      } catch (quotaError) {
        // 配额扣减失败不影响消息持久化结果，只记录警告
        logger.warn(
          `[message-persistence] Token 配额扣减失败: ${quotaError instanceof Error ? quotaError.message : String(quotaError)}`,
        );
      }
    }

    logger.debug(
      `[message-persistence] AI 回复持久化成功, messageId=${message.id}, conversationId=${params.conversationId}, tokenCount=${params.tokenCount ?? 0}`,
    );

    return {
      success: true,
      messageId: message.id,
      conversationId: params.conversationId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[message-persistence] AI 回复持久化失败: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 获取对话历史
 *
 * @param conversationId - 对话 ID
 * @param options - 分页选项
 * @returns 消息列表
 */
export async function getConversationHistory(
  conversationId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ messages: Message[]; total: number } | null> {
  const userContext = getUserContext();

  if (!userContext || userContext.isDefaultUser) {
    logger.debug("[message-persistence] 跳过查询：默认用户或无用户上下文");
    return null;
  }

  const userId = userContext.userId;

  try {
    const db = getDatabase();
    const conversationRepo = getConversationRepository(db, userId);
    const messageRepo = getMessageRepository(db, userId);

    // 验证对话存在
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) {
      logger.warn(
        `[message-persistence] 对话不存在, conversationId=${conversationId}, userId=${userId}`,
      );
      return null;
    }

    return await messageRepo.findByConversation(conversationId, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[message-persistence] 获取对话历史失败: ${errorMessage}`);
    return null;
  }
}

/**
 * 获取用户对话列表
 *
 * @param options - 查询选项
 * @returns 对话列表
 */
export async function getUserConversations(options?: {
  limit?: number;
  offset?: number;
  status?: "active" | "archived" | "deleted";
}): Promise<{ conversations: Conversation[]; total: number } | null> {
  const userContext = getUserContext();

  if (!userContext || userContext.isDefaultUser) {
    logger.debug("[message-persistence] 跳过查询：默认用户或无用户上下文");
    return null;
  }

  const userId = userContext.userId;

  try {
    const db = getDatabase();
    const conversationRepo = getConversationRepository(db, userId);

    return await conversationRepo.findAll(options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[message-persistence] 获取对话列表失败: ${errorMessage}`);
    return null;
  }
}

// ==================== 辅助函数 ====================

/**
 * 根据消息内容生成对话标题
 *
 * 取消息前 50 个字符作为标题
 */
function generateConversationTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 50) {
    return trimmed;
  }
  return trimmed.slice(0, 47) + "...";
}

/**
 * 构建 Agent 配置快照
 *
 * 从用户助手配置中提取关键配置信息
 */
function buildAgentConfigSnapshot(
  assistantConfig?: {
    modelConfig?: Record<string, unknown>;
    systemPrompt?: string;
  } | null,
): AgentConfig | undefined {
  if (!assistantConfig) {
    return undefined;
  }

  const config: AgentConfig = {};

  if (assistantConfig.modelConfig) {
    const modelConfig = assistantConfig.modelConfig;
    if (typeof modelConfig.modelId === "string") {
      config.modelId = modelConfig.modelId;
    }
    if (typeof modelConfig.temperature === "number") {
      config.temperature = modelConfig.temperature;
    }
    if (typeof modelConfig.maxTokens === "number") {
      config.maxTokens = modelConfig.maxTokens;
    }
  }

  if (assistantConfig.systemPrompt) {
    config.systemPrompt = assistantConfig.systemPrompt;
  }

  return Object.keys(config).length > 0 ? config : undefined;
}
