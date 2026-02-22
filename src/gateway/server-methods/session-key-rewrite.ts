import type { GatewayClient } from "./types.js";
import { rewriteSessionKeyForUser } from "../../routing/session-key.js";

/**
 * 从 RPC 请求中解析有效的会话键
 *
 * 如果客户端已认证，自动在会话键中注入 user:{userId}: 前缀。
 * 未认证客户端的会话键原样返回（向后兼容）。
 *
 * @param params.sessionKey - 客户端发送的原始会话键
 * @param params.client - 网关客户端信息（可能为 null）
 * @returns 改写结果，ok=true 时包含有效的 sessionKey，ok=false 时包含拒绝原因
 */
export function resolveEffectiveSessionKey(params: {
  sessionKey: string;
  client: GatewayClient | null;
}): { ok: true; sessionKey: string } | { ok: false; reason: string } {
  const userId = params.client?.authenticatedUser?.userId;
  return rewriteSessionKeyForUser({
    sessionKey: params.sessionKey,
    userId,
  });
}
