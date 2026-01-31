import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";
import type { ResolvedWeChatAccount, WeChatConfig } from "./types.js";

/**
 * Get WeChat channel configuration from config.
 */
export function getWeChatConfig(cfg: OpenClawConfig): WeChatConfig | undefined {
  return (cfg.channels as Record<string, unknown> | undefined)?.wechat as WeChatConfig | undefined;
}

/**
 * List all configured WeChat account IDs.
 */
export function listWeChatAccountIds(cfg: OpenClawConfig): string[] {
  const wechat = getWeChatConfig(cfg);
  if (!wechat) return [];

  const accounts = (wechat as Record<string, unknown>).accounts as
    | Record<string, unknown>
    | undefined;
  if (accounts && typeof accounts === "object") {
    const ids = Object.keys(accounts).filter((id) => {
      const entry = accounts[id];
      return entry && typeof entry === "object";
    });
    // Include default if base config has bridgeUrl or enabled
    if (wechat.bridgeUrl || process.env.WECHAT_BRIDGE_URL || wechat.enabled) {
      return [DEFAULT_ACCOUNT_ID, ...ids.filter((id) => id !== DEFAULT_ACCOUNT_ID)];
    }
    return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
  }

  // Single account mode - always return default if wechat section exists
  return [DEFAULT_ACCOUNT_ID];
}

/**
 * Resolve the default WeChat account ID.
 */
export function resolveDefaultWeChatAccountId(cfg: OpenClawConfig): string {
  const ids = listWeChatAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * Resolve a WeChat account by ID.
 */
export function resolveWeChatAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string;
}): ResolvedWeChatAccount {
  const { cfg, accountId: rawAccountId } = params;
  const accountId = normalizeAccountId(rawAccountId ?? DEFAULT_ACCOUNT_ID);
  const wechat = getWeChatConfig(cfg);

  // Check for account-specific config
  const accounts = (wechat as Record<string, unknown> | undefined)?.accounts as
    | Record<string, WeChatConfig>
    | undefined;
  const accountConfig =
    accountId !== DEFAULT_ACCOUNT_ID ? accounts?.[accountId] : undefined;

  // Merge base config with account-specific config
  const mergedConfig: WeChatConfig = {
    ...wechat,
    ...accountConfig,
  };

  // Resolve bridge URL
  let bridgeUrl = "";
  let bridgeUrlSource: "config" | "env" | "none" = "none";

  if (accountConfig?.bridgeUrl) {
    bridgeUrl = accountConfig.bridgeUrl;
    bridgeUrlSource = "config";
  } else if (accountId === DEFAULT_ACCOUNT_ID && wechat?.bridgeUrl) {
    bridgeUrl = wechat.bridgeUrl;
    bridgeUrlSource = "config";
  } else if (accountId === DEFAULT_ACCOUNT_ID && process.env.WECHAT_BRIDGE_URL) {
    bridgeUrl = process.env.WECHAT_BRIDGE_URL;
    bridgeUrlSource = "env";
  }

  // Resolve enabled state
  const enabled =
    accountConfig?.enabled ?? wechat?.enabled ?? bridgeUrlSource !== "none";

  // Resolve name
  const name = accountConfig?.name ?? wechat?.name ?? accountId;

  return {
    accountId,
    name,
    enabled,
    bridgeUrl,
    bridgeUrlSource,
    config: mergedConfig,
  };
}

/**
 * Check if a WeChat account is configured.
 */
export function isWeChatAccountConfigured(account: ResolvedWeChatAccount): boolean {
  return Boolean(account.bridgeUrl?.trim());
}
