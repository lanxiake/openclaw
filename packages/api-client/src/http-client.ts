/**
 * HTTP 客户端核心
 *
 * 提供统一的 HTTP 请求封装，支持：
 * - 自动添加认证头
 * - 自动刷新令牌
 * - 统一错误处理
 * - 请求/响应拦截
 */

import { ApiError, type ApiResponse } from "./types.js";
import { type TokenProvider } from "./token-provider.js";

/**
 * HTTP 客户端配置
 */
export interface HttpClientConfig {
  /** API 基础 URL */
  baseUrl: string;
  /** Token Provider */
  tokenProvider?: TokenProvider;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 是否在 401 时自动刷新令牌 */
  autoRefreshToken?: boolean;
  /** 请求拦截器 */
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  /** 响应拦截器 */
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
  /** 错误拦截器 */
  onError?: (error: ApiError) => void;
}

/**
 * 请求配置
 */
export interface RequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  /** 是否跳过认证 */
  skipAuth?: boolean;
}

/**
 * HTTP 客户端类
 */
export class HttpClient {
  private readonly config: Required<
    Pick<HttpClientConfig, "baseUrl" | "timeout" | "autoRefreshToken">
  > &
    HttpClientConfig;
  private isRefreshing = false;
  private refreshQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 30000,
      autoRefreshToken: true,
      ...config,
    };
  }

  /**
   * 构建完整 URL
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(path, this.config.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const token = this.config.tokenProvider?.getAccessToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /**
   * 处理令牌刷新
   */
  private async handleTokenRefresh(): Promise<string | null> {
    if (!this.config.tokenProvider) {
      return null;
    }

    // 如果正在刷新，等待刷新完成
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const newToken = await this.config.tokenProvider.refreshAccessToken();

      // 通知所有等待的请求
      this.refreshQueue.forEach(({ resolve }) => resolve(newToken));
      this.refreshQueue = [];

      return newToken;
    } catch (error) {
      // 通知所有等待的请求失败
      this.refreshQueue.forEach(({ reject }) =>
        reject(error instanceof Error ? error : new Error(String(error))),
      );
      this.refreshQueue = [];
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 发送请求
   */
  async request<T>(requestConfig: RequestConfig): Promise<T> {
    let config = { ...requestConfig };

    // 应用请求拦截器
    if (this.config.onRequest) {
      config = await this.config.onRequest(config);
    }

    const { method, url, params, body, headers, timeout, skipAuth } = config;

    // 构建请求头
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
      ...(skipAuth ? {} : this.getAuthHeaders()),
      ...headers,
    };

    // 构建请求选项
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    };

    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.config.timeout);
    fetchOptions.signal = controller.signal;

    try {
      const fullUrl = this.buildUrl(url, params);
      console.log(`[api-client] ${method} ${fullUrl}`);

      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timeoutId);

      // 处理 401 未授权 - 尝试刷新令牌
      if (response.status === 401 && this.config.autoRefreshToken && !skipAuth) {
        const newToken = await this.handleTokenRefresh();
        if (newToken) {
          // 使用新令牌重试请求
          return this.request<T>({ ...requestConfig, skipAuth: false });
        }
        // 刷新失败，抛出错误
        throw new ApiError("Authentication required", "UNAUTHORIZED", 401);
      }

      // 解析响应
      const data = (await response.json()) as ApiResponse<T>;

      // 应用响应拦截器
      const processedData = this.config.onResponse ? this.config.onResponse(data) : data;

      // 检查业务错误
      if (!processedData.success) {
        const error = new ApiError(
          processedData.error,
          processedData.code,
          response.status,
          processedData.details,
        );
        this.config.onError?.(error);
        throw error;
      }

      return processedData.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new ApiError("Request timeout", "TIMEOUT", 408);
        }
        throw new ApiError(error.message, "NETWORK_ERROR", 0);
      }

      throw new ApiError("Unknown error", "UNKNOWN", 0);
    }
  }

  /**
   * GET 请求
   */
  get<T>(
    url: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: Partial<RequestConfig>,
  ): Promise<T> {
    return this.request<T>({ method: "GET", url, params, ...options });
  }

  /**
   * POST 请求
   */
  post<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ method: "POST", url, body, ...options });
  }

  /**
   * PUT 请求
   */
  put<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ method: "PUT", url, body, ...options });
  }

  /**
   * DELETE 请求
   */
  delete<T>(url: string, options?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ method: "DELETE", url, ...options });
  }

  /**
   * PATCH 请求
   */
  patch<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ method: "PATCH", url, body, ...options });
  }
}
