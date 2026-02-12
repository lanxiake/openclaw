/**
 * 对话与消息数据访问层
 *
 * ConversationRepository 和 MessageRepository 继承 TenantScopedRepository，
 * 自动在所有查询中注入 userId 条件实现多租户数据隔离。
 */

import { eq, and, desc, sql } from "drizzle-orm";

import { type Database } from "../connection.js";
import {
  conversations,
  messages,
  type Conversation,
  type NewConversation,
  type Message,
  type NewMessage,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";
import { TenantScopedRepository } from "./tenant-scope.js";

const logger = getLogger();

// ==================== ConversationRepository ====================

/**
 * 对话仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class ConversationRepository extends TenantScopedRepository {
  /**
   * 创建对话
   *
   * userId 由基类自动注入，调用方无需传入
   */
  async create(
    data: Omit<
      NewConversation,
      "id" | "userId" | "createdAt" | "updatedAt" | "messageCount" | "status"
    > & {
      status?: string;
    },
  ): Promise<Conversation> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[ConversationRepository] 创建对话, id=${id}, userId=${this.tenantId}, type=${data.type}`,
    );

    const [conv] = await this.db
      .insert(conversations)
      .values({
        id,
        userId: this.tenantId,
        title: data.title,
        type: data.type,
        status: (data.status as "active" | "archived" | "deleted") ?? "active",
        deviceId: data.deviceId,
        agentConfig: data.agentConfig,
        metadata: data.metadata,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.debug(`[ConversationRepository] 对话创建成功, id=${id}`);
    return conv;
  }

  /**
   * 根据 ID 查找对话（自动过滤 userId）
   */
  async findById(id: string): Promise<Conversation | null> {
    logger.debug(`[ConversationRepository] 查找对话, id=${id}, userId=${this.tenantId}`);

    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, this.tenantId)));

    return conv ?? null;
  }

  /**
   * 查询当前用户的对话列表
   *
   * @param options - 查询选项（分页、状态过滤）
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: "active" | "archived" | "deleted";
  }): Promise<{ conversations: Conversation[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[ConversationRepository] 查询对话列表, userId=${this.tenantId}, limit=${limit}, offset=${offset}`,
    );

    const conditions = [eq(conversations.userId, this.tenantId)];

    if (options?.status) {
      conditions.push(eq(conversations.status, options.status));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(whereClause);

    // 获取数据（按更新时间倒序）
    const result = await this.db
      .select()
      .from(conversations)
      .where(whereClause)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    return {
      conversations: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 更新对话
   */
  async update(
    id: string,
    data: Partial<Pick<Conversation, "title" | "agentConfig" | "metadata">>,
  ): Promise<Conversation | null> {
    logger.debug(`[ConversationRepository] 更新对话, id=${id}, userId=${this.tenantId}`);

    const [conv] = await this.db
      .update(conversations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, this.tenantId)))
      .returning();

    return conv ?? null;
  }

  /**
   * 更新对话状态
   */
  async updateStatus(
    id: string,
    status: "active" | "archived" | "deleted",
  ): Promise<Conversation | null> {
    logger.debug(`[ConversationRepository] 更新对话状态, id=${id}, status=${status}`);

    const [conv] = await this.db
      .update(conversations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, this.tenantId)))
      .returning();

    return conv ?? null;
  }

  /**
   * 软删除对话（设置状态为 deleted）
   */
  async softDelete(id: string): Promise<void> {
    logger.debug(`[ConversationRepository] 软删除对话, id=${id}, userId=${this.tenantId}`);

    await this.db
      .update(conversations)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, this.tenantId)));
  }

  /**
   * 更新消息计数和最后消息时间（内部使用）
   */
  async incrementMessageCount(id: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({
        messageCount: sql`${conversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, this.tenantId)));
  }
}

// ==================== MessageRepository ====================

/**
 * 消息仓库类
 *
 * 继承 TenantScopedRepository，所有操作自动限定在当前用户范围内
 */
export class MessageRepository extends TenantScopedRepository {
  /**
   * 创建消息
   *
   * userId 由基类自动注入
   */
  async create(
    data: Omit<NewMessage, "id" | "userId" | "createdAt"> & {
      contentType?: string;
    },
  ): Promise<Message> {
    const id = generateId();
    const now = new Date();

    logger.debug(
      `[MessageRepository] 创建消息, id=${id}, userId=${this.tenantId}, conversationId=${data.conversationId}, role=${data.role}`,
    );

    const [msg] = await this.db
      .insert(messages)
      .values({
        id,
        conversationId: data.conversationId,
        userId: this.tenantId,
        role: data.role,
        content: data.content,
        contentType: (data.contentType as "text" | "markdown" | "json" | "image") ?? "text",
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
        attachments: data.attachments,
        tokenCount: data.tokenCount,
        modelId: data.modelId,
        metadata: data.metadata,
        createdAt: now,
      })
      .returning();

    logger.debug(`[MessageRepository] 消息创建成功, id=${id}`);
    return msg;
  }

  /**
   * 按对话查询消息（自动过滤 userId）
   *
   * @param conversationId - 对话 ID
   * @param options - 分页选项
   */
  async findByConversation(
    conversationId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ messages: Message[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    logger.debug(
      `[MessageRepository] 查询对话消息, conversationId=${conversationId}, userId=${this.tenantId}`,
    );

    const whereClause = and(
      eq(messages.conversationId, conversationId),
      eq(messages.userId, this.tenantId),
    );

    // 获取总数
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(whereClause);

    // 获取数据（按创建时间正序）
    const result = await this.db
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      messages: result,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * 根据 ID 查找消息（自动过滤 userId）
   */
  async findById(id: string): Promise<Message | null> {
    logger.debug(`[MessageRepository] 查找消息, id=${id}, userId=${this.tenantId}`);

    const [msg] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.userId, this.tenantId)));

    return msg ?? null;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 ConversationRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getConversationRepository(db: Database, userId: string): ConversationRepository {
  return new ConversationRepository(db, userId);
}

/**
 * 创建 MessageRepository 实例
 *
 * @param db - 数据库实例
 * @param userId - 当前用户 ID（租户标识）
 */
export function getMessageRepository(db: Database, userId: string): MessageRepository {
  return new MessageRepository(db, userId);
}
