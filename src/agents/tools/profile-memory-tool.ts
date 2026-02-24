/**
 * 用户画像记忆工具 — Agent 读写数据库中的用户事实和偏好
 *
 * 提供 4 个操作：
 * - add_fact: 添加用户事实
 * - search_facts: 搜索用户事实
 * - update_fact: 更新用户事实
 * - get_preferences: 获取用户偏好
 *
 * 所有操作通过 AsyncLocalStorage 获取当前用户上下文，
 * 并记录审计日志（fire-and-forget）。
 */

import { Type } from "@sinclair/typebox";
import { getDatabase } from "../../db/connection.js";
import {
  getUserFactRepository,
  getUserPreferencesV2Repository,
} from "../../db/repositories/profile-memory.js";
import { getMemoryAuditRepository } from "../../db/repositories/memory-audit.js";
import { getLogger } from "../../logging/logger.js";
import { stringEnum, optionalStringEnum } from "../schema/typebox.js";
import { getUserContext } from "../user-context-store.js";
import { type AnyAgentTool, jsonResult, readStringParam, readNumberParam } from "./common.js";

const logger = getLogger();

/** 工具支持的操作 */
const PROFILE_MEMORY_ACTIONS = [
  "add_fact",
  "search_facts",
  "update_fact",
  "get_preferences",
] as const;

/** 事实类别选项 */
const FACT_CATEGORIES = [
  "personal",
  "work",
  "hobby",
  "skill",
  "relationship",
  "health",
  "finance",
  "other",
] as const;

/** 事实来源选项 */
const FACT_SOURCES = ["explicit", "inferred"] as const;

/**
 * 工具参数 Schema（扁平化，运行时按 action 验证）
 */
const ProfileMemoryToolSchema = Type.Object({
  action: stringEnum(PROFILE_MEMORY_ACTIONS, {
    description:
      "操作类型: add_fact=添加事实, search_facts=搜索事实, update_fact=更新事实, get_preferences=获取偏好",
  }),
  // add_fact 参数
  category: optionalStringEnum(FACT_CATEGORIES, {
    description: "事实类别（add_fact 必填）",
  }),
  key: Type.Optional(
    Type.String({ description: "事实键名，如 'favorite_color'（add_fact 必填）" }),
  ),
  value: Type.Optional(Type.String({ description: "事实值（add_fact/update_fact 必填）" })),
  confidence: Type.Optional(
    Type.Number({ description: "置信度 0.0-1.0（可选，默认 0.8）", minimum: 0, maximum: 1 }),
  ),
  source: optionalStringEnum(FACT_SOURCES, {
    description: "事实来源: explicit=用户明确告知, inferred=推断（可选，默认 explicit）",
  }),
  // search_facts 参数
  query: Type.Optional(Type.String({ description: "搜索关键词（search_facts 必填）" })),
  // update_fact 参数
  factId: Type.Optional(Type.String({ description: "事实 ID（update_fact 必填）" })),
});

/**
 * 创建用户画像记忆工具
 *
 * 允许 Agent 在对话中读写用户事实和偏好，
 * 通过 AsyncLocalStorage 获取当前用户上下文。
 *
 * @returns Agent 工具定义
 */
export function createProfileMemoryTool(): AnyAgentTool {
  return {
    label: "用户画像记忆",
    name: "profile_memory",
    description: `读写用户的画像记忆（事实和偏好）。支持以下操作：

- add_fact: 记录关于用户的新事实（如喜好、习惯、背景信息）
- search_facts: 搜索已记录的用户事实
- update_fact: 更新已有事实的值或置信度
- get_preferences: 获取用户的交互偏好设置

使用场景：
- 当用户告知个人信息时，使用 add_fact 记录
- 需要回顾用户信息时，使用 search_facts 搜索
- 发现已有信息需要更正时，使用 update_fact 更新
- 需要了解用户交互偏好时，使用 get_preferences`,
    parameters: ProfileMemoryToolSchema,

    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      switch (action) {
        case "add_fact":
          return handleAddFact(params);
        case "search_facts":
          return handleSearchFacts(params);
        case "update_fact":
          return handleUpdateFact(params);
        case "get_preferences":
          return handleGetPreferences();
        default:
          throw new Error(`未知的 action: ${action}`);
      }
    },
  };
}

/**
 * 记录审计日志（fire-and-forget，不阻塞主流程）
 */
function logAudit(params: {
  userId: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): void {
  try {
    const db = getDatabase();
    const auditRepo = getMemoryAuditRepository(db);

    auditRepo
      .log({
        userId: params.userId,
        action: params.action as Parameters<typeof auditRepo.log>[0]["action"],
        source: "agent",
        targetId: params.targetId,
        details: params.details,
      })
      .catch((err) => {
        logger.warn(`[profile-memory-tool] 审计日志写入失败`, err);
      });
  } catch (err) {
    logger.warn(`[profile-memory-tool] 审计日志初始化失败`, err);
  }
}

/**
 * 获取当前用户 ID，无用户上下文时返回错误结果
 */
function requireUserId(): { userId: string } | { error: string } {
  const userContext = getUserContext();

  if (!userContext || !userContext.userId) {
    return { error: "无法获取用户上下文，当前未绑定用户" };
  }

  return { userId: userContext.userId };
}

/**
 * 处理 add_fact 操作：添加用户事实
 */
async function handleAddFact(params: Record<string, unknown>) {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  const category = readStringParam(params, "category");
  if (!category) {
    return jsonResult({ error: "category 是必填参数：请指定事实类别" });
  }

  const key = readStringParam(params, "key");
  if (!key) {
    return jsonResult({ error: "key 是必填参数：请指定事实键名" });
  }

  const value = readStringParam(params, "value");
  if (!value) {
    return jsonResult({ error: "value 是必填参数：请指定事实值" });
  }

  const confidence = readNumberParam(params, "confidence") ?? 0.8;
  const source = readStringParam(params, "source") ?? "explicit";

  logger.debug(
    `[profile-memory-tool] add_fact, userId=${userId}, category=${category}, key=${key}`,
  );

  const db = getDatabase();
  const factRepo = getUserFactRepository(db, userId);

  const fact = await factRepo.create({
    category: category as (typeof FACT_CATEGORIES)[number],
    key,
    value,
    confidence,
    source: source as "explicit" | "inferred",
  });

  logAudit({
    userId,
    action: "add_fact",
    targetId: fact.id,
    details: { category, key, confidence, source },
  });

  return jsonResult({
    ok: true,
    factId: fact.id,
    message: `已记录事实: ${key} = ${value} (类别: ${category}, 置信度: ${confidence})`,
  });
}

/**
 * 处理 search_facts 操作：搜索用户事实
 */
async function handleSearchFacts(params: Record<string, unknown>) {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  const query = readStringParam(params, "query");
  if (!query) {
    return jsonResult({ error: "query 是必填参数：请提供搜索关键词" });
  }

  logger.debug(`[profile-memory-tool] search_facts, userId=${userId}, query="${query}"`);

  const db = getDatabase();
  const factRepo = getUserFactRepository(db, userId);

  const facts = await factRepo.search(query);

  logAudit({
    userId,
    action: "read_facts",
    details: { query, resultCount: facts.length },
  });

  return jsonResult({
    ok: true,
    total: facts.length,
    facts: facts.map((f) => ({
      id: f.id,
      category: f.category,
      key: f.key,
      value: f.value,
      confidence: f.confidence,
      source: f.source,
      updatedAt: f.updatedAt?.toISOString(),
    })),
  });
}

/**
 * 处理 update_fact 操作：更新用户事实
 */
async function handleUpdateFact(params: Record<string, unknown>) {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  const factId = readStringParam(params, "factId");
  if (!factId) {
    return jsonResult({ error: "factId 是必填参数：请提供要更新的事实 ID" });
  }

  const value = readStringParam(params, "value");
  const confidence = readNumberParam(params, "confidence");

  if (!value && confidence === undefined) {
    return jsonResult({ error: "至少需要提供 value 或 confidence 参数" });
  }

  logger.debug(`[profile-memory-tool] update_fact, userId=${userId}, factId=${factId}`);

  const db = getDatabase();
  const factRepo = getUserFactRepository(db, userId);

  const updateData: Record<string, unknown> = {};
  if (value) {
    updateData.value = value;
  }
  if (confidence !== undefined) {
    updateData.confidence = confidence;
  }

  const updated = await factRepo.update(
    factId,
    updateData as { value?: string; confidence?: number },
  );

  if (!updated) {
    return jsonResult({ error: `未找到事实 ID: ${factId}` });
  }

  logAudit({
    userId,
    action: "update_fact",
    targetId: factId,
    details: { value, confidence },
  });

  return jsonResult({
    ok: true,
    factId: updated.id,
    message: `已更新事实: ${updated.key} = ${updated.value} (置信度: ${updated.confidence})`,
  });
}

/**
 * 处理 get_preferences 操作：获取用户偏好
 */
async function handleGetPreferences() {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  logger.debug(`[profile-memory-tool] get_preferences, userId=${userId}`);

  const db = getDatabase();
  const prefsRepo = getUserPreferencesV2Repository(db, userId);

  const prefs = await prefsRepo.get();

  logAudit({
    userId,
    action: "read_preferences",
    details: { found: !!prefs },
  });

  if (!prefs) {
    return jsonResult({
      ok: true,
      message: "用户尚未设置偏好",
      preferences: null,
    });
  }

  return jsonResult({
    ok: true,
    preferences: {
      language: prefs.language,
      timezone: prefs.timezone,
      responseStyle: prefs.responseStyle,
      confirmLevel: prefs.confirmLevel,
      thinkingLevel: prefs.thinkingLevel,
      verboseLevel: prefs.verboseLevel,
      favoriteSkills: prefs.favoriteSkills,
      disabledSkills: prefs.disabledSkills,
      notifications: prefs.notifications,
    },
  });
}
