/**
 * 设备 RPC 方法的认证辅助函数
 *
 * 从 client.authenticatedUser 提取 userId，
 * 未认证时自动回复错误响应。
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayClient, RespondFn } from "./types.js";

/**
 * 从 client 提取已认证用户的 userId
 *
 * 未认证时返回 null 并自动回复 INVALID_REQUEST 错误。
 * 调用方应在返回 null 时 return 终止 handler。
 *
 * @example
 * const userId = requireDeviceAuth(client, respond);
 * if (!userId) return;
 */
export function requireDeviceAuth(client: GatewayClient | null, respond: RespondFn): string | null {
  const userId = client?.authenticatedUser?.userId;
  if (!userId) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "未认证，请先登录"));
    return null;
  }
  return userId;
}
