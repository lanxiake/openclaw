import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";
import type { ResolvedWeChatAccount, WeChatConfig } from "./types.js";

// Cache for generated auth tokens to ensure consistency within a session
const generatedTokenCache = new Map<string, string>();

/**
 * Generate a random auth token.
 */
function generateAuthToken(): string {
  // Use crypto.randomUUID for simplicity (available in Node 16+)
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Get or generate a consistent auth token for an account.
 * If no token is configured, generates one and caches it for the session.
 */
function resolveAuthToken(params: {
  accountId: string;
  accountConfig?: WeChatConfig;
  baseConfig?: WeChatConfig;
}): string {
  const { accountId, accountConfig, baseConfig } = params;

  // Priority: account config > base config > env var > cached generated
  const configuredToken =
    accountConfig?.authToken ?? baseConfig?.authToken ?? process.env.WECHAT_AUTH_TOKEN;

  if (configuredToken) {
    return configuredToken;
  }

  // Generate and cache a token for this account
  const cacheKey = `wechat:${accountId}`;
  let cachedToken = generatedTokenCache.get(cacheKey);
  if (!cachedToken) {
    cachedToken = generateAuthToken();
    generatedTokenCache.set(cacheKey, cachedToken);
    // Log the generated token so users can configure their bridge
    console.info(
      `[wechat:${accountId}] Generated auth token: ${cachedToken}\n` +
        `  Configure your bridge with: --token ${cachedToken}\n` +
        `  Or set WECHAT_AUTH_TOKEN environment variable\n` +
        `  Or add to config: channels.wechat.authToken: "${cachedToken}"`,
    );
  }
  return cachedToken;
}

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
  // Always try to get account-specific config, including for "default"
  const accountConfig = accounts?.[accountId];

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
  const enabled = accountConfig?.enabled ?? wechat?.enabled ?? bridgeUrlSource !== "none";

  // Resolve name
  const name = accountConfig?.name ?? wechat?.name ?? accountId;

  // Resolve auth token (cached to ensure consistency)
  const authToken = resolveAuthToken({
    accountId,
    accountConfig,
    baseConfig: wechat,
  });

  return {
    accountId,
    name,
    enabled,
    bridgeUrl,
    bridgeUrlSource,
    authToken,
    config: mergedConfig,
  };
}

/**
 * Check if a WeChat account is configured.
 * In the new architecture, wechat is always configured if enabled.
 */
export function isWeChatAccountConfigured(account: ResolvedWeChatAccount): boolean {
  return account.enabled;
}
