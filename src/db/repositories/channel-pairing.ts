/**
 * 频道配对数据访问层
 *
 * 提供频道配对请求和用户绑定的 CRUD 操作。
 * 替代文件存储 ({channel}-pairing.json / {channel}-allowFrom.json)。
 */

import crypto from "node:crypto";

import { eq, and, lt, desc, sql } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  channelPairingRequests,
  userChannelBindings,
  type ChannelPairingRequest,
  type UserChannelBinding,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

// ==================== 常量（与 pairing-store.ts 保持一致）====================

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_PENDING_TTL_MS = 60 * 60 * 1000;
const PAIRING_PENDING_MAX = 3;

// ==================== 工具函数 ====================

/**
 * 生成随机配对码（8 位人类可读字符）
 */
function randomCode(): string {
  let out = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, PAIRING_CODE_ALPHABET.length);
    out += PAIRING_CODE_ALPHABET[idx];
  }
  return out;
}

/**
 * 生成唯一配对码（避免与已有码冲突）
 */
function generateUniqueCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = randomCode();
    if (!existing.has(code)) {
      return code;
    }
  }
  throw new Error("failed to generate unique pairing code");
}

// ==================== ChannelPairingRequestRepository ====================

/**
 * 频道配对请求仓库
 *
 * 管理配对请求的创建、查询、审批和过期清理
 */
export class ChannelPairingRequestRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建或更新配对请求
   *
   * 如果该 channel+senderId 已有 pending 请求，更新 lastSeenAt；
   * 否则创建新请求（不超过 PAIRING_PENDING_MAX 个）。
   *
   * @returns { code, created } 配对码和是否新创建
   */
  async upsertRequest(
    channel: string,
    senderId: string,
    meta?: Record<string, string>,
  ): Promise<{ code: string; created: boolean }> {
    logger.debug("[ChannelPairingRequestRepo] upsertRequest", {
      channel,
      senderId,
    });

    // 先清理过期请求
    await this.pruneExpired();

    // 检查是否已有该 sender 的 pending 请求
    const [existing] = await this.db
      .select()
      .from(channelPairingRequests)
      .where(
        and(
          eq(channelPairingRequests.channel, channel),
          eq(channelPairingRequests.senderId, senderId),
          eq(channelPairingRequests.status, "pending"),
        ),
      );

    if (existing) {
      // 更新 lastSeenAt 和 meta
      logger.debug("[ChannelPairingRequestRepo] 更新已有请求", {
        id: existing.id,
      });

      await this.db
        .update(channelPairingRequests)
        .set({
          lastSeenAt: new Date(),
          ...(meta ? { senderMeta: meta } : {}),
        })
        .where(eq(channelPairingRequests.id, existing.id));

      return { code: existing.code, created: false };
    }

    // 检查 pending 请求数量限制
    const pendingCount = await this.countPending(channel);
    if (pendingCount >= PAIRING_PENDING_MAX) {
      logger.debug("[ChannelPairingRequestRepo] 已达最大 pending 数量限制", {
        channel,
        count: pendingCount,
      });
      return { code: "", created: false };
    }

    // 获取已有配对码集合（避免冲突）
    const existingRows = await this.db
      .select()
      .from(channelPairingRequests)
      .where(eq(channelPairingRequests.status, "pending"));

    const codeSet = new Set(
      existingRows.filter((r) => r.code != null).map((r) => String(r.code).trim().toUpperCase()),
    );
    const code = generateUniqueCode(codeSet);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAIRING_PENDING_TTL_MS);

    // 使用 try-catch+重试 处理 code UNIQUE 约束冲突
    // 避免 check-then-insert 竞态：并发 upsertRequest 可能生成相同 code
    for (let retry = 0; retry < 3; retry++) {
      const candidateCode = retry === 0 ? code : generateUniqueCode(codeSet);
      const id = generateId();
      try {
        await this.db.insert(channelPairingRequests).values({
          id,
          channel,
          senderId,
          senderMeta: meta ?? null,
          code: candidateCode,
          status: "pending",
          createdAt: now,
          expiresAt,
          lastSeenAt: now,
        });

        logger.debug("[ChannelPairingRequestRepo] 创建新配对请求", {
          id,
          code: candidateCode,
          channel,
        });

        return { code: candidateCode, created: true };
      } catch (err) {
        const errMsg = String(err);
        if (errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505")) {
          // 可能是 code 冲突或同 sender 并发插入
          // 先检查是否同 sender 已有 pending 请求（并发插入的情况）
          const [concurrentExisting] = await this.db
            .select()
            .from(channelPairingRequests)
            .where(
              and(
                eq(channelPairingRequests.channel, channel),
                eq(channelPairingRequests.senderId, senderId),
                eq(channelPairingRequests.status, "pending"),
              ),
            );
          if (concurrentExisting) {
            logger.debug("[ChannelPairingRequestRepo] 并发插入检测到已有请求", {
              id: concurrentExisting.id,
            });
            return { code: concurrentExisting.code, created: false };
          }
          // code 冲突，重试生成新 code
          codeSet.add(candidateCode.toUpperCase());
          logger.debug("[ChannelPairingRequestRepo] code 冲突，重试", { retry });
          continue;
        }
        throw err;
      }
    }
    // 所有重试都失败
    throw new Error("failed to insert pairing request after retries");
  }

  /**
   * 根据配对码查找 pending 请求
   */
  async findByCode(code: string): Promise<ChannelPairingRequest | null> {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const [request] = await this.db
      .select()
      .from(channelPairingRequests)
      .where(
        and(
          eq(channelPairingRequests.code, normalizedCode),
          eq(channelPairingRequests.status, "pending"),
        ),
      );

    return request ?? null;
  }

  /**
   * 查询某频道的所有 pending 请求
   */
  async findPending(channel: string): Promise<ChannelPairingRequest[]> {
    logger.debug("[ChannelPairingRequestRepo] findPending", { channel });

    // 先清理过期
    await this.pruneExpired();

    return this.db
      .select()
      .from(channelPairingRequests)
      .where(
        and(
          eq(channelPairingRequests.channel, channel),
          eq(channelPairingRequests.status, "pending"),
        ),
      )
      .orderBy(desc(channelPairingRequests.createdAt));
  }

  /**
   * 审批配对码
   *
   * 将 pending 请求标记为 approved，返回发送者信息。
   *
   * @returns { senderId, senderMeta, channel } 或 null（未找到/已过期）
   */
  async approve(code: string): Promise<{
    senderId: string;
    senderMeta: Record<string, string> | null;
    channel: string;
    createdAt: Date;
    lastSeenAt: Date;
  } | null> {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    logger.debug("[ChannelPairingRequestRepo] approve", {
      code: normalizedCode,
    });

    // 先清理过期
    await this.pruneExpired();

    // 查找并更新
    const [request] = await this.db
      .update(channelPairingRequests)
      .set({
        status: "approved",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(channelPairingRequests.code, normalizedCode),
          eq(channelPairingRequests.status, "pending"),
        ),
      )
      .returning();

    if (!request) {
      logger.debug("[ChannelPairingRequestRepo] 未找到匹配的 pending 请求", {
        code: normalizedCode,
      });
      return null;
    }

    logger.debug("[ChannelPairingRequestRepo] 配对请求已审批", {
      id: request.id,
      senderId: request.senderId,
    });

    return {
      senderId: request.senderId,
      senderMeta: request.senderMeta,
      channel: request.channel,
      createdAt: request.createdAt,
      lastSeenAt: request.lastSeenAt,
    };
  }

  /**
   * 清理过期的 pending 请求
   *
   * @returns 清理的记录数
   */
  async pruneExpired(): Promise<number> {
    const now = new Date();

    const result = await this.db
      .update(channelPairingRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(channelPairingRequests.status, "pending"),
          lt(channelPairingRequests.expiresAt, now),
        ),
      );

    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) {
      logger.debug("[ChannelPairingRequestRepo] 清理过期请求", { count });
    }

    return count;
  }

  /**
   * 统计某频道的 pending 请求数量
   */
  async countPending(channel: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelPairingRequests)
      .where(
        and(
          eq(channelPairingRequests.channel, channel),
          eq(channelPairingRequests.status, "pending"),
        ),
      );

    return result?.count ?? 0;
  }
}

// ==================== ChannelBindingRepository ====================

/**
 * 用户频道绑定仓库
 *
 * 管理频道用户的白名单（allowFrom）绑定关系
 */
export class ChannelBindingRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 获取某频道所有已绑定的发送者 ID 列表
   *
   * 等价于 readChannelAllowFromStore()
   */
  async listAllowedSenders(channel: string): Promise<string[]> {
    logger.debug("[ChannelBindingRepo] listAllowedSenders", { channel });

    const rows = await this.db
      .select()
      .from(userChannelBindings)
      .where(eq(userChannelBindings.channel, channel));

    return rows.filter((r) => r && r.channelUserId != null).map((r) => r.channelUserId);
  }

  /**
   * 添加绑定
   *
   * 如果已存在则不重复添加。
   *
   * @returns { changed, allowFrom } 是否有变化和当前列表
   */
  async addBinding(
    channel: string,
    channelUserId: string,
    displayName?: string,
  ): Promise<{ changed: boolean; allowFrom: string[] }> {
    const normalized = channelUserId.trim();
    if (!normalized) {
      const current = await this.listAllowedSenders(channel);
      return { changed: false, allowFrom: current };
    }

    logger.debug("[ChannelBindingRepo] addBinding", {
      channel,
      channelUserId: normalized,
    });

    // 先检查是否已存在（正常路径）
    const [existing] = await this.db
      .select()
      .from(userChannelBindings)
      .where(
        and(
          eq(userChannelBindings.channel, channel),
          eq(userChannelBindings.channelUserId, normalized),
        ),
      );

    if (existing) {
      const current = await this.listAllowedSenders(channel);
      return { changed: false, allowFrom: current };
    }

    // 创建新绑定（try-catch 处理并发竞态下的唯一索引冲突）
    try {
      const id = generateId();
      await this.db.insert(userChannelBindings).values({
        id,
        channel,
        channelUserId: normalized,
        displayName: displayName ?? null,
        verified: true,
        boundAt: new Date(),
      });
      logger.debug("[ChannelBindingRepo] 绑定已创建", { id, channel });
    } catch (err) {
      // 唯一约束冲突（ucb_channel_user_unique_idx）→ 并发插入，视为 changed: false
      const errMsg = String(err);
      if (errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505")) {
        logger.debug("[ChannelBindingRepo] 绑定已存在（并发唯一约束冲突）", {
          channel,
          channelUserId: normalized,
        });
        const current = await this.listAllowedSenders(channel);
        return { changed: false, allowFrom: current };
      }
      throw err;
    }

    const allowFrom = await this.listAllowedSenders(channel);
    return { changed: true, allowFrom };
  }

  /**
   * 移除绑定
   *
   * @returns { changed, allowFrom } 是否有变化和当前列表
   */
  async removeBinding(
    channel: string,
    channelUserId: string,
  ): Promise<{ changed: boolean; allowFrom: string[] }> {
    const normalized = channelUserId.trim();
    if (!normalized) {
      const current = await this.listAllowedSenders(channel);
      return { changed: false, allowFrom: current };
    }

    logger.debug("[ChannelBindingRepo] removeBinding", {
      channel,
      channelUserId: normalized,
    });

    const deletedRows = await this.db
      .delete(userChannelBindings)
      .where(
        and(
          eq(userChannelBindings.channel, channel),
          eq(userChannelBindings.channelUserId, normalized),
        ),
      )
      .returning();

    const allowFrom = await this.listAllowedSenders(channel);

    return { changed: deletedRows.length > 0, allowFrom };
  }

  /**
   * 检查某频道用户是否在白名单中
   */
  async isAllowed(channel: string, channelUserId: string): Promise<boolean> {
    const [existing] = await this.db
      .select()
      .from(userChannelBindings)
      .where(
        and(
          eq(userChannelBindings.channel, channel),
          eq(userChannelBindings.channelUserId, channelUserId.trim()),
        ),
      );

    return !!existing && existing.id != null;
  }

  /**
   * 根据频道和频道用户 ID 查找绑定
   */
  async findByChannelUser(
    channel: string,
    channelUserId: string,
  ): Promise<UserChannelBinding | null> {
    const [binding] = await this.db
      .select()
      .from(userChannelBindings)
      .where(
        and(
          eq(userChannelBindings.channel, channel),
          eq(userChannelBindings.channelUserId, channelUserId.trim()),
        ),
      );

    return binding ?? null;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 ChannelPairingRequestRepository 实例
 */
export function getChannelPairingRequestRepository(db?: Database): ChannelPairingRequestRepository {
  logger.debug("[ChannelPairingRepo] 创建 ChannelPairingRequestRepository");
  return new ChannelPairingRequestRepository(db ?? getDatabase());
}

/**
 * 创建 ChannelBindingRepository 实例
 */
export function getChannelBindingRepository(db?: Database): ChannelBindingRepository {
  logger.debug("[ChannelPairingRepo] 创建 ChannelBindingRepository");
  return new ChannelBindingRepository(db ?? getDatabase());
}
