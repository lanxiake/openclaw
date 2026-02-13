/**
 * 用户端 API 类型定义
 *
 * 定义用户相关的请求/响应类型
 */

import type { PaginationMeta, PaginationParams } from "../types.js";

// ============ 用户信息 ============

/**
 * 当前用户信息
 */
export interface CurrentUser {
  id: string;
  phone?: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  type: string;
}

/**
 * 更新用户信息请求
 */
export interface UpdateUserRequest {
  displayName?: string;
  avatar?: string;
}

// ============ 设备管理 ============

/**
 * 用户设备
 */
export interface UserDevice {
  id: string;
  deviceId: string;
  alias?: string;
  platform?: string;
  lastActiveAt?: string;
  createdAt: string;
}

/**
 * 设备列表响应
 */
export interface DeviceListResponse {
  data: UserDevice[];
  meta: {
    total: number;
    quota: number;
  };
}

// ============ 订阅信息 ============

/**
 * 用户订阅
 */
export interface UserSubscription {
  id: string;
  planId: string;
  status: "active" | "expired" | "cancelled" | "pending";
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
}

/**
 * 订阅套餐
 */
export interface UserPlan {
  id: string;
  code: string;
  name: string;
  tokensPerMonth: number;
  storageMb: number;
  maxDevices: number;
  features?: Record<string, unknown>;
}

/**
 * 订阅信息响应
 */
export interface SubscriptionInfoResponse {
  subscription: UserSubscription | null;
  plan: UserPlan | null;
}

// ============ 使用量 ============

/**
 * 使用量统计
 */
export interface UsageStats {
  tokensUsed: number;
  tokensLimit: number;
  messagesCount: number;
  storageUsed: number;
  storageLimit: number;
}

/**
 * 使用量响应
 */
export interface UsageResponse {
  daily: UsageStats;
  monthly: UsageStats;
}

// ============ 对话 ============

/**
 * 对话
 */
export interface Conversation {
  id: string;
  title?: string;
  channelType: string;
  lastMessageAt?: string;
  messageCount: number;
  createdAt: string;
}

/**
 * 对话列表查询参数
 */
export interface ConversationListParams extends PaginationParams {
  channelType?: string;
}

/**
 * 对话列表响应
 */
export interface ConversationListResponse {
  data: Conversation[];
  meta: PaginationMeta;
}

/**
 * 对话消息
 */
export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * 消息列表响应
 */
export interface MessageListResponse {
  data: Message[];
  meta: PaginationMeta;
}

// ============ 记忆 ============

/**
 * 记忆
 */
export interface Memory {
  id: string;
  content: string;
  type: "fact" | "preference" | "context" | "note";
  importance: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 记忆列表查询参数
 */
export interface MemoryListParams extends PaginationParams {
  type?: string;
  search?: string;
}

/**
 * 记忆列表响应
 */
export interface MemoryListResponse {
  data: Memory[];
  meta: PaginationMeta;
}

/**
 * 创建记忆请求
 */
export interface CreateMemoryRequest {
  content: string;
  type?: "fact" | "preference" | "context" | "note";
  importance?: number;
}

// ============ 助手配置 ============

/**
 * 助手配置
 */
export interface AssistantConfig {
  id: string;
  name: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 更新助手配置请求
 */
export interface UpdateAssistantConfigRequest {
  name?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault?: boolean;
}

// ============ 技能 ============

/**
 * 用户已安装技能
 */
export interface InstalledSkill {
  id: string;
  skillId: string;
  name: string;
  description?: string;
  version: string;
  isEnabled: boolean;
  installedAt: string;
}

/**
 * 技能商店项
 */
export interface StoreSkill {
  id: string;
  name: string;
  description?: string;
  version: string;
  categoryId?: string;
  categoryName?: string;
  authorName?: string;
  subscriptionLevel: "free" | "basic" | "pro" | "enterprise";
  iconUrl?: string;
  downloadCount: number;
  rating: number;
  isFeatured: boolean;
}

/**
 * 技能商店查询参数
 */
export interface StoreSkillListParams extends PaginationParams {
  search?: string;
  categoryId?: string;
  subscriptionLevel?: string;
  featured?: boolean;
}

/**
 * 技能商店响应
 */
export interface StoreSkillListResponse {
  data: StoreSkill[];
  meta: PaginationMeta;
}

// ============ 文件 ============

/**
 * 用户文件
 */
export interface UserFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  createdAt: string;
}

/**
 * 文件列表响应
 */
export interface FileListResponse {
  data: UserFile[];
  meta: PaginationMeta;
}

/**
 * 上传 URL 响应
 */
export interface UploadUrlResponse {
  uploadUrl: string;
  fileId: string;
  expiresAt: string;
}
