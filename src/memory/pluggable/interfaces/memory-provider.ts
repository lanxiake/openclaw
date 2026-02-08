/**
 * 记忆提供者基础接口
 *
 * 所有记忆实现必须实现此接口。
 * 该接口定义了记忆提供者的生命周期和健康检查方法。
 *
 * @module memory/pluggable/interfaces
 */

/**
 * 健康状态枚举
 */
export type HealthStatusLevel = "healthy" | "degraded" | "unhealthy";

/**
 * 健康检查结果
 */
export interface HealthStatus {
  /** 健康状态 */
  status: HealthStatusLevel;
  /** 响应延迟（毫秒） */
  latency: number;
  /** 可选的状态消息 */
  message?: string;
  /** 额外的详情信息 */
  details?: Record<string, unknown>;
}

/**
 * 提供者配置
 */
export interface ProviderConfig {
  /** 提供者名称（如 mem0, redis, postgres） */
  provider: string;
  /** 提供者特定的配置选项 */
  options: Record<string, unknown>;
}

/**
 * 记忆提供者基础接口
 *
 * 所有记忆类型的提供者都必须实现此接口。
 * 提供了统一的生命周期管理和健康检查能力。
 *
 * @example
 * ```typescript
 * class MyMemoryProvider implements IMemoryProvider {
 *   readonly name = 'my-provider'
 *   readonly version = '1.0.0'
 *
 *   async initialize(): Promise<void> {
 *     // 初始化连接、创建表等
 *   }
 *
 *   async shutdown(): Promise<void> {
 *     // 释放资源、关闭连接
 *   }
 *
 *   async healthCheck(): Promise<HealthStatus> {
 *     return { status: 'healthy', latency: 10 }
 *   }
 * }
 * ```
 */
export interface IMemoryProvider {
  /**
   * 提供者名称
   *
   * 唯一标识符，用于工厂注册和日志输出
   */
  readonly name: string;

  /**
   * 提供者版本
   *
   * 语义化版本号，用于兼容性检查
   */
  readonly version: string;

  /**
   * 初始化提供者
   *
   * 建立连接、创建必要的表/索引、验证配置等。
   * 初始化失败应抛出错误。
   *
   * @throws Error 初始化失败时抛出
   */
  initialize(): Promise<void>;

  /**
   * 关闭提供者
   *
   * 释放所有资源、关闭连接、清理状态。
   * 应确保优雅关闭，不丢失数据。
   */
  shutdown(): Promise<void>;

  /**
   * 健康检查
   *
   * 检查提供者的运行状态，包括：
   * - 连接是否正常
   * - 依赖服务是否可用
   * - 资源是否充足
   *
   * @returns 健康状态信息
   */
  healthCheck(): Promise<HealthStatus>;
}

/**
 * 提供者构造函数类型
 *
 * 用于工厂模式创建提供者实例
 */
export type ProviderConstructor<T extends IMemoryProvider = IMemoryProvider> = new (
  options: Record<string, unknown>,
) => T;
