/**
 * 积分系统用户级 RPC 方法
 *
 * 提供用户相关的积分查询操作：
 * - assistant.credits.balance - 查询当前用户积分余额
 * - assistant.credits.history - 查询当前用户积分流水
 * - assistant.credits.calculateCost - 估算模型调用积分消耗
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import { getCreditService } from "../../assistant/credits/index.js";
import type { CreditService } from "../../assistant/credits/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/** 日志标签 */
const LOG_TAG = "assistant-credits";

/** 延迟初始化的 CreditService 实例 */
let _creditService: CreditService | null = null;

/**
 * 获取 CreditService 实例（延迟初始化）
 */
function creditService(): CreditService {
  if (!_creditService) {
    _creditService = getCreditService();
  }
  return _creditService;
}

// ============================================================================
// 参数验证辅助函数
// ============================================================================

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }
  return value.trim();
}

/**
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return value;
}

// ============================================================================
// RPC 方法处理器
// ============================================================================

export const assistantCreditsMethods: GatewayRequestHandlers = {
  /**
   * 查询当前用户积分余额
   *
   * 从 authenticatedUser 中获取 userId，查询积分账户。
   * 无积分账户时返回 null。
   */
  "assistant.credits.balance": async ({ client, respond, context }) => {
    try {
      const userId = (client as { authenticatedUser?: { userId: string } })?.authenticatedUser
        ?.userId;

      if (!userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "User authentication required"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 查询积分余额`, { userId });

      const account = await creditService().getBalance(userId);

      respond(true, {
        success: true,
        data: account
          ? {
              totalBalance: account.totalBalance,
              totalEarned: account.totalEarned,
              totalConsumed: account.totalConsumed,
              totalExpired: account.totalExpired,
              createdAt: account.createdAt.toISOString(),
            }
          : null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 查询积分余额失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 查询当前用户积分流水
   *
   * 支持 limit/offset 分页，默认 50 条，最大 100 条。
   */
  "assistant.credits.history": async ({ params, client, respond, context }) => {
    try {
      const userId = (client as { authenticatedUser?: { userId: string } })?.authenticatedUser
        ?.userId;

      if (!userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "User authentication required"),
        );
        return;
      }

      const limit = Math.min(100, Math.max(1, validateNumberParam(params, "limit") ?? 50));
      const offset = Math.max(0, validateNumberParam(params, "offset") ?? 0);

      context.logGateway.info(`[${LOG_TAG}] 查询积分流水`, { userId, limit, offset });

      const transactions = await creditService().getTransactionHistory(userId, { limit, offset });

      respond(true, {
        success: true,
        data: { transactions },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 查询积分流水失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 估算模型调用积分消耗
   *
   * 根据模型定价和 token 数量计算预估消耗积分。
   */
  "assistant.credits.calculateCost": async ({ params, respond, context }) => {
    try {
      const modelId = validateStringParam(params, "modelId", true)!;
      const inputTokens = validateNumberParam(params, "inputTokens", true)!;
      const outputTokens = validateNumberParam(params, "outputTokens", true)!;

      context.logGateway.info(`[${LOG_TAG}] 计算模型调用成本`, {
        modelId,
        inputTokens,
        outputTokens,
      });

      const cost = await creditService().calculateModelCallCost(modelId, inputTokens, outputTokens);

      respond(true, {
        success: true,
        data: {
          cost,
          modelId,
          inputTokens,
          outputTokens,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 计算模型调用成本失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
