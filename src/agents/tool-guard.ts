/**
 * 工具调用权限校验
 *
 * 在多租户环境下，校验用户是否有权限执行特定工具操作
 * 主要用于设备操作类工具（exec、process、file_read、file_write 等）
 */

import { getLogger } from "../logging/logger.js";
import { type UserAgentContext, hasDevicePermission, hasQuotaAvailable } from "./user-context.js";
import { getUserContext } from "./user-context-store.js";
import type { AnyAgentTool } from "./pi-tools.types.js";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";

const logger = getLogger();

/**
 * 需要设备权限校验的工具列表
 */
const DEVICE_PERMISSION_TOOLS = new Set([
  "exec",
  "process",
  "file_read",
  "file_write",
  "file_delete",
  "shell",
  "terminal",
  "browser",
  "screenshot",
]);

/**
 * 需要配额校验的工具列表
 */
const QUOTA_TOOLS = new Set(["web_search", "image_generation", "code_execution"]);

/**
 * 工具权限校验结果
 */
export interface ToolPermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 校验工具调用权限
 *
 * @param toolName - 工具名称
 * @param toolArgs - 工具参数
 * @param userContext - 用户上下文
 * @returns 权限校验结果
 */
export function checkToolPermission(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userContext: UserAgentContext | undefined,
): ToolPermissionResult {
  // 无用户上下文时允许所有操作（向后兼容单用户模式）
  if (!userContext) {
    return { allowed: true };
  }

  // 默认用户允许所有操作（向后兼容）
  if (userContext.isDefaultUser) {
    return { allowed: true };
  }

  const normalizedToolName = toolName.toLowerCase();

  // 设备权限校验
  if (DEVICE_PERMISSION_TOOLS.has(normalizedToolName)) {
    const deviceId = extractDeviceId(toolArgs);
    if (deviceId && !hasDevicePermission(userContext, deviceId)) {
      logger.warn(
        `[tool-guard] 设备权限拒绝, userId=${userContext.userId}, tool=${toolName}, deviceId=${deviceId}`,
      );
      return {
        allowed: false,
        reason: `Permission denied: device ${deviceId} does not belong to user`,
      };
    }
  }

  // 配额校验
  if (QUOTA_TOOLS.has(normalizedToolName)) {
    const quotaType = getQuotaTypeForTool(normalizedToolName);
    if (quotaType && !hasQuotaAvailable(userContext, quotaType, 1)) {
      logger.warn(
        `[tool-guard] 配额不足, userId=${userContext.userId}, tool=${toolName}, quotaType=${quotaType}`,
      );
      return {
        allowed: false,
        reason: `Quota exceeded: ${quotaType} quota exhausted`,
      };
    }
  }

  return { allowed: true };
}

/**
 * 从工具参数中提取设备 ID
 */
function extractDeviceId(toolArgs: Record<string, unknown>): string | undefined {
  // 常见的设备 ID 参数名
  const deviceIdKeys = ["deviceId", "device_id", "device", "targetDevice"];

  for (const key of deviceIdKeys) {
    const value = toolArgs[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

/**
 * 获取工具对应的配额类型
 */
function getQuotaTypeForTool(toolName: string): string | undefined {
  const toolQuotaMap: Record<string, string> = {
    web_search: "web_search",
    image_generation: "image_generation",
    code_execution: "code_execution",
  };

  return toolQuotaMap[toolName];
}

/**
 * 创建工具权限守卫
 *
 * 返回一个函数，可在工具调用前进行权限检查
 */
export function createToolGuard(userContext: UserAgentContext | undefined) {
  return (toolName: string, toolArgs: Record<string, unknown>): ToolPermissionResult => {
    return checkToolPermission(toolName, toolArgs, userContext);
  };
}

/**
 * 从 AsyncLocalStorage 获取用户上下文并检查权限
 *
 * 用于在工具执行时自动获取当前用户上下文
 */
export function checkToolPermissionFromContext(
  toolName: string,
  toolArgs: Record<string, unknown>,
): ToolPermissionResult {
  const userContext = getUserContext();
  return checkToolPermission(toolName, toolArgs, userContext);
}

/**
 * 包装工具以添加用户权限检查
 *
 * 在工具执行前检查用户权限，如果权限不足则返回错误
 *
 * @param tool - 原始工具
 * @returns 包装后的工具
 */
export function wrapToolWithUserContextGuard(tool: AnyAgentTool): AnyAgentTool {
  const originalExecute = tool.execute;

  return {
    ...tool,
    execute: async (
      toolCallId: string,
      args: unknown,
      signal?: AbortSignal,
      onUpdate?: (partialResult: AgentToolResult<unknown>) => void,
    ) => {
      const toolArgs = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
      const permissionResult = checkToolPermissionFromContext(tool.name, toolArgs);

      if (!permissionResult.allowed) {
        logger.warn(
          `[tool-guard] 工具执行被拒绝, tool=${tool.name}, reason=${permissionResult.reason}`,
        );
        // 返回符合 AgentToolResult 类型的错误结果
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${permissionResult.reason ?? "Permission denied"}`,
            },
          ],
          details: {
            error: true,
            reason: permissionResult.reason ?? "Permission denied",
          },
        };
      }

      return originalExecute.call(tool, toolCallId, args, signal, onUpdate);
    },
  };
}
