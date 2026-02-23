/**
 * 管理后台 LLM 调用日志 RPC 方法
 *
 * 提供 LLM 调用日志查询和统计相关的 API：
 * - admin.llm.logs        - 查询 LLM 调用日志（分页）
 * - admin.llm.stats       - 获取聚合统计
 * - admin.llm.models      - 获取模型使用分布
 * - admin.llm.performance - 获取性能指标
 */

import { getLlmCallLogRepository } from "../../db/repositories/llm-call-logs.js";
import type { LlmCallStatus } from "../../db/schema/llm-call-logs.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";

/**
 * 辅助函数：从 params 提取字符串参数
 */
function validateStringParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/**
 * 辅助函数：从 params 提取数字参数
 */
function validateNumberParam(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * 辅助函数：从 params 提取日期参数
 */
function validateDateParam(params: Record<string, unknown>, key: string): Date | undefined {
  const value = params[key];
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

/**
 * 查询 LLM 调用日志（分页）
 */
const getLlmLogs: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-llm-logs] 查询 LLM 调用日志");

  try {
    const repo = getLlmCallLogRepository();
    const result = await repo.query({
      userId: validateStringParam(params, "userId"),
      provider: validateStringParam(params, "provider"),
      model: validateStringParam(params, "model"),
      status: validateStringParam(params, "status") as LlmCallStatus | undefined,
      channel: validateStringParam(params, "channel"),
      startTime: validateDateParam(params, "startTime"),
      endTime: validateDateParam(params, "endTime"),
      limit: validateNumberParam(params, "limit") ?? 50,
      offset: validateNumberParam(params, "offset") ?? 0,
    });

    respond(true, {
      success: true,
      data: {
        logs: result.logs,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("[admin-llm-logs] 查询 LLM 调用日志失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "查询 LLM 调用日志失败",
    });
  }
};

/**
 * 获取 LLM 调用聚合统计
 */
const getLlmStats: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-llm-logs] 获取 LLM 调用统计");

  try {
    const repo = getLlmCallLogRepository();
    const stats = await repo.getStats({
      startTime: validateDateParam(params, "startTime"),
      endTime: validateDateParam(params, "endTime"),
    });

    respond(true, {
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[admin-llm-logs] 获取 LLM 调用统计失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取 LLM 调用统计失败",
    });
  }
};

/**
 * 获取模型使用分布
 */
const getLlmModels: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-llm-logs] 获取模型使用分布");

  try {
    const repo = getLlmCallLogRepository();
    const stats = await repo.getStats({
      startTime: validateDateParam(params, "startTime"),
      endTime: validateDateParam(params, "endTime"),
    });

    respond(true, {
      success: true,
      data: {
        byModel: stats.byModel,
        byProvider: stats.byProvider,
        totalCalls: stats.totalCalls,
      },
    });
  } catch (error) {
    console.error("[admin-llm-logs] 获取模型使用分布失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取模型使用分布失败",
    });
  }
};

/**
 * 获取 LLM 性能指标
 */
const getLlmPerformance: GatewayRequestHandler = async ({ params, respond }) => {
  console.log("[admin-llm-logs] 获取 LLM 性能指标");

  try {
    const repo = getLlmCallLogRepository();
    const stats = await repo.getStats({
      startTime: validateDateParam(params, "startTime"),
      endTime: validateDateParam(params, "endTime"),
    });

    respond(true, {
      success: true,
      data: {
        totalCalls: stats.totalCalls,
        successCalls: stats.successCalls,
        errorCalls: stats.errorCalls,
        errorRate:
          stats.totalCalls > 0
            ? Math.round((stats.errorCalls / stats.totalCalls) * 10000) / 100
            : 0,
        avgDurationMs: stats.avgDurationMs,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
      },
    });
  } catch (error) {
    console.error("[admin-llm-logs] 获取 LLM 性能指标失败:", error);
    respond(true, {
      success: false,
      error: error instanceof Error ? error.message : "获取 LLM 性能指标失败",
    });
  }
};

/**
 * 导出 LLM 日志处理器
 */
export const adminLlmLogHandlers: GatewayRequestHandlers = {
  "admin.llm.logs": getLlmLogs,
  "admin.llm.stats": getLlmStats,
  "admin.llm.models": getLlmModels,
  "admin.llm.performance": getLlmPerformance,
};
