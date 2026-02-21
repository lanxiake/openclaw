/**
 * 管理员 API 客户端
 *
 * 封装所有管理员相关的 HTTP API 调用
 */

import { HttpClient } from "../http-client.js";
import { BrowserTokenProvider, type TokenProvider } from "../token-provider.js";
import type {
  Admin,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  User,
  UserDetail,
  UserListParams,
  UserListResponse,
  UserStats,
  Plan,
  CreatePlanRequest,
  UpdatePlanRequest,
  Subscription,
  SubscriptionListParams,
  SubscriptionListResponse,
  SubscriptionStats,
  Skill,
  SkillListParams,
  SkillListResponse,
  SkillCategory,
  SkillStats,
  CreateSkillRequest,
  UpdateSkillRequest,
  SkillPackageUploadResult,
  AuditLog,
  AuditLogListParams,
  AuditLogListResponse,
  AuditLogStats,
  SystemConfig,
  ConfigGroup,
  ConfigHistory,
  DashboardStats,
  TrendData,
  SubscriptionDistribution,
  Activity,
  ApiMonitorData,
  MonitorStats,
  SystemHealth,
  ResourceUsage,
  AdminItem,
  AdminListParams,
  AdminListResponse,
  CreateAdminRequest,
  UpdateAdminRequest,
  ModelProvider,
  UpsertModelProviderRequest,
  UpdateModelProviderRequest,
  ModelProviderTestResult,
  AgentConfig,
  UpdateAgentConfigRequest,
  AuthProfile,
  UpsertAuthProfileRequest,
  UpdateAuthProfileRequest,
  AuthProfileOrder,
  GatewayConfig,
  UpdateGatewayConfigRequest,
} from "./types.js";

/**
 * 管理员 API 客户端配置
 */
export interface AdminApiClientConfig {
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
 * 管理员 API 客户端
 */
export class AdminApiClient {
  private readonly http: HttpClient;
  private readonly tokenProvider: TokenProvider;
  private readonly onAuthError?: () => void;

  constructor(config: AdminApiClientConfig) {
    this.onAuthError = config.onAuthError;

    // 创建 Token Provider
    this.tokenProvider =
      config.tokenProvider ||
      new BrowserTokenProvider({
        accessTokenKey: "admin_access_token",
        refreshTokenKey: "admin_refresh_token",
        onRefreshToken: async (refreshToken) => {
          try {
            const result = await this.refreshToken({ refreshToken });
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

  // ============ 认证 API ============

  /**
   * 管理员登录
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const result = await this.http.post<LoginResponse>("/api/admin/auth/login", request, {
      skipAuth: true,
    });

    // 保存令牌
    this.tokenProvider.setTokens(result.accessToken, result.refreshToken);

    return result;
  }

  /**
   * 刷新令牌
   */
  async refreshToken(request: RefreshTokenRequest): Promise<LoginResponse> {
    return this.http.post<LoginResponse>("/api/admin/auth/refresh", request, { skipAuth: true });
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    const refreshToken = this.tokenProvider.getRefreshToken();
    try {
      await this.http.post("/api/admin/auth/logout", { refreshToken });
    } finally {
      this.tokenProvider.clearTokens();
    }
  }

  /**
   * 获取当前管理员信息
   */
  async getProfile(): Promise<Admin> {
    return this.http.get<Admin>("/api/admin/auth/profile");
  }

  /**
   * 更新管理员资料
   */
  async updateProfile(request: UpdateProfileRequest): Promise<Admin> {
    return this.http.put<Admin>("/api/admin/auth/profile", request);
  }

  /**
   * 修改密码
   */
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await this.http.post("/api/admin/auth/password", request);
  }

  // ============ 用户管理 API ============

  /**
   * 获取用户列表
   */
  async getUsers(params?: UserListParams): Promise<UserListResponse> {
    const response = await this.http.getFull<User[]>(
      "/api/admin/users",
      params as Record<string, string | number | boolean | undefined>,
    );
    return {
      data: response.data,
      meta: response.meta as UserListResponse["meta"],
    };
  }

  /**
   * 获取用户详情
   */
  async getUser(userId: string): Promise<UserDetail> {
    return this.http.get<UserDetail>(`/api/admin/users/${userId}`);
  }

  /**
   * 获取用户统计
   */
  async getUserStats(): Promise<UserStats> {
    return this.http.get<UserStats>("/api/admin/users/stats");
  }

  /**
   * 停用用户
   */
  async suspendUser(userId: string, reason?: string): Promise<void> {
    await this.http.post(`/api/admin/users/${userId}/suspend`, { reason });
  }

  /**
   * 激活用户
   */
  async activateUser(userId: string): Promise<void> {
    await this.http.post(`/api/admin/users/${userId}/activate`);
  }

  /**
   * 重置用户密码
   */
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.http.post(`/api/admin/users/${userId}/reset-password`, { newPassword });
  }

  /**
   * 强制用户登出
   */
  async forceLogoutUser(userId: string): Promise<void> {
    await this.http.post(`/api/admin/users/${userId}/force-logout`);
  }

  // ============ 套餐管理 API ============

  /**
   * 获取套餐列表
   */
  async getPlans(): Promise<Plan[]> {
    return this.http.get<Plan[]>("/api/admin/plans");
  }

  /**
   * 获取套餐详情
   */
  async getPlan(planId: string): Promise<Plan> {
    return this.http.get<Plan>(`/api/admin/plans/${planId}`);
  }

  /**
   * 创建套餐
   */
  async createPlan(request: CreatePlanRequest): Promise<Plan> {
    return this.http.post<Plan>("/api/admin/plans", request);
  }

  /**
   * 更新套餐
   */
  async updatePlan(planId: string, request: UpdatePlanRequest): Promise<void> {
    await this.http.put(`/api/admin/plans/${planId}`, request);
  }

  // ============ 订阅管理 API ============

  /**
   * 获取订阅列表
   */
  async getSubscriptions(params?: SubscriptionListParams): Promise<SubscriptionListResponse> {
    const response = await this.http.getFull<Subscription[]>(
      "/api/admin/subscriptions",
      params as Record<string, string | number | boolean | undefined>,
    );
    return {
      data: response.data,
      meta: response.meta as SubscriptionListResponse["meta"],
    };
  }

  /**
   * 获取订阅详情
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    return this.http.get<Subscription>(`/api/admin/subscriptions/${subscriptionId}`);
  }

  // ============ 技能管理 API ============

  /**
   * 获取技能列表
   */
  async getSkills(params?: SkillListParams): Promise<SkillListResponse> {
    const response = await this.http.getFull<Skill[]>(
      "/api/admin/skills",
      params as Record<string, string | number | boolean | undefined>,
    );
    return {
      data: response.data,
      meta: response.meta as SkillListResponse["meta"],
    };
  }

  /**
   * 获取技能详情
   */
  async getSkill(skillId: string): Promise<Skill> {
    return this.http.get<Skill>(`/api/admin/skills/${skillId}`);
  }

  /**
   * 审核技能
   */
  async reviewSkill(skillId: string, action: "approve" | "reject", reason?: string): Promise<void> {
    await this.http.post(`/api/admin/skills/${skillId}/review`, {
      action,
      reason,
    });
  }

  /**
   * 设置技能推荐状态
   */
  async setSkillFeatured(skillId: string, featured: boolean): Promise<void> {
    await this.http.post(`/api/admin/skills/${skillId}/featured`, { featured });
  }

  /**
   * 获取技能分类列表
   */
  async getSkillCategories(): Promise<SkillCategory[]> {
    return this.http.get<SkillCategory[]>("/api/admin/skills/categories");
  }

  /**
   * 获取技能统计
   */
  async getSkillStats(): Promise<SkillStats> {
    return this.http.get<SkillStats>("/api/admin/skills/stats");
  }

  /**
   * 创建系统技能
   */
  async createSkill(request: CreateSkillRequest): Promise<Skill> {
    return this.http.post<Skill>("/api/admin/skills", request);
  }

  /**
   * 更新技能
   */
  async updateSkill(skillId: string, request: UpdateSkillRequest): Promise<Skill> {
    return this.http.put<Skill>(`/api/admin/skills/${skillId}`, request);
  }

  /**
   * 删除技能
   */
  async deleteSkill(skillId: string): Promise<void> {
    await this.http.delete(`/api/admin/skills/${skillId}`);
  }

  /**
   * 上传技能包
   *
   * 使用 application/octet-stream 格式上传二进制文件
   */
  async uploadSkillPackage(
    skillId: string,
    file: File | Blob,
    filename?: string,
  ): Promise<SkillPackageUploadResult> {
    const token = this.http["config"].tokenProvider?.getAccessToken();
    const baseUrl = this.http["config"].baseUrl;
    const url = new URL(`/api/admin/skills/${skillId}/upload-package`, baseUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "X-Filename": filename || (file instanceof File ? file.name : "package.zip"),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const buffer = await file.arrayBuffer();
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: buffer,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error((errorData as Record<string, string>).error || "Upload failed");
    }

    const result = (await response.json()) as { success: boolean; data: SkillPackageUploadResult };
    return result.data;
  }

  /**
   * 发布技能
   */
  async publishSkill(skillId: string): Promise<void> {
    await this.http.post(`/api/admin/skills/${skillId}/publish`);
  }

  /**
   * 下架技能
   */
  async unpublishSkill(skillId: string): Promise<void> {
    await this.http.post(`/api/admin/skills/${skillId}/unpublish`);
  }

  // ============ 审计日志 API ============

  /**
   * 获取审计日志列表
   */
  async getAuditLogs(params?: AuditLogListParams): Promise<AuditLogListResponse> {
    const response = await this.http.getFull<AuditLog[]>(
      "/api/admin/audit",
      params as Record<string, string | number | boolean | undefined>,
    );
    return {
      data: response.data,
      meta: response.meta as AuditLogListResponse["meta"],
    };
  }

  // ============ 系统配置 API ============

  /**
   * 获取系统配置列表
   */
  async getConfigs(category?: string): Promise<SystemConfig[]> {
    return this.http.get<SystemConfig[]>("/api/admin/config", { category });
  }

  /**
   * 更新系统配置
   */
  async updateConfig(key: string, value: unknown): Promise<void> {
    await this.http.put(`/api/admin/config/${key}`, { value });
  }

  // ============ 监控 API ============

  /**
   * 获取仪表盘统计
   */
  async getDashboardStats(): Promise<DashboardStats> {
    return this.http.get<DashboardStats>("/api/admin/dashboard/stats");
  }

  /**
   * 获取 API 监控数据
   */
  async getApiMonitor(hours?: number): Promise<ApiMonitorData> {
    return this.http.get<ApiMonitorData>("/api/admin/monitor/api", { hours });
  }

  // ============ 管理员管理 API ============

  /**
   * 获取管理员列表
   */
  async getAdmins(params?: AdminListParams): Promise<AdminListResponse> {
    const response = await this.http.getFull<AdminItem[]>(
      "/api/admin/admins",
      params as Record<string, string | number | boolean | undefined>,
    );
    return {
      data: response.data,
      meta: response.meta as AdminListResponse["meta"],
    };
  }

  /**
   * 获取管理员详情
   */
  async getAdmin(adminId: string): Promise<AdminItem> {
    return this.http.get<AdminItem>(`/api/admin/admins/${adminId}`);
  }

  /**
   * 创建管理员
   */
  async createAdmin(request: CreateAdminRequest): Promise<AdminItem> {
    return this.http.post<AdminItem>("/api/admin/admins", request);
  }

  /**
   * 更新管理员
   */
  async updateAdmin(adminId: string, request: UpdateAdminRequest): Promise<AdminItem> {
    return this.http.put<AdminItem>(`/api/admin/admins/${adminId}`, request);
  }

  /**
   * 重置管理员密码
   */
  async resetAdminPassword(adminId: string): Promise<{ tempPassword: string }> {
    return this.http.post<{ tempPassword: string }>(`/api/admin/admins/${adminId}/reset-password`);
  }

  /**
   * 更新管理员状态
   */
  async updateAdminStatus(adminId: string, status: "active" | "suspended"): Promise<void> {
    await this.http.put(`/api/admin/admins/${adminId}/status`, { status });
  }

  /**
   * 强制管理员登出
   */
  async forceAdminLogout(adminId: string): Promise<void> {
    await this.http.post(`/api/admin/admins/${adminId}/force-logout`);
  }

  // ============ 订阅扩展 API ============

  /**
   * 获取订阅统计
   */
  async getSubscriptionStats(): Promise<SubscriptionStats> {
    return this.http.get<SubscriptionStats>("/api/admin/subscriptions/stats");
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    await this.http.post(`/api/admin/subscriptions/${subscriptionId}/cancel`, { reason });
  }

  /**
   * 延长订阅
   */
  async extendSubscription(subscriptionId: string, days: number): Promise<void> {
    await this.http.post(`/api/admin/subscriptions/${subscriptionId}/extend`, { days });
  }

  // ============ 审计日志扩展 API ============

  /**
   * 获取审计日志统计
   */
  async getAuditLogStats(): Promise<AuditLogStats> {
    return this.http.get<AuditLogStats>("/api/admin/audit/stats");
  }

  /**
   * 获取单条审计日志详情
   */
  async getAuditLog(logId: string): Promise<AuditLog> {
    return this.http.get<AuditLog>(`/api/admin/audit/${logId}`);
  }

  /**
   * 获取审计日志操作类型列表
   */
  async getAuditActions(): Promise<string[]> {
    return this.http.get<string[]>("/api/admin/audit/actions");
  }

  /**
   * 获取审计日志管理员列表
   */
  async getAuditAdmins(): Promise<Array<{ id: string; username: string }>> {
    return this.http.get<Array<{ id: string; username: string }>>("/api/admin/audit/admins");
  }

  // ============ 配置扩展 API ============

  /**
   * 获取单个配置项
   */
  async getConfig(key: string): Promise<SystemConfig> {
    return this.http.get<SystemConfig>(`/api/admin/config/${key}`);
  }

  /**
   * 获取配置分组列表
   */
  async getConfigGroups(): Promise<ConfigGroup[]> {
    return this.http.get<ConfigGroup[]>("/api/admin/config/groups");
  }

  /**
   * 获取配置变更历史
   */
  async getConfigHistory(key: string): Promise<ConfigHistory[]> {
    return this.http.get<ConfigHistory[]>(`/api/admin/config/${key}/history`);
  }

  /**
   * 重置配置为默认值
   */
  async resetConfig(key: string): Promise<void> {
    await this.http.post(`/api/admin/config/${key}/reset`);
  }

  // ============ 仪表盘扩展 API ============

  /**
   * 获取仪表盘趋势数据
   *
   * @param type - 趋势类型 (users | revenue | subscriptions)
   * @param period - 时间周期 (7d | 30d | 90d)
   */
  async getDashboardTrends(
    type?: "users" | "revenue" | "subscriptions",
    period?: "7d" | "30d" | "90d",
  ): Promise<TrendData> {
    return this.http.get<TrendData>("/api/admin/dashboard/trends", { type, period });
  }

  /**
   * 获取订阅分布数据
   */
  async getDashboardDistribution(): Promise<SubscriptionDistribution[]> {
    return this.http.get<SubscriptionDistribution[]>("/api/admin/dashboard/distribution");
  }

  /**
   * 获取最近活动
   */
  async getDashboardActivities(limit?: number): Promise<Activity[]> {
    return this.http.get<Activity[]>("/api/admin/dashboard/activities", { limit });
  }

  // ============ 监控扩展 API ============

  /**
   * 获取监控统计数据
   */
  async getMonitorStats(): Promise<MonitorStats> {
    return this.http.get<MonitorStats>("/api/admin/monitor/stats");
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return this.http.get<SystemHealth>("/api/admin/monitor/health");
  }

  /**
   * 获取资源使用情况
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    return this.http.get<ResourceUsage>("/api/admin/monitor/resources");
  }

  // ============ 模型提供商 API ============

  /**
   * 获取模型提供商列表
   */
  async getModelProviders(): Promise<ModelProvider[]> {
    return this.http.get<ModelProvider[]>("/api/admin/model-providers");
  }

  /**
   * 获取模型提供商详情
   */
  async getModelProvider(providerId: string): Promise<ModelProvider> {
    return this.http.get<ModelProvider>(`/api/admin/model-providers/${providerId}`);
  }

  /**
   * 创建或更新模型提供商（创建时使用 POST）
   */
  async upsertModelProvider(request: UpsertModelProviderRequest): Promise<ModelProvider> {
    return this.http.post<ModelProvider>("/api/admin/model-providers", request);
  }

  /**
   * 更新已有模型提供商（使用 PUT，apiKey 可选）
   */
  async updateModelProvider(
    providerKey: string,
    request: UpdateModelProviderRequest,
  ): Promise<ModelProvider> {
    return this.http.put<ModelProvider>(`/api/admin/model-providers/${providerKey}`, request);
  }

  /**
   * 删除模型提供商
   */
  async deleteModelProvider(providerId: string): Promise<void> {
    await this.http.delete(`/api/admin/model-providers/${providerId}`);
  }

  /**
   * 测试模型提供商连接和模型可用性
   */
  async testModelProvider(providerKey: string): Promise<ModelProviderTestResult> {
    const response = await this.http.post<{ data: ModelProviderTestResult }>(
      `/api/admin/model-providers/${providerKey}/test`,
    );
    return (
      (response as unknown as { data: ModelProviderTestResult }).data ??
      (response as unknown as ModelProviderTestResult)
    );
  }

  // ============ Agent 配置 API ============

  /**
   * 获取 Agent 配置
   */
  async getAgentConfig(): Promise<AgentConfig> {
    return this.http.get<AgentConfig>("/api/admin/agent-config");
  }

  /**
   * 更新 Agent 配置
   */
  async updateAgentConfig(request: UpdateAgentConfigRequest): Promise<AgentConfig> {
    return this.http.put<AgentConfig>("/api/admin/agent-config", request);
  }

  /**
   * 重置 Agent 配置为默认值
   */
  async resetAgentConfig(): Promise<AgentConfig> {
    return this.http.post<AgentConfig>("/api/admin/agent-config/reset");
  }

  // ============ Auth Profile API ============

  /**
   * 获取 Auth Profile 列表
   */
  async getAuthProfiles(): Promise<AuthProfile[]> {
    return this.http.get<AuthProfile[]>("/api/admin/auth-profiles");
  }

  /**
   * 获取 Auth Profile 详情
   */
  async getAuthProfile(profileId: string): Promise<AuthProfile> {
    return this.http.get<AuthProfile>(`/api/admin/auth-profiles/${profileId}`);
  }

  /**
   * 创建 Auth Profile
   */
  async upsertAuthProfile(request: UpsertAuthProfileRequest): Promise<AuthProfile> {
    return this.http.post<AuthProfile>("/api/admin/auth-profiles", request);
  }

  /**
   * 更新 Auth Profile
   */
  async updateAuthProfile(
    profileId: string,
    request: UpdateAuthProfileRequest,
  ): Promise<AuthProfile> {
    return this.http.put<AuthProfile>(`/api/admin/auth-profiles/${profileId}`, request);
  }

  /**
   * 删除 Auth Profile
   */
  async deleteAuthProfile(profileId: string): Promise<void> {
    await this.http.delete(`/api/admin/auth-profiles/${profileId}`);
  }

  /**
   * 获取 Auth Profile 优先级列表
   */
  async getAuthProfileOrders(): Promise<AuthProfileOrder[]> {
    return this.http.get<AuthProfileOrder[]>("/api/admin/auth-profiles/orders");
  }

  /**
   * 更新 Agent 的 Auth Profile 优先级
   */
  async updateAuthProfileOrder(agentKey: string, profileIds: string[]): Promise<AuthProfileOrder> {
    return this.http.put<AuthProfileOrder>(`/api/admin/auth-profiles/orders/${agentKey}`, {
      profileIds,
    });
  }

  // ============ Gateway 配置 API ============

  /**
   * 获取系统 Gateway 配置
   */
  async getGatewayConfig(): Promise<GatewayConfig> {
    return this.http.get<GatewayConfig>("/api/admin/gateway-config");
  }

  /**
   * 更新系统 Gateway 配置
   */
  async updateGatewayConfig(request: UpdateGatewayConfigRequest): Promise<GatewayConfig> {
    return this.http.put<GatewayConfig>("/api/admin/gateway-config", request);
  }
}

/**
 * 创建管理员 API 客户端实例
 */
export function createAdminApiClient(config: AdminApiClientConfig): AdminApiClient {
  return new AdminApiClient(config);
}
