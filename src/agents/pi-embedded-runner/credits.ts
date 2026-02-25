/**
 * LLM 调用积分扣减辅助函数
 *
 * 提供前置余额检查和后置积分扣减两个函数，供 run.ts 集成。
 */

import { getLogger } from "../../logging/logger.js";
import { getCreditService } from "../../assistant/credits/credit-service.js";

const log = getLogger();

/**
 * 前置余额检查 — 检查用户是否有积分可用
 *
 * @returns true 表示可继续调用，false 表示应阻断
 */
export async function checkCreditsBalance(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return true; // 无 userId 的调用不检查（系统调用）
  }

  try {
    const creditService = getCreditService();
    const account = await creditService.getBalance(userId);

    if (!account) {
      // 没有积分账户 → 不阻断（可能是老用户还未迁移积分系统）
      return true;
    }

    if (account.totalBalance <= 0) {
      log.info("[CREDITS] user has no credits, blocking LLM call", {
        userId,
        balance: account.totalBalance,
      });
      return false;
    }

    return true;
  } catch (err) {
    // 积分系统故障不应阻断正常调用
    log.debug(`[CREDITS] balance check failed, allowing call: ${err}`);
    return true;
  }
}

/**
 * 后置积分扣减 — LLM 调用成功后按实际 token 用量扣减
 *
 * @returns 扣减的积分数（未配置定价、无 token 信息、余额不足时返回 0）
 */
export async function deductCreditsForLlmCall(params: {
  userId: string | null | undefined;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}): Promise<number> {
  const { userId, provider, model, inputTokens, outputTokens } = params;

  if (!userId) {
    return 0;
  }

  if (!inputTokens && !outputTokens) {
    return 0;
  }

  const modelId = `${provider}/${model}`;

  try {
    const creditService = getCreditService();

    // 计算调用成本
    const cost = await creditService.calculateModelCallCost(
      modelId,
      inputTokens ?? 0,
      outputTokens ?? 0,
    );

    // 扣减积分（余额不足时 consumeCredits 返回 success: false）
    const result = await creditService.consumeCredits(userId, cost, {
      source: "model_call",
      description: `模型调用 ${modelId}`,
      metadata: {
        modelId,
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
      },
    });

    if (!result.success) {
      log.info("[CREDITS] deduction failed (insufficient balance), call not blocked", {
        userId,
        modelId,
        cost,
        reason: result.reason,
      });
      return 0;
    }

    log.info("[CREDITS] deducted credits for LLM call", {
      userId,
      modelId,
      cost,
      newBalance: result.newBalance,
    });

    return cost;
  } catch (err) {
    // 模型未配置定价 or 其他错误 → 不阻断，仅记录
    log.debug(`[CREDITS] deduction error for ${modelId}: ${err}`);
    return 0;
  }
}
