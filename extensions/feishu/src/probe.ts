/**
 * Feishu connection probe
 */

import type { ResolvedFeishuAccount } from "./types.js";
import { probeFeishu } from "./api.js";

/**
 * Probe Feishu account connection
 */
export async function probeFeishuAccount(
  account: ResolvedFeishuAccount
): Promise<{ ok: boolean; error?: string }> {
  if (!account.appId || !account.appSecret) {
    return {
      ok: false,
      error: "Missing credentials (appId and appSecret required)",
    };
  }

  return probeFeishu({
    appId: account.appId,
    appSecret: account.appSecret,
    apiBase: account.config.apiBase,
  });
}
