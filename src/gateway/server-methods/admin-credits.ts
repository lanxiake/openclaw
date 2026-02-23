/**
 * 管理员积分系统 RPC 方法处理器
 *
 * 提供积分系统管理功能：余额查询、流水查询、积分发放、
 * 模型定价管理、过期批次清理和系统概览。
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { getCreditService, type CreditService } from "../../assistant/credits/index.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/** 日志标签 */
const LOG_TAG = "admin-credits";

// 延迟初始化的服务实例
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
      throw new Error(`缺少必需参数: ${key}`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`参数 ${key} 必须为字符串`);
  }

  return value.trim();
}

/**
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  defaultValue?: number,
): number | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "number") {
    throw new Error(`参数 ${key} 必须为数字`);
  }

  return value;
}

/**
 * 管理员积分系统 RPC 方法处理器
 */
export const adminCreditHandlers: GatewayRequestHandlers = {
  /**
   * 查询用户积分余额
   *
   * 参数: { userId: string }
   * 返回: 积分账户信息或 null
   */
  "admin.credits.balance": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 userId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 查询用户积分余额`, { userId });

      const balance = await creditService().getBalance(userId);

      logger.debug(`[${LOG_TAG}] 积分余额查询完成`, {
        userId,
        balance: balance?.totalBalance ?? 0,
      });

      respond(true, { success: true, data: balance }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 查询积分余额失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 查询用户积分流水历史
   *
   * 参数: { userId: string, limit?: number, offset?: number }
   * 返回: 流水记录列表
   */
  "admin.credits.history": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 userId"));
        return;
      }

      const limit = validateNumberParam(params, "limit", 50) || 50;
      const offset = validateNumberParam(params, "offset", 0) || 0;

      context.logGateway.info(`[${LOG_TAG}] 查询积分流水`, { userId, limit, offset });

      const transactions = await creditService().getTransactionHistory(userId, { limit, offset });

      logger.debug(`[${LOG_TAG}] 积分流水查询完成`, {
        userId,
        count: transactions.length,
      });

      respond(
        true,
        {
          success: true,
          data: transactions,
          total: transactions.length,
          hasMore: transactions.length === limit,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 查询积分流水失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 管理员发放积分
   *
   * 参数: { userId: string, amount: number, expiryMonths?: number, description?: string }
   * 返回: 发放结果
   */
  "admin.credits.grant": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);
      const amount = validateNumberParam(params, "amount");
      const expiryMonths = validateNumberParam(params, "expiryMonths", 3) || 3;
      const description = validateStringParam(params, "description");

      if (!userId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 userId"));
        return;
      }

      if (!amount || amount <= 0) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "amount 必须为正数"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 管理员发放积分`, {
        userId,
        amount,
        expiryMonths,
      });

      const result = await creditService().adminGrantCredits(
        userId,
        {
          amount,
          expiryMonths,
          description: description ?? `管理员手动发放 ${amount} 积分`,
        },
        "admin", // TODO: 从 admin 认证上下文获取实际 adminId
      );

      logger.info(`[${LOG_TAG}] 积分发放完成`, {
        userId,
        amount,
        success: result.success,
        newBalance: result.newBalance,
      });

      respond(true, { success: true, data: result }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 发放积分失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取模型定价列表
   *
   * 参数: { activeOnly?: boolean } 默认 true
   * 返回: 模型定价记录列表
   */
  "admin.credits.pricing.list": async ({ params, respond, context }) => {
    try {
      const activeOnly = params["activeOnly"] !== false;

      context.logGateway.info(`[${LOG_TAG}] 获取模型定价列表`, { activeOnly });

      const pricingList = await creditService().getAllModelPricings(activeOnly);

      logger.debug(`[${LOG_TAG}] 模型定价列表查询完成`, {
        count: pricingList.length,
      });

      respond(true, { success: true, data: pricingList }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取模型定价列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取指定模型定价详情
   *
   * 参数: { modelId: string }
   * 返回: 模型定价记录或 null
   */
  "admin.credits.pricing.get": async ({ params, respond, context }) => {
    try {
      const modelId = validateStringParam(params, "modelId", true);

      if (!modelId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 modelId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 获取模型定价详情`, { modelId });

      const pricing = await creditService().getModelPricing(modelId);

      respond(true, { success: true, data: pricing }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取模型定价详情失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 设置模型定价
   *
   * 参数: { modelId: string, modelName: string, inputPrice: number, outputPrice: number, multiplier?: string }
   * 返回: 操作结果
   */
  "admin.credits.pricing.set": async ({ params, respond, context }) => {
    try {
      const modelId = validateStringParam(params, "modelId", true);
      const modelName = validateStringParam(params, "modelName", true);
      const inputPrice = validateNumberParam(params, "inputPrice");
      const outputPrice = validateNumberParam(params, "outputPrice");
      const multiplier = validateStringParam(params, "multiplier");

      if (!modelId || !modelName) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "缺少 modelId 或 modelName"),
        );
        return;
      }

      if (inputPrice === undefined || outputPrice === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "缺少 inputPrice 或 outputPrice"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 设置模型定价`, { modelId, modelName });

      await creditService().setModelPricing({
        modelId,
        modelName,
        inputPrice,
        outputPrice,
        multiplier,
      });

      logger.info(`[${LOG_TAG}] 模型定价设置完成`, { modelId, modelName });

      respond(true, { success: true, message: `模型 ${modelName} 定价已更新` }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 设置模型定价失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 删除模型定价
   *
   * 参数: { modelId: string }
   * 返回: 操作结果
   */
  "admin.credits.pricing.delete": async ({ params, respond, context }) => {
    try {
      const modelId = validateStringParam(params, "modelId", true);

      if (!modelId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "缺少 modelId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 删除模型定价`, { modelId });

      const deleted = await creditService().deleteModelPricing(modelId);

      if (!deleted) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `模型 ${modelId} 定价不存在`),
        );
        return;
      }

      logger.info(`[${LOG_TAG}] 模型定价已删除`, { modelId });

      respond(true, { success: true, message: `模型 ${modelId} 定价已删除` }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 删除模型定价失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 清理过期积分批次
   *
   * 参数: 无
   * 返回: 清理结果（清理的批次数、过期积分数）
   */
  "admin.credits.cleanup": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 开始清理过期积分批次`);

      const result = await creditService().cleanupExpiredBatches();

      logger.info(`[${LOG_TAG}] 过期积分批次清理完成`, {
        batchesCleaned: result.batchesCleaned,
        creditsExpired: result.creditsExpired,
      });

      respond(true, { success: true, data: result }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 清理过期积分批次失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },

  /**
   * 获取积分系统概览
   *
   * 参数: { userId?: string }
   * 返回: 用户的积分概览（余额 + 批次统计），userId 为空时返回系统级统计
   */
  "admin.credits.overview": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId");

      context.logGateway.info(`[${LOG_TAG}] 获取积分系统概览`, { userId });

      if (userId) {
        // 用户级概览：余额 + 流水摘要
        const balance = await creditService().getBalance(userId);
        const recentTransactions = await creditService().getTransactionHistory(userId, {
          limit: 10,
        });

        logger.debug(`[${LOG_TAG}] 用户积分概览查询完成`, {
          userId,
          balance: balance?.totalBalance ?? 0,
        });

        respond(
          true,
          {
            success: true,
            data: {
              userId,
              account: balance,
              recentTransactions,
            },
          },
          undefined,
        );
      } else {
        // 系统级概览：模型定价数
        const pricingList = await creditService().getAllModelPricings(true);

        logger.debug(`[${LOG_TAG}] 系统积分概览查询完成`, {
          activePricingCount: pricingList.length,
        });

        respond(
          true,
          {
            success: true,
            data: {
              activePricingCount: pricingList.length,
              pricingModels: pricingList.map((p) => ({
                modelId: p.modelId,
                modelName: p.modelName,
                inputPrice: p.inputPrice,
                outputPrice: p.outputPrice,
              })),
            },
          },
          undefined,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取积分概览失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage));
    }
  },
};
