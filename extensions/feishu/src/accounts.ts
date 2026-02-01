/**
 * Feishu account management and resolution
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type {
  FeishuAccountConfig,
  FeishuConfig,
  ResolvedFeishuAccount,
} from "./types.js";

const DEFAULT_ACCOUNT_ID = "default";

/**
 * List all Feishu account IDs from config
 */
export function listFeishuAccountIds(cfg: OpenClawConfig): string[] {
  const feishuCfg = cfg.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    return [DEFAULT_ACCOUNT_ID];
  }

  const accountIds = Object.keys(feishuCfg.accounts || {});
  if (accountIds.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }

  return accountIds;
}

/**
 * Resolve default Feishu account ID
 */
export function resolveDefaultFeishuAccountId(
  cfg: OpenClawConfig
): string | null {
  const feishuCfg = cfg.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    return DEFAULT_ACCOUNT_ID;
  }

  if (feishuCfg.defaultAccount) {
    return feishuCfg.defaultAccount;
  }

  const accountIds = listFeishuAccountIds(cfg);
  return accountIds[0] || DEFAULT_ACCOUNT_ID;
}

/**
 * Merge Feishu account configuration
 */
function mergeFeishuAccountConfig(
  cfg: OpenClawConfig,
  accountId: string
): FeishuAccountConfig {
  const feishuCfg = cfg.feishu as FeishuConfig | undefined;
  if (!feishuCfg) {
    return {} as FeishuAccountConfig;
  }

  const baseConfig: FeishuAccountConfig = {
    name: feishuCfg.name,
    enabled: feishuCfg.enabled,
    markdown: feishuCfg.markdown,
    appId: feishuCfg.appId,
    appSecret: feishuCfg.appSecret,
    verificationToken: feishuCfg.verificationToken,
    encryptKey: feishuCfg.encryptKey,
    webhookUrl: feishuCfg.webhookUrl,
    webhookPath: feishuCfg.webhookPath,
    dmPolicy: feishuCfg.dmPolicy,
    allowFrom: feishuCfg.allowFrom,
    mediaMaxMb: feishuCfg.mediaMaxMb,
    proxy: feishuCfg.proxy,
    apiBase: feishuCfg.apiBase,
  };

  if (accountId === DEFAULT_ACCOUNT_ID) {
    return baseConfig;
  }

  const accountConfig = feishuCfg.accounts?.[accountId];
  if (!accountConfig) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    ...accountConfig,
  };
}

/**
 * Normalize account ID
 */
function normalizeAccountId(accountId?: string | null): string {
  return accountId?.trim() || DEFAULT_ACCOUNT_ID;
}

/**
 * Resolve Feishu account with credentials
 */
export function resolveFeishuAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = mergeFeishuAccountConfig(params.cfg, accountId);

  // Support environment variables (only for default account)
  let appId = merged.appId;
  let appSecret = merged.appSecret;
  let verificationToken = merged.verificationToken;
  let encryptKey = merged.encryptKey;
  let credentialSource: "config" | "env" | "none" = "config";

  if (accountId === DEFAULT_ACCOUNT_ID) {
    appId = appId || process.env.FEISHU_APP_ID;
    appSecret = appSecret || process.env.FEISHU_APP_SECRET;
    verificationToken =
      verificationToken || process.env.FEISHU_VERIFICATION_TOKEN;
    encryptKey = encryptKey || process.env.FEISHU_ENCRYPT_KEY;

    if (!merged.appId && (appId || appSecret)) {
      credentialSource = "env";
    }
  }

  if (!appId || !appSecret) {
    credentialSource = "none";
  }

  return {
    accountId,
    name: merged.name,
    enabled: merged.enabled !== false,
    config: merged,
    appId,
    appSecret,
    verificationToken,
    encryptKey,
    credentialSource,
  };
}

/**
 * Set account enabled status
 */
export function setFeishuAccountEnabled(params: {
  cfg: OpenClawConfig;
  accountId: string;
  enabled: boolean;
}): OpenClawConfig {
  const { cfg, accountId, enabled } = params;
  const feishuCfg = (cfg.feishu as FeishuConfig) || {};

  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      feishu: {
        ...feishuCfg,
        enabled,
      },
    };
  }

  const accounts = feishuCfg.accounts || {};
  const accountConfig = accounts[accountId] || {};

  return {
    ...cfg,
    feishu: {
      ...feishuCfg,
      accounts: {
        ...accounts,
        [accountId]: {
          ...accountConfig,
          enabled,
        },
      },
    },
  };
}

/**
 * Delete Feishu account
 */
export function deleteFeishuAccount(params: {
  cfg: OpenClawConfig;
  accountId: string;
}): OpenClawConfig {
  const { cfg, accountId } = params;
  const feishuCfg = (cfg.feishu as FeishuConfig) || {};

  if (accountId === DEFAULT_ACCOUNT_ID) {
    // Cannot delete default account, just clear credentials
    return {
      ...cfg,
      feishu: {
        ...feishuCfg,
        appId: undefined,
        appSecret: undefined,
        verificationToken: undefined,
        encryptKey: undefined,
      },
    };
  }

  const accounts = { ...(feishuCfg.accounts || {}) };
  delete accounts[accountId];

  return {
    ...cfg,
    feishu: {
      ...feishuCfg,
      accounts,
    },
  };
}
