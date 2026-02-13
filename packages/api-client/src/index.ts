/**
 * OpenClaw API 客户端
 *
 * 提供统一的 HTTP API 客户端，支持浏览器和 Node.js 环境
 *
 * @example
 * ```typescript
 * import { createAdminApiClient } from '@openclaw/api-client/admin';
 *
 * const client = createAdminApiClient({
 *   baseUrl: 'http://localhost:3000',
 * });
 *
 * // 登录
 * const { accessToken } = await client.login({
 *   username: 'admin',
 *   password: 'password',
 * });
 *
 * // 获取用户列表
 * const users = await client.getUsers({ page: 1, pageSize: 20 });
 * ```
 */

// 核心模块
export { HttpClient } from "./http-client.js";
export type { HttpClientConfig, RequestConfig } from "./http-client.js";

// Token Provider
export { BrowserTokenProvider, MemoryTokenProvider } from "./token-provider.js";
export type { TokenProvider } from "./token-provider.js";

// 类型定义
export { ApiError } from "./types.js";
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginationMeta,
  PaginationParams,
  SortParams,
} from "./types.js";

// 管理员 API
export { AdminApiClient, createAdminApiClient } from "./admin/index.js";
export type { AdminApiClientConfig } from "./admin/index.js";

// 用户 API
export { UserApiClient, createUserApiClient } from "./user/index.js";
export type { UserApiClientConfig } from "./user/index.js";
