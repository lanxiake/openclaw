/**
 * LLM 响应解析器
 *
 * 解析 LLM 返回的 JSON 响应，支持：
 * - 剥离 markdown 代码围栏
 * - Zod schema 验证
 * - 畸形 JSON 的优雅降级
 *
 * 所有函数都是纯函数，不产生副作用。
 *
 * @module memory/pluggable/llm/response-parsers
 */

import { z } from "zod";

import { createSubsystemLogger } from "../../../logging/subsystem.js";

const logger = createSubsystemLogger("memory/llm/parsers");

// ==================== JSON 提取 ====================

/**
 * 从 LLM 响应中提取 JSON 字符串
 *
 * 处理以下格式：
 * 1. 纯 JSON 字符串
 * 2. 被 markdown 代码围栏包裹的 JSON (```json ... ```)
 * 3. 被普通代码围栏包裹的 JSON (``` ... ```)
 *
 * @param raw - LLM 原始响应文本
 * @returns 提取的 JSON 字符串
 */
export function extractJSON(raw: string): string {
  const trimmed = raw.trim();

  // 尝试剥离 markdown 代码围栏: ```json ... ``` 或 ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  // 已经是纯 JSON
  return trimmed;
}

// ==================== 摘要响应 ====================

/**
 * 摘要响应 schema
 */
export const SummarizationResponseSchema = z.object({
  /** 对话摘要 */
  summary: z.string().min(1),
  /** 关键话题 */
  keyTopics: z.array(z.string()),
  /** 决定/结论 */
  decisions: z.array(z.string()),
});

/** 摘要响应类型 */
export type SummarizationResponse = z.infer<typeof SummarizationResponseSchema>;

/** 空摘要响应（降级默认值） */
const EMPTY_SUMMARIZATION: SummarizationResponse = {
  summary: "",
  keyTopics: [],
  decisions: [],
};

/**
 * 解析摘要 LLM 响应
 *
 * @param raw - LLM 原始响应文本
 * @returns 解析后的摘要响应，解析失败时返回空默认值
 */
export function parseSummarizationResponse(raw: string): SummarizationResponse {
  try {
    const jsonStr = extractJSON(raw);
    const parsed = JSON.parse(jsonStr);
    const result = SummarizationResponseSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    logger.warn("摘要响应 schema 验证失败，尝试部分提取", {
      errors: result.error.issues.map((i) => i.message).join("; "),
    });

    // 尝试部分提取
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyTopics: Array.isArray(parsed.keyTopics)
        ? parsed.keyTopics.filter((t: unknown) => typeof t === "string")
        : [],
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.filter((d: unknown) => typeof d === "string")
        : [],
    };
  } catch (error) {
    logger.warn("摘要响应 JSON 解析失败", {
      error: error instanceof Error ? error.message : String(error),
      rawLength: raw.length,
    });
    return { ...EMPTY_SUMMARIZATION };
  }
}

// ==================== 画像提取响应 ====================

/** 事实类别枚举 */
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

/** 行为模式类型枚举 */
const PATTERN_TYPES = [
  "communication",
  "scheduling",
  "topic_preference",
  "tool_usage",
  "learning",
  "other",
] as const;

/**
 * 画像提取响应 schema
 */
export const ProfileExtractionResponseSchema = z.object({
  /** 新发现的事实 */
  newFacts: z.array(
    z.object({
      content: z.string().min(1),
      category: z.enum(FACT_CATEGORIES),
      key: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  /** 更新的事实 */
  updatedFacts: z.array(
    z.object({
      id: z.string().min(1),
      content: z.string().min(1),
      previousValue: z.string(),
    }),
  ),
  /** 新发现的行为模式 */
  newPatterns: z.array(
    z.object({
      type: z.enum(PATTERN_TYPES),
      pattern: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/** 画像提取响应类型 */
export type ProfileExtractionResponse = z.infer<typeof ProfileExtractionResponseSchema>;

/** 空画像响应（降级默认值） */
const EMPTY_PROFILE_EXTRACTION: ProfileExtractionResponse = {
  newFacts: [],
  updatedFacts: [],
  newPatterns: [],
};

/**
 * 解析画像提取 LLM 响应
 *
 * @param raw - LLM 原始响应文本
 * @returns 解析后的画像提取响应，解析失败时返回空默认值
 */
export function parseProfileExtractionResponse(raw: string): ProfileExtractionResponse {
  try {
    const jsonStr = extractJSON(raw);
    const parsed = JSON.parse(jsonStr);
    const result = ProfileExtractionResponseSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    logger.warn("画像提取响应 schema 验证失败，尝试部分提取", {
      errors: result.error.issues.map((i) => i.message).join("; "),
    });

    // 尝试部分提取：过滤掉不符合 schema 的条目
    return {
      newFacts: extractValidFacts(parsed.newFacts),
      updatedFacts: extractValidUpdatedFacts(parsed.updatedFacts),
      newPatterns: extractValidPatterns(parsed.newPatterns),
    };
  } catch (error) {
    logger.warn("画像提取响应 JSON 解析失败", {
      error: error instanceof Error ? error.message : String(error),
      rawLength: raw.length,
    });
    return { ...EMPTY_PROFILE_EXTRACTION };
  }
}

// ==================== 部分提取辅助函数 ====================

/**
 * 从可能不完整的数据中提取有效的事实
 */
function extractValidFacts(data: unknown): ProfileExtractionResponse["newFacts"] {
  if (!Array.isArray(data)) {
    return [];
  }

  const categorySet = new Set<string>(FACT_CATEGORIES);

  return data
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.content === "string" &&
        obj.content.length > 0 &&
        typeof obj.category === "string" &&
        categorySet.has(obj.category) &&
        typeof obj.key === "string" &&
        obj.key.length > 0 &&
        typeof obj.confidence === "number"
      );
    })
    .map((item) => ({
      content: item.content as string,
      category: item.category as (typeof FACT_CATEGORIES)[number],
      key: item.key as string,
      confidence: Math.max(0, Math.min(1, item.confidence as number)),
    }));
}

/**
 * 从可能不完整的数据中提取有效的更新事实
 */
function extractValidUpdatedFacts(data: unknown): ProfileExtractionResponse["updatedFacts"] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.id === "string" &&
        obj.id.length > 0 &&
        typeof obj.content === "string" &&
        obj.content.length > 0 &&
        typeof obj.previousValue === "string"
      );
    })
    .map((item) => ({
      id: item.id as string,
      content: item.content as string,
      previousValue: item.previousValue as string,
    }));
}

/**
 * 从可能不完整的数据中提取有效的行为模式
 */
function extractValidPatterns(data: unknown): ProfileExtractionResponse["newPatterns"] {
  if (!Array.isArray(data)) {
    return [];
  }

  const typeSet = new Set<string>(PATTERN_TYPES);

  return data
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.type === "string" &&
        typeSet.has(obj.type) &&
        typeof obj.pattern === "string" &&
        obj.pattern.length > 0 &&
        typeof obj.confidence === "number"
      );
    })
    .map((item) => ({
      type: item.type as (typeof PATTERN_TYPES)[number],
      pattern: item.pattern as string,
      confidence: Math.max(0, Math.min(1, item.confidence as number)),
    }));
}
