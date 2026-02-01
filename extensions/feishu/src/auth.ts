/**
 * Feishu authentication and token management
 */

import type {
  FeishuApiResponse,
  FeishuTenantAccessTokenResponse,
} from "./types.js";
import { FeishuApiError } from "./types.js";

/**
 * Token cache entry
 */
type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

/**
 * Feishu token manager
 */
class FeishuTokenManager {
  private tokenCache = new Map<string, TokenCacheEntry>();
  private locks = new Map<string, Promise<string>>();

  /**
   * Get tenant access token (with caching and auto-refresh)
   */
  async getAccessToken(
    appId: string,
    appSecret: string,
    apiBase = "https://open.feishu.cn"
  ): Promise<string> {
    const cacheKey = `${appId}:${apiBase}`;

    // Check cache
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      // Token valid for at least 1 more minute
      return cached.token;
    }

    // Check if refresh is already in progress
    const existingLock = this.locks.get(cacheKey);
    if (existingLock) {
      return await existingLock;
    }

    // Start refresh
    const refreshPromise = this.refreshToken(appId, appSecret, apiBase);
    this.locks.set(cacheKey, refreshPromise);

    try {
      const token = await refreshPromise;
      return token;
    } finally {
      this.locks.delete(cacheKey);
    }
  }

  /**
   * Refresh tenant access token
   */
  private async refreshToken(
    appId: string,
    appSecret: string,
    apiBase: string
  ): Promise<string> {
    const url = `${apiBase}/open-apis/auth/v3/tenant_access_token/internal/`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get tenant access token: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FeishuApiResponse<
      FeishuTenantAccessTokenResponse
    >;

    if (data.code !== 0) {
      throw new FeishuApiError(
        data.msg || "Failed to get tenant access token",
        data.code
      );
    }

    if (!data.data?.tenant_access_token) {
      throw new Error("No tenant access token in response");
    }

    const { tenant_access_token, expire } = data.data;

    // Cache token (expire 5 minutes early to be safe)
    const cacheKey = `${appId}:${apiBase}`;
    this.tokenCache.set(cacheKey, {
      token: tenant_access_token,
      expiresAt: Date.now() + (expire - 300) * 1000,
    });

    return tenant_access_token;
  }

  /**
   * Clear token cache for an app
   */
  clearCache(appId: string, apiBase = "https://open.feishu.cn"): void {
    const cacheKey = `${appId}:${apiBase}`;
    this.tokenCache.delete(cacheKey);
  }

  /**
   * Clear all token cache
   */
  clearAllCache(): void {
    this.tokenCache.clear();
  }
}

// Singleton instance
const tokenManager = new FeishuTokenManager();

/**
 * Get tenant access token
 */
export async function getFeishuAccessToken(
  appId: string,
  appSecret: string,
  apiBase?: string
): Promise<string> {
  return tokenManager.getAccessToken(
    appId,
    appSecret,
    apiBase || "https://open.feishu.cn"
  );
}

/**
 * Clear token cache
 */
export function clearFeishuTokenCache(
  appId: string,
  apiBase?: string
): void {
  tokenManager.clearCache(appId, apiBase || "https://open.feishu.cn");
}

/**
 * Clear all token cache
 */
export function clearAllFeishuTokenCache(): void {
  tokenManager.clearAllCache();
}
