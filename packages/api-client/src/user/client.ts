/**
 * 用户端 API 客户端
 *
 * 封装所有用户相关的 HTTP API 调用
 */

import { HttpClient } from "../http-client.js";
import { BrowserTokenProvider, type TokenProvider } from "../token-provider.js";
import type {
  CurrentUser,
  UpdateUserRequest,
  DeviceListResponse,
  SubscriptionInfoResponse,
  UsageResponse,
  Conversation,
  ConversationListParams,
  ConversationListResponse,
  Message,
  MessageListResponse,
  Memory,
  MemoryListParams,
  MemoryListResponse,
  CreateMemoryRequest,
  AssistantConfig,
  UpdateAssistantConfigRequest,
  InstalledSkill,
  StoreSkill,
  StoreSkillListParams,
  StoreSkillListResponse,
  UserFile,
  FileListResponse,
  UploadUrlResponse,
} from "./types.js";
import type { PaginationParams } from "../types.js";

/**
 * 用户 API 客户端配置
 */
export interface UserApiClientConfig {
  /** API 基础 URL */
  baseUrl: string;
  /** Token Provider（可选，默认使用 BrowserTokenProvider） */
  tokenProvider?: TokenProvider;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 认证失败回调 */
  onAuthError?: () => void;
}

/**
 * 用户 API 客户端
 */
export class UserApiClient {
  private readonly http: HttpClient;
  private readonly tokenProvider: TokenProvider;
  private readonly onAuthError?: () => void;

  constructor(config: UserApiClientConfig) {
    this.onAuthError = config.onAuthError;

    // 创建 Token Provider
    this.tokenProvider =
      config.tokenProvider ||
      new BrowserTokenProvider({
        accessTokenKey: "user_access_token",
        refreshTokenKey: "user_refresh_token",
        onRefreshToken: async (refreshToken) => {
          try {
            const result = await this.refreshToken(refreshToken);
            return {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            };
          } catch {
            return null;
          }
        },
      });

    // 创建 HTTP 客户端
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      tokenProvider: this.tokenProvider,
      timeout: config.timeout,
      onError: (error) => {
        if (error.code === "UNAUTHORIZED") {
          this.onAuthError?.();
        }
      },
    });
  }

  /**
   * 刷新令牌（内部使用）
   */
  private async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.http.post("/api/auth/refresh", { refreshToken }, { skipAuth: true });
  }

  /**
   * 设置令牌（用于外部登录后设置）
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.tokenProvider.setTokens(accessToken, refreshToken);
  }

  /**
   * 清除令牌
   */
  clearTokens(): void {
    this.tokenProvider.clearTokens();
  }

  // ============ 用户信息 API ============

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return this.http.get<CurrentUser>("/api/users/me");
  }

  /**
   * 更新当前用户信息
   */
  async updateCurrentUser(request: UpdateUserRequest): Promise<CurrentUser> {
    return this.http.put<CurrentUser>("/api/users/me", request);
  }

  /**
   * 获取用户设备列表
   */
  async getDevices(): Promise<DeviceListResponse> {
    const response = await this.http.get<{
      data: DeviceListResponse["data"];
      meta: DeviceListResponse["meta"];
    }>("/api/users/me/devices");
    return response;
  }

  /**
   * 获取用户订阅信息
   */
  async getSubscription(): Promise<SubscriptionInfoResponse> {
    return this.http.get<SubscriptionInfoResponse>("/api/users/me/subscription");
  }

  /**
   * 获取用户使用量
   */
  async getUsage(): Promise<UsageResponse> {
    return this.http.get<UsageResponse>("/api/users/me/usage");
  }

  // ============ 对话 API ============

  /**
   * 获取对话列表
   */
  async getConversations(params?: ConversationListParams): Promise<ConversationListResponse> {
    const response = await this.http.get<{
      data: Conversation[];
      meta: ConversationListResponse["meta"];
    }>("/api/conversations", params as Record<string, string | number | boolean | undefined>);
    return response;
  }

  /**
   * 获取对话详情
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.http.get<Conversation>(`/api/conversations/${conversationId}`);
  }

  /**
   * 获取对话消息
   */
  async getMessages(
    conversationId: string,
    params?: PaginationParams,
  ): Promise<MessageListResponse> {
    const response = await this.http.get<{
      data: Message[];
      meta: MessageListResponse["meta"];
    }>(
      `/api/conversations/${conversationId}/messages`,
      params as Record<string, string | number | boolean | undefined>,
    );
    return response;
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.http.delete(`/api/conversations/${conversationId}`);
  }

  // ============ 记忆 API ============

  /**
   * 获取记忆列表
   */
  async getMemories(params?: MemoryListParams): Promise<MemoryListResponse> {
    const response = await this.http.get<{
      data: Memory[];
      meta: MemoryListResponse["meta"];
    }>("/api/memories", params as Record<string, string | number | boolean | undefined>);
    return response;
  }

  /**
   * 创建记忆
   */
  async createMemory(request: CreateMemoryRequest): Promise<Memory> {
    return this.http.post<Memory>("/api/memories", request);
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.http.delete(`/api/memories/${memoryId}`);
  }

  // ============ 助手配置 API ============

  /**
   * 获取助手配置列表
   */
  async getAssistantConfigs(): Promise<AssistantConfig[]> {
    return this.http.get<AssistantConfig[]>("/api/assistant-config");
  }

  /**
   * 获取助手配置详情
   */
  async getAssistantConfig(configId: string): Promise<AssistantConfig> {
    return this.http.get<AssistantConfig>(`/api/assistant-config/${configId}`);
  }

  /**
   * 更新助手配置
   */
  async updateAssistantConfig(
    configId: string,
    request: UpdateAssistantConfigRequest,
  ): Promise<AssistantConfig> {
    return this.http.put<AssistantConfig>(`/api/assistant-config/${configId}`, request);
  }

  // ============ 技能 API ============

  /**
   * 获取已安装技能列表
   */
  async getInstalledSkills(): Promise<InstalledSkill[]> {
    return this.http.get<InstalledSkill[]>("/api/skills");
  }

  /**
   * 安装技能
   */
  async installSkill(skillId: string): Promise<InstalledSkill> {
    return this.http.post<InstalledSkill>("/api/skills/install", { skillId });
  }

  /**
   * 卸载技能
   */
  async uninstallSkill(skillId: string): Promise<void> {
    await this.http.delete(`/api/skills/${skillId}`);
  }

  /**
   * 启用/禁用技能
   */
  async toggleSkill(skillId: string, enabled: boolean): Promise<void> {
    await this.http.post(`/api/skills/${skillId}/toggle`, { enabled });
  }

  // ============ 技能商店 API ============

  /**
   * 获取技能商店列表
   */
  async getStoreSkills(params?: StoreSkillListParams): Promise<StoreSkillListResponse> {
    const response = await this.http.get<{
      data: StoreSkill[];
      meta: StoreSkillListResponse["meta"];
    }>("/api/store/skills", params as Record<string, string | number | boolean | undefined>);
    return response;
  }

  /**
   * 获取技能商店详情
   */
  async getStoreSkill(skillId: string): Promise<StoreSkill> {
    return this.http.get<StoreSkill>(`/api/store/skills/${skillId}`);
  }

  // ============ 文件 API ============

  /**
   * 获取文件列表
   */
  async getFiles(params?: PaginationParams): Promise<FileListResponse> {
    const response = await this.http.get<{
      data: UserFile[];
      meta: FileListResponse["meta"];
    }>("/api/files", params as Record<string, string | number | boolean | undefined>);
    return response;
  }

  /**
   * 获取上传 URL
   */
  async getUploadUrl(filename: string, mimeType: string): Promise<UploadUrlResponse> {
    return this.http.get<UploadUrlResponse>("/api/files/upload-url", {
      filename,
      mimeType,
    });
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.http.delete(`/api/files/${fileId}`);
  }
}

/**
 * 创建用户 API 客户端实例
 */
export function createUserApiClient(config: UserApiClientConfig): UserApiClient {
  return new UserApiClient(config);
}
