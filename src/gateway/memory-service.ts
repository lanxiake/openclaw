/**
 * Gateway 记忆服务集成
 *
 * 为 Gateway 提供统一的记忆管理服务，集成可插拔记忆系统。
 * 该模块作为 Gateway 与记忆系统之间的桥梁，提供：
 *
 * 1. 记忆管理器的生命周期管理
 * 2. 与现有 MemoryIndexManager 的集成
 * 3. RPC 方法的记忆操作支持
 *
 * @module gateway/memory-service
 */

import type { OpenClawConfig } from "../config/config.js";
import {
  type MemoryManager,
  type MemoryManagerConfig,
  type MemoryHealthReport,
  createMemoryManager,
  DEFAULT_DEV_CONFIG,
} from "../memory/pluggable/index.js";
import { SQLiteKnowledgeMemoryAdapter } from "../memory/pluggable/providers/knowledge/sqlite-adapter.js";
import { getMemorySearchManager } from "../memory/search-manager.js";

/**
 * Gateway 记忆服务配置
 */
export interface GatewayMemoryServiceConfig {
  /**
   * OpenClaw 配置
   */
  openclawConfig: OpenClawConfig;

  /**
   * Agent ID
   */
  agentId: string;

  /**
   * 记忆管理器配置
   * 如果未提供，将使用默认开发配置
   */
  memoryConfig?: MemoryManagerConfig;

  /**
   * 是否使用 SQLite 适配器作为知识记忆后端
   * 默认为 true，这将复用现有的 MemoryIndexManager
   */
  useSQLiteKnowledge?: boolean;

  /**
   * 健康检查间隔（毫秒）
   * 0 表示禁用自动健康检查
   */
  healthCheckInterval?: number;
}

/**
 * Gateway 记忆服务状态
 */
export type GatewayMemoryServiceStatus =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "degraded"
  | "shutdown";

/**
 * Gateway 记忆服务
 *
 * 为 Gateway 提供统一的记忆管理服务。
 *
 * @example
 * ```typescript
 * const service = new GatewayMemoryService({
 *   openclawConfig: config,
 *   agentId: 'main',
 *   useSQLiteKnowledge: true,
 * })
 *
 * await service.initialize()
 *
 * // 使用工作记忆
 * const sessionId = await service.manager.working.createSession('user-123')
 *
 * // 使用知识记忆（通过 SQLite 适配器）
 * const results = await service.manager.knowledge.searchHybrid('user-123', '查询')
 *
 * // 健康检查
 * const health = await service.healthCheck()
 *
 * await service.shutdown()
 * ```
 */
export class GatewayMemoryService {
  /** 服务状态 */
  private _status: GatewayMemoryServiceStatus = "uninitialized";

  /** 配置 */
  private readonly config: GatewayMemoryServiceConfig;

  /** 记忆管理器 */
  private _manager: MemoryManager | null = null;

  /** SQLite 知识适配器 */
  private sqliteAdapter: SQLiteKnowledgeMemoryAdapter | null = null;

  /**
   * 创建 Gateway 记忆服务
   */
  constructor(config: GatewayMemoryServiceConfig) {
    this.config = {
      useSQLiteKnowledge: true,
      healthCheckInterval: 0,
      ...config,
    };

    console.log("[GatewayMemoryService] 创建记忆服务");
  }

  // ==================== 状态访问 ====================

  /**
   * 获取服务状态
   */
  get status(): GatewayMemoryServiceStatus {
    return this._status;
  }

  /**
   * 获取记忆管理器
   */
  get manager(): MemoryManager {
    if (!this._manager) {
      throw new Error("GatewayMemoryService 未初始化");
    }
    return this._manager;
  }

  /**
   * 检查服务是否就绪
   */
  get isReady(): boolean {
    return this._status === "ready" || this._status === "degraded";
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化记忆服务
   */
  async initialize(): Promise<void> {
    if (this._status === "ready" || this._status === "initializing") {
      console.log("[GatewayMemoryService] 已初始化或正在初始化");
      return;
    }

    console.log("[GatewayMemoryService] 开始初始化...");
    this._status = "initializing";

    try {
      // 构建记忆管理器配置
      let memoryConfig = this.config.memoryConfig ?? { ...DEFAULT_DEV_CONFIG };

      // 如果启用 SQLite 知识适配器，替换知识记忆提供者
      if (this.config.useSQLiteKnowledge) {
        console.log("[GatewayMemoryService] 启用 SQLite 知识适配器");

        // 创建 SQLite 适配器
        this.sqliteAdapter = new SQLiteKnowledgeMemoryAdapter({
          openclawConfig: this.config.openclawConfig,
          agentId: this.config.agentId,
        });

        // 先初始化适配器
        await this.sqliteAdapter.initialize();

        // 更新配置使用 SQLite 适配器
        memoryConfig = {
          ...memoryConfig,
          knowledge: {
            provider: "sqlite",
            options: {
              indexManager: this.sqliteAdapter,
            },
          },
        };
      }

      // 创建记忆管理器
      this._manager = createMemoryManager({
        config: memoryConfig,
        autoInitialize: false,
        healthCheckInterval: this.config.healthCheckInterval,
        onHealthCheck: (report) => {
          console.log("[GatewayMemoryService] 健康检查:", report.status);
        },
      });

      // 初始化管理器
      await this._manager.initialize();

      this._status = "ready";
      console.log("[GatewayMemoryService] 初始化完成");
    } catch (error) {
      this._status = "degraded";
      console.error("[GatewayMemoryService] 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 关闭记忆服务
   */
  async shutdown(): Promise<void> {
    if (this._status === "shutdown") {
      console.log("[GatewayMemoryService] 已关闭");
      return;
    }

    console.log("[GatewayMemoryService] 开始关闭...");

    // 关闭记忆管理器
    if (this._manager) {
      await this._manager.shutdown();
      this._manager = null;
    }

    // 关闭 SQLite 适配器
    if (this.sqliteAdapter) {
      await this.sqliteAdapter.shutdown();
      this.sqliteAdapter = null;
    }

    this._status = "shutdown";
    console.log("[GatewayMemoryService] 已关闭");
  }

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<MemoryHealthReport> {
    if (!this._manager) {
      return {
        status: "uninitialized",
        providers: {},
        checkedAt: new Date(),
      };
    }

    return this._manager.healthCheck();
  }

  // ==================== 便捷方法 ====================

  /**
   * 创建会话
   *
   * @param userId - 用户 ID
   * @returns 会话 ID
   */
  async createSession(userId: string): Promise<string> {
    return this.manager.working.createSession(userId);
  }

  /**
   * 添加消息到会话
   *
   * @param sessionId - 会话 ID
   * @param role - 消息角色
   * @param content - 消息内容
   */
  async addMessage(
    sessionId: string,
    role: "user" | "assistant" | "system" | "tool",
    content: string,
  ): Promise<void> {
    await this.manager.working.addMessage(sessionId, {
      role,
      content,
    });
  }

  /**
   * 搜索知识库
   *
   * @param userId - 用户 ID
   * @param query - 搜索查询
   * @param limit - 最大返回数量
   */
  async searchKnowledge(
    userId: string,
    query: string,
    limit = 10,
  ): Promise<
    Array<{
      id: string;
      content: string;
      score: number;
    }>
  > {
    const results = await this.manager.knowledge.searchHybrid(userId, query, {
      limit,
    });

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.score,
    }));
  }

  /**
   * 添加用户事实
   *
   * @param userId - 用户 ID
   * @param category - 事实类别
   * @param key - 事实键
   * @param value - 事实值
   * @param confidence - 置信度
   */
  async addUserFact(
    userId: string,
    category:
      | "personal"
      | "work"
      | "hobby"
      | "skill"
      | "relationship"
      | "health"
      | "finance"
      | "other",
    key: string,
    value: string,
    confidence = 0.8,
  ): Promise<string> {
    return this.manager.profile.addFact(userId, {
      category,
      key,
      value,
      confidence,
      source: "inferred",
      sensitive: false,
    });
  }

  /**
   * 记录关键事件
   *
   * @param userId - 用户 ID
   * @param type - 事件类型
   * @param description - 事件描述
   * @param sessionId - 相关会话 ID
   */
  async recordEvent(
    userId: string,
    type:
      | "task_completed"
      | "preference_changed"
      | "important_info"
      | "milestone"
      | "decision"
      | "error"
      | "feedback",
    description: string,
    sessionId?: string,
  ): Promise<void> {
    await this.manager.episodic.addKeyEvent(userId, {
      type,
      description,
      context: "",
      importance: 0.5,
      relatedSessions: sessionId ? [sessionId] : [],
      timestamp: new Date(),
    });
  }
}

// ==================== 单例管理 ====================

let globalMemoryService: GatewayMemoryService | null = null;

/**
 * 获取全局记忆服务实例
 *
 * @param config - 配置（首次调用时必须提供）
 * @returns 记忆服务实例
 */
export function getGatewayMemoryService(config?: GatewayMemoryServiceConfig): GatewayMemoryService {
  if (!globalMemoryService) {
    if (!config) {
      throw new Error("首次调用必须提供配置");
    }
    globalMemoryService = new GatewayMemoryService(config);
  }
  return globalMemoryService;
}

/**
 * 初始化全局记忆服务
 *
 * @param config - 配置
 * @returns 初始化后的记忆服务
 */
export async function initializeGatewayMemoryService(
  config: GatewayMemoryServiceConfig,
): Promise<GatewayMemoryService> {
  const service = getGatewayMemoryService(config);
  await service.initialize();
  return service;
}

/**
 * 关闭全局记忆服务
 */
export async function shutdownGatewayMemoryService(): Promise<void> {
  if (globalMemoryService) {
    await globalMemoryService.shutdown();
    globalMemoryService = null;
  }
}

/**
 * 重置全局记忆服务（用于测试）
 */
export function resetGatewayMemoryService(): void {
  globalMemoryService = null;
}
