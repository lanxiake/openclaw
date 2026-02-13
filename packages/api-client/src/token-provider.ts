/**
 * Token Provider 接口
 *
 * 用于获取和刷新认证令牌，支持不同环境（浏览器、Node.js）
 */

/**
 * Token Provider 接口
 */
export interface TokenProvider {
  /**
   * 获取当前访问令牌
   * @returns 访问令牌，如果未登录返回 null
   */
  getAccessToken(): string | null;

  /**
   * 获取刷新令牌
   * @returns 刷新令牌，如果未登录返回 null
   */
  getRefreshToken(): string | null;

  /**
   * 设置令牌
   * @param accessToken - 访问令牌
   * @param refreshToken - 刷新令牌
   */
  setTokens(accessToken: string, refreshToken: string): void;

  /**
   * 清除令牌（登出）
   */
  clearTokens(): void;

  /**
   * 刷新访问令牌
   * @returns 新的访问令牌，如果刷新失败返回 null
   */
  refreshAccessToken(): Promise<string | null>;
}

/**
 * 浏览器 Token Provider - 使用 localStorage 存储令牌
 */
export class BrowserTokenProvider implements TokenProvider {
  private readonly accessTokenKey: string;
  private readonly refreshTokenKey: string;
  private refreshPromise: Promise<string | null> | null = null;
  private onRefreshToken?: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken: string;
  } | null>;

  constructor(
    options: {
      accessTokenKey?: string;
      refreshTokenKey?: string;
      onRefreshToken?: (refreshToken: string) => Promise<{
        accessToken: string;
        refreshToken: string;
      } | null>;
    } = {},
  ) {
    this.accessTokenKey = options.accessTokenKey || "openclaw_access_token";
    this.refreshTokenKey = options.refreshTokenKey || "openclaw_refresh_token";
    this.onRefreshToken = options.onRefreshToken;
  }

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  async refreshAccessToken(): Promise<string | null> {
    // 防止并发刷新
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken || !this.onRefreshToken) {
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const result = await this.onRefreshToken!(refreshToken);
        if (result) {
          this.setTokens(result.accessToken, result.refreshToken);
          return result.accessToken;
        }
        // 刷新失败，清除令牌
        this.clearTokens();
        return null;
      } catch {
        this.clearTokens();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

/**
 * 内存 Token Provider - 用于 Node.js 或测试环境
 */
export class MemoryTokenProvider implements TokenProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onRefreshToken?: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken: string;
  } | null>;

  constructor(
    options: {
      onRefreshToken?: (refreshToken: string) => Promise<{
        accessToken: string;
        refreshToken: string;
      } | null>;
    } = {},
  ) {
    this.onRefreshToken = options.onRefreshToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken || !this.onRefreshToken) {
      return null;
    }

    try {
      const result = await this.onRefreshToken(this.refreshToken);
      if (result) {
        this.setTokens(result.accessToken, result.refreshToken);
        return result.accessToken;
      }
      this.clearTokens();
      return null;
    } catch {
      this.clearTokens();
      return null;
    }
  }
}
