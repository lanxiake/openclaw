/**
 * 管理员 API 客户端
 *
 * 封装所有管理员相关的 HTTP API 调用
 */

import { HttpClient, type FullResponse } from "../http-client.js";
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
  ResourceHistory,
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
  LogQueryParams,
  LogQueryResponse,
  LogStats,
  AlertListParams,
  AlertListResponse,
  AnalyticsOverview,
  UserGrowthTrendResponse,
  RetentionAnalysisResponse,
  UserDemographicsResponse,
  RevenueTrendResponse,
  RevenueSourcesResponse,
  UserValueMetricsResponse,
  SkillUsageAnalyticsResponse,
  FunnelAnalysisResponse,
  FunnelType,
  CreditBalance,
  CreditTransaction,
  CreditHistoryParams,
  GrantCreditsRequest,
  CreditOperationResult,
  ModelPricing,
  UpsertModelPricingRequest,
  CleanupResult,
  LlmLogQueryParams,
  LlmLogListResponse,
  LlmLogStats,
  LlmModelDistribution,
  LlmPerformanceStats,
  TestEmbeddingRequest,
  EmbeddingTestResult,
  UserMemoryOverview,
  UserMemoryFact,
  UserMemoryFactsParams,
  UserMemoryFactsResponse,
  UserMemoryPreferences,
  UserWorkspaceFileInfo,
  MemoryAuditLogParams,
  MemoryAuditLogResponse,
  MemoryDefaultTemplate,
  UpdateMemoryDefaultRequest,
  BundledSkillsResponse,
  BatchUpdateBundledSkillsRequest,
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

  /**
   * 获取资源使用历史
   *
   * 从 system_metrics 表查询真实历史数据，数据不足时回退到模拟生成
   */
  async getResourceHistory(period: "hour" | "day" | "week" = "hour"): Promise<ResourceHistory> {
    const response = await this.http.get<{ data: ResourceHistory }>(
      "/api/admin/monitor/resources/history",
      { period },
    );
    return (
      (response as unknown as { data: ResourceHistory }).data ??
      (response as unknown as ResourceHistory)
    );
  }

  // ============ 监控日志 API ============

  /**
   * 获取监控日志列表
   */
  async getMonitorLogs(params?: LogQueryParams): Promise<LogQueryResponse> {
    const response = await this.http.get<{ data: LogQueryResponse }>(
      "/api/admin/monitor/logs",
      params as Record<string, string | number | boolean | undefined>,
    );
    return (
      (response as unknown as { data: LogQueryResponse }).data ??
      (response as unknown as LogQueryResponse)
    );
  }

  /**
   * 获取监控日志来源列表
   */
  async getMonitorLogSources(): Promise<string[]> {
    const response = await this.http.get<{ data: string[] }>("/api/admin/monitor/logs/sources");
    return (response as unknown as { data: string[] }).data ?? (response as unknown as string[]);
  }

  /**
   * 获取日志统计信息
   *
   * 按级别和来源分组统计日志数量
   */
  async getLogStats(params?: { startTime?: string; endTime?: string }): Promise<LogStats> {
    const response = await this.http.get<{ data: LogStats }>(
      "/api/admin/monitor/logs/stats",
      params as Record<string, string | number | boolean | undefined>,
    );
    return (response as unknown as { data: LogStats }).data ?? (response as unknown as LogStats);
  }

  // ============ 监控告警 API ============

  /**
   * 获取告警列表
   */
  async getMonitorAlerts(params?: AlertListParams): Promise<AlertListResponse> {
    const response = await this.http.get<{ data: AlertListResponse }>(
      "/api/admin/monitor/alerts",
      params as Record<string, string | number | boolean | undefined>,
    );
    return (
      (response as unknown as { data: AlertListResponse }).data ??
      (response as unknown as AlertListResponse)
    );
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.http.post(`/api/admin/monitor/alerts/${alertId}/acknowledge`);
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string): Promise<void> {
    await this.http.post(`/api/admin/monitor/alerts/${alertId}/resolve`);
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

  /**
   * 测试 Embedding 配置连通性
   *
   * 使用提供的 baseUrl/apiKey/model 发送 embedding 请求验证可达性
   */
  async testEmbeddingConfig(request: TestEmbeddingRequest): Promise<EmbeddingTestResult> {
    const response = await this.http.post<{ data: EmbeddingTestResult }>(
      "/api/admin/model-providers/test-embedding",
      request,
    );
    return (
      (response as unknown as { data: EmbeddingTestResult }).data ??
      (response as unknown as EmbeddingTestResult)
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

  // ============ 数据分析 API ============

  /**
   * 获取分析概览
   */
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>("/api/admin/analytics/overview");
  }

  /**
   * 获取用户增长趋势
   */
  async getUserGrowthTrend(period?: string): Promise<UserGrowthTrendResponse> {
    return this.http.get<UserGrowthTrendResponse>("/api/admin/analytics/users/growth", { period });
  }

  /**
   * 获取用户留存分析
   */
  async getUserRetention(period?: string): Promise<RetentionAnalysisResponse> {
    return this.http.get<RetentionAnalysisResponse>("/api/admin/analytics/users/retention", {
      period,
    });
  }

  /**
   * 获取用户画像
   */
  async getUserDemographics(): Promise<UserDemographicsResponse> {
    return this.http.get<UserDemographicsResponse>("/api/admin/analytics/users/demographics");
  }

  /**
   * 获取收入趋势
   */
  async getRevenueTrend(period?: string): Promise<RevenueTrendResponse> {
    return this.http.get<RevenueTrendResponse>("/api/admin/analytics/revenue/trend", { period });
  }

  /**
   * 获取收入来源分布
   */
  async getRevenueSources(): Promise<RevenueSourcesResponse> {
    return this.http.get<RevenueSourcesResponse>("/api/admin/analytics/revenue/sources");
  }

  /**
   * 获取用户价值指标
   */
  async getUserValueMetrics(period?: string): Promise<UserValueMetricsResponse> {
    return this.http.get<UserValueMetricsResponse>("/api/admin/analytics/revenue/metrics", {
      period,
    });
  }

  /**
   * 获取技能使用分析
   */
  async getSkillUsageAnalytics(period?: string): Promise<SkillUsageAnalyticsResponse> {
    return this.http.get<SkillUsageAnalyticsResponse>("/api/admin/analytics/skills/usage", {
      period,
    });
  }

  /**
   * 获取漏斗类型列表
   */
  async getFunnelList(): Promise<FunnelType[]> {
    return this.http.get<FunnelType[]>("/api/admin/analytics/funnels");
  }

  /**
   * 获取漏斗分析
   */
  async getFunnelAnalysis(type: string, period?: string): Promise<FunnelAnalysisResponse> {
    return this.http.get<FunnelAnalysisResponse>(`/api/admin/analytics/funnels/${type}`, {
      period,
    });
  }

  // ============ 积分管理 API ============

  /**
   * 查询用户积分余额
   */
  async getCreditBalance(userId: string): Promise<CreditBalance> {
    return this.http.get<CreditBalance>(`/api/admin/credits/users/${userId}/balance`);
  }

  /**
   * 查询用户积分流水
   */
  async getCreditHistory(
    userId: string,
    params?: CreditHistoryParams,
  ): Promise<FullResponse<CreditTransaction[]>> {
    return this.http.requestFull<CreditTransaction[]>({
      method: "GET",
      url: `/api/admin/credits/users/${userId}/history`,
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * 管理员发放积分
   */
  async grantCredits(userId: string, request: GrantCreditsRequest): Promise<CreditOperationResult> {
    return this.http.post<CreditOperationResult>(
      `/api/admin/credits/users/${userId}/grant`,
      request,
    );
  }

  /**
   * 获取模型定价列表
   */
  async getModelPricingList(activeOnly?: boolean): Promise<ModelPricing[]> {
    return this.http.get<ModelPricing[]>(
      "/api/admin/credits/pricing",
      activeOnly !== undefined ? { activeOnly: String(activeOnly) } : undefined,
    );
  }

  /**
   * 获取模型定价详情
   */
  async getModelPricing(modelId: string): Promise<ModelPricing> {
    return this.http.get<ModelPricing>(`/api/admin/credits/pricing/${modelId}`);
  }

  /**
   * 创建/更新模型定价
   */
  async upsertModelPricing(modelId: string, request: UpsertModelPricingRequest): Promise<void> {
    await this.http.put(`/api/admin/credits/pricing/${modelId}`, request);
  }

  /**
   * 删除模型定价
   */
  async deleteModelPricing(modelId: string): Promise<void> {
    await this.http.delete(`/api/admin/credits/pricing/${modelId}`);
  }

  /**
   * 触发过期批次清理
   */
  async cleanupExpiredCredits(): Promise<CleanupResult> {
    return this.http.post<CleanupResult>("/api/admin/credits/cleanup");
  }

  // ============ LLM 调用日志 API ============

  /**
   * 获取 LLM 调用日志列表
   */
  async getLlmLogs(params?: LlmLogQueryParams): Promise<LlmLogListResponse> {
    return this.http.get<LlmLogListResponse>(
      "/api/admin/llm-logs",
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  /**
   * 获取 LLM 调用统计
   */
  async getLlmLogStats(params?: { startTime?: string; endTime?: string }): Promise<LlmLogStats> {
    return this.http.get<LlmLogStats>(
      "/api/admin/llm-logs/stats",
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  /**
   * 获取模型使用分布
   */
  async getLlmLogModels(params?: {
    startTime?: string;
    endTime?: string;
  }): Promise<LlmModelDistribution> {
    return this.http.get<LlmModelDistribution>(
      "/api/admin/llm-logs/models",
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  /**
   * 获取 LLM 性能指标
   */
  async getLlmLogPerformance(params?: {
    startTime?: string;
    endTime?: string;
  }): Promise<LlmPerformanceStats> {
    return this.http.get<LlmPerformanceStats>(
      "/api/admin/llm-logs/performance",
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  // ============ 用户记忆管理 API ============

  /**
   * 获取用户记忆概览
   */
  async getUserMemoryOverview(userId: string): Promise<UserMemoryOverview> {
    return this.http.get<UserMemoryOverview>(`/api/admin/users/${userId}/memory/overview`);
  }

  /**
   * 获取用户记忆事实列表
   */
  async getUserMemoryFacts(
    userId: string,
    params?: UserMemoryFactsParams,
  ): Promise<UserMemoryFactsResponse> {
    return this.http.get<UserMemoryFactsResponse>(
      `/api/admin/users/${userId}/memory/facts`,
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  /**
   * 更新用户记忆事实
   */
  async updateUserMemoryFact(
    userId: string,
    factId: string,
    data: Partial<Pick<UserMemoryFact, "value" | "confidence">>,
  ): Promise<UserMemoryFact> {
    return this.http.put<UserMemoryFact>(`/api/admin/users/${userId}/memory/facts/${factId}`, data);
  }

  /**
   * 删除用户记忆事实
   */
  async deleteUserMemoryFact(userId: string, factId: string): Promise<void> {
    return this.http.delete<void>(`/api/admin/users/${userId}/memory/facts/${factId}`);
  }

  /**
   * 获取用户偏好
   */
  async getUserMemoryPreferences(userId: string): Promise<UserMemoryPreferences | null> {
    return this.http.get<UserMemoryPreferences | null>(
      `/api/admin/users/${userId}/memory/preferences`,
    );
  }

  /**
   * 获取用户 Workspace 文件列表
   */
  async getUserWorkspaceFiles(userId: string): Promise<UserWorkspaceFileInfo[]> {
    return this.http.get<UserWorkspaceFileInfo[]>(
      `/api/admin/users/${userId}/memory/workspace-files`,
    );
  }

  /**
   * 更新用户 Workspace 文件
   */
  async updateUserWorkspaceFile(
    userId: string,
    fileName: string,
    content: string,
  ): Promise<UserWorkspaceFileInfo> {
    return this.http.put<UserWorkspaceFileInfo>(
      `/api/admin/users/${userId}/memory/workspace-files/${fileName}`,
      { content },
    );
  }

  /**
   * 重置用户 Workspace 文件为默认模板
   */
  async resetUserWorkspaceFile(userId: string, fileName: string): Promise<UserWorkspaceFileInfo> {
    return this.http.post<UserWorkspaceFileInfo>(
      `/api/admin/users/${userId}/memory/workspace-files/${fileName}/reset`,
    );
  }

  /**
   * 获取用户记忆审计日志
   */
  async getUserMemoryAuditLogs(
    userId: string,
    params?: MemoryAuditLogParams,
  ): Promise<MemoryAuditLogResponse> {
    return this.http.get<MemoryAuditLogResponse>(
      `/api/admin/users/${userId}/memory/audit-logs`,
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  // ============ 默认模板管理 API ============

  /**
   * 获取所有默认模板
   */
  async getMemoryDefaults(): Promise<MemoryDefaultTemplate[]> {
    return this.http.get<MemoryDefaultTemplate[]>("/api/admin/memory/defaults");
  }

  /**
   * 获取单个默认模板
   */
  async getMemoryDefault(key: string): Promise<MemoryDefaultTemplate> {
    return this.http.get<MemoryDefaultTemplate>(`/api/admin/memory/defaults/${key}`);
  }

  /**
   * 更新默认模板
   */
  async updateMemoryDefault(key: string, data: UpdateMemoryDefaultRequest): Promise<void> {
    return this.http.put<void>(`/api/admin/memory/defaults/${key}`, data);
  }

  /**
   * 重置所有默认模板为原始文件
   */
  async resetMemoryDefaults(): Promise<void> {
    return this.http.post<void>("/api/admin/memory/defaults/reset");
  }

  // ============ Bundled 技能管理 API ============

  /**
   * 获取所有 bundled 技能列表
   */
  async getBundledSkills(): Promise<BundledSkillsResponse> {
    return this.http.get<BundledSkillsResponse>("/api/admin/bundled-skills");
  }

  /**
   * 禁用一个 bundled 技能
   */
  async disableBundledSkill(name: string): Promise<void> {
    await this.http.put(`/api/admin/bundled-skills/${encodeURIComponent(name)}/disable`);
  }

  /**
   * 启用一个 bundled 技能
   */
  async enableBundledSkill(name: string): Promise<void> {
    await this.http.put(`/api/admin/bundled-skills/${encodeURIComponent(name)}/enable`);
  }

  /**
   * 批量更新 bundled 技能禁用列表
   */
  async batchUpdateBundledSkills(request: BatchUpdateBundledSkillsRequest): Promise<void> {
    await this.http.put("/api/admin/bundled-skills/batch", request);
  }
}

/**
 * 创建管理员 API 客户端实例
 */
export function createAdminApiClient(config: AdminApiClientConfig): AdminApiClient {
  return new AdminApiClient(config);
}
