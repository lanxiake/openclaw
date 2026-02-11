import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import type { ModelCatalogEntry } from "../../agent/models/model-catalog.js";

/**
 * 套餐可用模型映射
 *
 * 定义不同订阅套餐可以访问的模型列表
 * null 表示可以访问所有模型
 */
const PLAN_MODEL_ACCESS: Record<string, string[] | null> = {
  // 免费版：仅基础模型
  free: ["gpt-4o-mini", "gpt-3.5-turbo", "claude-3-haiku", "gemini-1.5-flash"],
  // 专业版：主流模型
  pro: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "claude-3-5-sonnet",
    "claude-3-haiku",
    "claude-3-opus",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  // 企业版：所有模型
  enterprise: null,
};

/**
 * 根据用户套餐过滤可用模型
 *
 * @param models 完整模型列表
 * @param planCode 用户套餐代码
 * @returns 过滤后的模型列表
 */
function filterModelsByPlan(
  models: ModelCatalogEntry[],
  planCode: string | undefined,
): ModelCatalogEntry[] {
  // 未指定套餐或未知套餐，返回免费版模型
  const effectivePlan = planCode && PLAN_MODEL_ACCESS[planCode] !== undefined ? planCode : "free";

  const allowedModels = PLAN_MODEL_ACCESS[effectivePlan];

  // null 表示可以访问所有模型
  if (allowedModels === null) {
    return models;
  }

  // 过滤模型列表
  return models.filter((model) => {
    // 检查模型 ID 是否在允许列表中
    // 支持前缀匹配，如 "gpt-4o" 匹配 "gpt-4o-2024-05-13"
    return allowedModels.some((allowed) => model.id.startsWith(allowed) || model.id === allowed);
  });
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context, client }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      let models = await context.loadGatewayModelCatalog();

      // 如果客户端已认证，根据套餐过滤模型
      if (client?.authenticatedUser) {
        const planCode = client.authenticatedUser.subscriptionPlanCode;
        models = filterModelsByPlan(models, planCode);

        // 添加日志
        context.logGateway.debug("models.list filtered by plan", {
          userId: client.authenticatedUser.userId,
          planCode,
          totalModels: (await context.loadGatewayModelCatalog()).length,
          filteredModels: models.length,
        });
      }

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
