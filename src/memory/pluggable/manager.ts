/**
 * 记忆管理器
 *
 * 统一管理所有记忆提供者，提供生命周期管理、健康检查和便捷访问接口。
 *
 * @module memory/pluggable/manager
 */

import type {
  HealthStatus,
  IMemoryProvider,
  ProviderConfig,
} from "./interfaces/memory-provider.js";
import type { IEpisodicMemoryProvider } from "./interfaces/episodic-memory.js";
import type { IProfileMemoryProvider } from "./interfaces/profile-memory.js";
import type { IKnowledgeMemoryProvider } from "./interfaces/knowledge-memory.js";
import type { MemoryManagerConfig } from "./config/schema.js";
import {
  createEpisodicMemoryProvider,
  createProfileMemoryProvider,
  createKnowledgeMemoryProvider,
} from "./providers/factory.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const logger = createSubsystemLogger("memory/manager");

/**
 * 记忆管理器状态
 */
export type MemoryManagerStatus =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "degraded"
  | "shutdown";

/**
 * 健康检查结果
 */
export interface MemoryHealthReport {
  /** 总体状态 */
  status: MemoryManagerStatus;
  /** 各提供者状态 */
  providers: {
    episodic?: HealthStatus;
    profile?: HealthStatus;
    knowledge?: HealthStatus;
  };
  /** 检查时间 */
  checkedAt: Date;
}

/**
 * 记忆管理器配置选项
 */
export interface MemoryManagerOptions {
  /** 配置 */
  config: MemoryManagerConfig;
  /** 是否自动初始化 */
  autoInitialize?: boolean;
  /** 健康检查间隔（毫秒），0 表示禁用 */
  healthCheckInterval?: number;
  /** 健康检查回调 */
  onHealthCheck?: (report: MemoryHealthReport) => void;
}

/**
 * 记忆管理器
 *
 * 提供统一的记忆系统入口，管理所有提供者的生命周期。
 *
 * @example
 * ```typescript
 * const manager = new MemoryManager({
 *   config: DEFAULT_DEV_CONFIG,
 *   autoInitialize: false,
 * })
 *
 * await manager.initialize()
 *
 * // 使用情节记忆
 * await manager.episodic.addConversation('user-123', 'session-1', messages)
 *
 * // 健康检查
 * const health = await manager.healthCheck()
 * logger.info('状态:', health.status)
 *
 * await manager.shutdown()
 * ```
 */
export class MemoryManager {
  /** 管理器状态 */
  private _status: MemoryManagerStatus = "uninitialized";

  /** 配置 */
  private readonly config: MemoryManagerConfig;

  /** 健康检查间隔 */
  private readonly healthCheckInterval: number;

  /** 健康检查回调 */
  private readonly onHealthCheck?: (report: MemoryHealthReport) => void;

  /** 健康检查定时器 */
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  /** 情节记忆提供者 */
  private _episodic?: IEpisodicMemoryProvider;

  /** 画像记忆提供者 */
  private _profile?: IProfileMemoryProvider;

  /** 知识记忆提供者 */
  private _knowledge?: IKnowledgeMemoryProvider;

  /**
   * 创建记忆管理器
   *
   * @param options - 配置选项
   */
  constructor(options: MemoryManagerOptions) {
    this.config = options.config;
    this.healthCheckInterval = options.healthCheckInterval ?? 0;
    this.onHealthCheck = options.onHealthCheck;

    logger.info("创建记忆管理器");

    // 自动初始化
    if (options.autoInitialize) {
      // 延迟初始化，避免构造函数中的异步操作
      setTimeout(() => {
        this.initialize().catch((err) => {
          logger.error("自动初始化失败", { error: String(err) });
        });
      }, 0);
    }
  }

  // ==================== 状态访问 ====================

  /**
   * 获取管理器状态
   */
  get status(): MemoryManagerStatus {
    return this._status;
  }

  /**
   * 获取情节记忆提供者
   */
  get episodic(): IEpisodicMemoryProvider {
    this.ensureReady("episodic");
    return this._episodic!;
  }

  /**
   * 获取画像记忆提供者
   */
  get profile(): IProfileMemoryProvider {
    this.ensureReady("profile");
    return this._profile!;
  }

  /**
   * 获取知识记忆提供者
   */
  get knowledge(): IKnowledgeMemoryProvider {
    this.ensureReady("knowledge");
    return this._knowledge!;
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化所有提供者
   */
  async initialize(): Promise<void> {
    if (this._status === "ready") {
      logger.info("已经初始化");
      return;
    }

    if (this._status === "initializing") {
      logger.info("正在初始化中...");
      return;
    }

    logger.info("开始初始化...");
    this._status = "initializing";

    try {
      // 创建并初始化所有提供者
      await Promise.all([
        this.initializeProvider("episodic", this.config.episodic),
        this.initializeProvider("profile", this.config.profile),
        this.initializeProvider("knowledge", this.config.knowledge),
      ]);

      this._status = "ready";
      logger.info("初始化完成");

      // 启动健康检查
      if (this.healthCheckInterval > 0) {
        this.startHealthCheck();
      }
    } catch (error) {
      this._status = "degraded";
      logger.error("初始化失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 初始化单个提供者
   */
  private async initializeProvider(
    type: "episodic" | "profile" | "knowledge",
    config: ProviderConfig,
  ): Promise<void> {
    logger.info(`初始化 ${type} 提供者: ${config.provider}`);

    try {
      let provider: IMemoryProvider;

      switch (type) {
        case "episodic":
          provider = createEpisodicMemoryProvider(config);
          this._episodic = provider as IEpisodicMemoryProvider;
          break;
        case "profile":
          provider = createProfileMemoryProvider(config);
          this._profile = provider as IProfileMemoryProvider;
          break;
        case "knowledge":
          provider = createKnowledgeMemoryProvider(config);
          this._knowledge = provider as IKnowledgeMemoryProvider;
          break;
      }

      await provider.initialize();
      logger.info(`${type} 提供者初始化成功`);
    } catch (error) {
      logger.error(`${type} 提供者初始化失败`, { error: String(error) });
      throw error;
    }
  }

  /**
   * 关闭所有提供者
   */
  async shutdown(): Promise<void> {
    if (this._status === "shutdown") {
      logger.info("已经关闭");
      return;
    }

    logger.info("开始关闭...");

    // 停止健康检查
    this.stopHealthCheck();

    // 关闭所有提供者
    const shutdownTasks: Promise<void>[] = [];

    if (this._episodic) {
      shutdownTasks.push(
        this._episodic.shutdown().catch((e) => {
          logger.error("episodic 提供者关闭失败", { error: String(e) });
        }),
      );
    }
    if (this._profile) {
      shutdownTasks.push(
        this._profile.shutdown().catch((e) => {
          logger.error("profile 提供者关闭失败", { error: String(e) });
        }),
      );
    }
    if (this._knowledge) {
      shutdownTasks.push(
        this._knowledge.shutdown().catch((e) => {
          logger.error("knowledge 提供者关闭失败", { error: String(e) });
        }),
      );
    }
    await Promise.all(shutdownTasks);

    this._status = "shutdown";
    logger.info("已关闭");
  }

  // ==================== 健康检查 ====================

  /**
   * 执行健康检查
   */
  async healthCheck(): Promise<MemoryHealthReport> {
    const providers: MemoryHealthReport["providers"] = {};

    // 并行检查所有提供者
    const [episodic, profile, knowledge] = await Promise.all([
      this._episodic?.healthCheck().catch((e) => ({
        status: "unhealthy" as const,
        latency: 0,
        details: { error: String(e) },
      })),
      this._profile?.healthCheck().catch((e) => ({
        status: "unhealthy" as const,
        latency: 0,
        details: { error: String(e) },
      })),
      this._knowledge?.healthCheck().catch((e) => ({
        status: "unhealthy" as const,
        latency: 0,
        details: { error: String(e) },
      })),
    ]);

    if (episodic) providers.episodic = episodic;
    if (profile) providers.profile = profile;
    if (knowledge) providers.knowledge = knowledge;

    // 判断总体状态
    const allHealthy = Object.values(providers).every((p) => p?.status === "healthy");
    const allUnhealthy = Object.values(providers).every((p) => p?.status === "unhealthy");

    let status: MemoryManagerStatus;
    if (this._status === "shutdown") {
      status = "shutdown";
    } else if (allHealthy) {
      status = "ready";
    } else if (allUnhealthy) {
      status = "degraded";
    } else {
      status = "degraded";
    }

    return {
      status,
      providers,
      checkedAt: new Date(),
    };
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;

    logger.debug("启动健康检查", { interval: this.healthCheckInterval });

    this.healthCheckTimer = setInterval(async () => {
      try {
        const report = await this.healthCheck();

        // 更新状态
        if (report.status !== this._status && this._status !== "shutdown") {
          logger.info("状态变更", { from: this._status, to: report.status });
          this._status = report.status;
        }

        // 回调
        this.onHealthCheck?.(report);
      } catch (error) {
        logger.error("健康检查失败", { error: String(error) });
      }
    }, this.healthCheckInterval);
  }

  /**
   * 停止健康检查定时器
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      logger.debug("停止健康检查");
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 确保管理器已就绪
   */
  private ensureReady(providerName: string): void {
    if (this._status === "uninitialized") {
      throw new Error(`MemoryManager 未初始化，无法访问 ${providerName} 提供者`);
    }
    if (this._status === "shutdown") {
      throw new Error(`MemoryManager 已关闭，无法访问 ${providerName} 提供者`);
    }
  }
}

/**
 * 创建记忆管理器
 *
 * @param options - 配置选项
 * @returns 记忆管理器实例
 */
export function createMemoryManager(options: MemoryManagerOptions): MemoryManager {
  return new MemoryManager(options);
}
