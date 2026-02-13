/**
 * API 客户端配置
 *
 * 创建并导出 AdminApiClient 实例，供 Hooks 使用
 */

import { createAdminApiClient, type AdminApiClient } from "@openclaw/api-client/admin";
import { STORAGE_KEYS } from "./constants";

/**
 * API 服务器地址
 * 优先使用环境变量，否则使用相对路径（同源部署）
 */
const API_BASE_URL = import.meta.env.VITE_API_SERVER_URL || "";

/**
 * 全局 API 客户端实例
 */
let apiClientInstance: AdminApiClient | null = null;

/**
 * 认证失败回调（由 AuthContext 设置）
 */
let onAuthErrorCallback: (() => void) | null = null;

/**
 * 设置认证失败回调
 */
export function setOnAuthError(callback: () => void): void {
  onAuthErrorCallback = callback;
}

/**
 * 获取 API 客户端实例（单例）
 */
export function getApiClient(): AdminApiClient {
  if (!apiClientInstance) {
    apiClientInstance = createAdminApiClient({
      baseUrl: API_BASE_URL,
      timeout: 30000,
      onAuthError: () => {
        // 清除本地存储的认证信息
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_INFO);

        // 调用认证失败回调
        onAuthErrorCallback?.();
      },
    });
  }
  return apiClientInstance;
}

/**
 * 重置 API 客户端（用于登出后重新创建）
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

/**
 * 导出默认 API 客户端
 */
export const apiClient = {
  get instance(): AdminApiClient {
    return getApiClient();
  },
};
