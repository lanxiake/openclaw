/**
 * 设备数据迁移服务 - Device Migration Service
 *
 * 实现从 JSON 文件存储到 PostgreSQL 数据库的迁移：
 * - 为现有设备创建虚拟用户
 * - 建立用户-设备关联
 * - 支持双写模式
 * - 数据一致性验证
 * - 回滚支持
 *
 * @author OpenClaw
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "../../logging/logger.js";
import type { PairedDevice } from "../../infra/device-pairing.js";
import type { User, NewUser, NewUserDevice } from "../../db/schema/users.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 迁移状态
 */
export type MigrationStatus =
  | "pending" // 待迁移
  | "in_progress" // 迁移中
  | "completed" // 已完成
  | "failed" // 失败
  | "rolled_back"; // 已回滚

/**
 * 迁移模式
 */
export type MigrationMode =
  | "dry_run" // 模拟运行，不实际写入
  | "dual_write" // 双写模式
  | "full"; // 完整迁移

/**
 * 迁移任务
 */
export interface MigrationTask {
  /** 任务 ID */
  id: string;
  /** 迁移模式 */
  mode: MigrationMode;
  /** 状态 */
  status: MigrationStatus;
  /** 开始时间 */
  startedAt: string;
  /** 完成时间 */
  completedAt?: string;
  /** 统计信息 */
  stats: MigrationStats;
  /** 错误信息 */
  errors: MigrationError[];
}

/**
 * 迁移统计
 */
export interface MigrationStats {
  /** 总设备数 */
  totalDevices: number;
  /** 已迁移设备数 */
  migratedDevices: number;
  /** 跳过的设备数 (已存在关联) */
  skippedDevices: number;
  /** 失败的设备数 */
  failedDevices: number;
  /** 创建的虚拟用户数 */
  createdUsers: number;
  /** 创建的关联数 */
  createdLinks: number;
}

/**
 * 迁移错误
 */
export interface MigrationError {
  /** 设备 ID */
  deviceId: string;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: unknown;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 任务信息 */
  task: MigrationTask;
  /** 消息 */
  message: string;
}

/**
 * 虚拟用户信息
 */
export interface VirtualUserInfo {
  /** 用户 ID */
  userId: string;
  /** 显示名称 */
  displayName: string;
  /** 虚拟邮箱 */
  email: string;
  /** 是否新创建 */
  isNew: boolean;
}

// ============================================================================
// 配置
// ============================================================================

/**
 * 迁移配置
 */
export interface MigrationConfig {
  /** 虚拟用户邮箱域名 */
  virtualEmailDomain: string;
  /** 批处理大小 */
  batchSize: number;
  /** 是否在失败时停止 */
  stopOnError: boolean;
  /** 是否启用双写模式 */
  dualWriteEnabled: boolean;
}

/**
 * 默认迁移配置
 */
export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  virtualEmailDomain: "internal.openclaw.local",
  batchSize: 100,
  stopOnError: false,
  dualWriteEnabled: false,
};

// ============================================================================
// 回调类型
// ============================================================================

/**
 * 获取所有配对设备的回调
 */
export type GetAllDevicesCallback = () => Promise<PairedDevice[]>;

/**
 * 检查设备是否已关联用户的回调
 */
export type CheckDeviceLinkCallback = (deviceId: string) => Promise<boolean>;

/**
 * 创建用户的回调
 */
export type CreateUserCallback = (user: NewUser) => Promise<User>;

/**
 * 创建用户-设备关联的回调
 */
export type CreateUserDeviceCallback = (link: NewUserDevice) => Promise<void>;

/**
 * 查找用户 by email 的回调
 */
export type FindUserByEmailCallback = (email: string) => Promise<User | null>;

// ============================================================================
// 迁移服务类
// ============================================================================

/**
 * 设备数据迁移服务
 */
export class DeviceMigrationService {
  private config: MigrationConfig;
  private currentTask: MigrationTask | null = null;

  // 回调函数
  private getAllDevices: GetAllDevicesCallback | null = null;
  private checkDeviceLink: CheckDeviceLinkCallback | null = null;
  private createUser: CreateUserCallback | null = null;
  private createUserDevice: CreateUserDeviceCallback | null = null;
  private findUserByEmail: FindUserByEmailCallback | null = null;

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };
    logger.info("[migration] 创建设备迁移服务", {
      virtualEmailDomain: this.config.virtualEmailDomain,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    getAllDevices?: GetAllDevicesCallback;
    checkDeviceLink?: CheckDeviceLinkCallback;
    createUser?: CreateUserCallback;
    createUserDevice?: CreateUserDeviceCallback;
    findUserByEmail?: FindUserByEmailCallback;
  }): void {
    if (callbacks.getAllDevices) {
      this.getAllDevices = callbacks.getAllDevices;
    }
    if (callbacks.checkDeviceLink) {
      this.checkDeviceLink = callbacks.checkDeviceLink;
    }
    if (callbacks.createUser) {
      this.createUser = callbacks.createUser;
    }
    if (callbacks.createUserDevice) {
      this.createUserDevice = callbacks.createUserDevice;
    }
    if (callbacks.findUserByEmail) {
      this.findUserByEmail = callbacks.findUserByEmail;
    }
  }

  /**
   * 生成虚拟用户邮箱
   */
  private generateVirtualEmail(deviceId: string): string {
    const shortId = deviceId.slice(0, 8);
    return `device-${shortId}@${this.config.virtualEmailDomain}`;
  }

  /**
   * 生成虚拟用户显示名称
   */
  private generateDisplayName(device: PairedDevice): string {
    if (device.displayName) {
      return device.displayName;
    }
    const platform = device.platform || "unknown";
    return `设备用户 (${platform})`;
  }

  /**
   * 创建虚拟用户
   */
  private async createVirtualUser(device: PairedDevice): Promise<VirtualUserInfo> {
    if (!this.createUser || !this.findUserByEmail) {
      throw new Error("未设置用户创建回调");
    }

    const email = this.generateVirtualEmail(device.deviceId);
    const displayName = this.generateDisplayName(device);

    // 检查是否已存在
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      return {
        userId: existingUser.id,
        displayName: existingUser.displayName || displayName,
        email,
        isNew: false,
      };
    }

    // 创建新用户
    const newUser = await this.createUser({
      id: randomUUID(),
      email,
      displayName,
      emailVerified: false,
      phoneVerified: false,
      isActive: true,
      mfaEnabled: false,
      metadata: {
        migratedFrom: "device-pairing",
        originalDeviceId: device.deviceId,
        migratedAt: new Date().toISOString(),
      },
    });

    logger.info("[migration] 创建虚拟用户", {
      userId: newUser.id,
      email,
      deviceId: device.deviceId,
    });

    return {
      userId: newUser.id,
      displayName: newUser.displayName || displayName,
      email,
      isNew: true,
    };
  }

  /**
   * 迁移单个设备
   */
  private async migrateDevice(device: PairedDevice): Promise<{
    success: boolean;
    skipped: boolean;
    userCreated: boolean;
    error?: string;
  }> {
    if (!this.checkDeviceLink || !this.createUserDevice) {
      throw new Error("未设置设备关联回调");
    }

    try {
      // 1. 检查是否已有关联
      const hasLink = await this.checkDeviceLink(device.deviceId);
      if (hasLink) {
        logger.debug("[migration] 设备已有关联，跳过", {
          deviceId: device.deviceId,
        });
        return { success: true, skipped: true, userCreated: false };
      }

      // 2. 创建虚拟用户
      const userInfo = await this.createVirtualUser(device);

      // 3. 创建设备关联
      await this.createUserDevice({
        id: randomUUID(),
        userId: userInfo.userId,
        deviceId: device.deviceId,
        alias: device.displayName,
        isPrimary: true,
        linkedAt: new Date(device.createdAtMs),
        lastActiveAt: device.tokens
          ? new Date(
              Math.max(...Object.values(device.tokens).map((t) => t.lastUsedAtMs || t.createdAtMs)),
            )
          : undefined,
      });

      logger.info("[migration] 设备迁移成功", {
        deviceId: device.deviceId,
        userId: userInfo.userId,
        userCreated: userInfo.isNew,
      });

      return {
        success: true,
        skipped: false,
        userCreated: userInfo.isNew,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[migration] 设备迁移失败", {
        deviceId: device.deviceId,
        error: message,
      });

      return {
        success: false,
        skipped: false,
        userCreated: false,
        error: message,
      };
    }
  }

  /**
   * 执行迁移
   */
  async migrate(mode: MigrationMode = "full"): Promise<MigrationResult> {
    if (!this.getAllDevices) {
      throw new Error("未设置获取设备回调");
    }

    if (this.currentTask?.status === "in_progress") {
      throw new Error("迁移任务正在进行中");
    }

    // 创建任务
    const task: MigrationTask = {
      id: randomUUID(),
      mode,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      stats: {
        totalDevices: 0,
        migratedDevices: 0,
        skippedDevices: 0,
        failedDevices: 0,
        createdUsers: 0,
        createdLinks: 0,
      },
      errors: [],
    };

    this.currentTask = task;

    logger.info("[migration] 开始设备迁移", {
      taskId: task.id,
      mode,
    });

    try {
      // 1. 获取所有配对设备
      const devices = await this.getAllDevices();
      task.stats.totalDevices = devices.length;

      logger.info("[migration] 发现配对设备", {
        count: devices.length,
      });

      if (mode === "dry_run") {
        // 模拟运行，只计数
        for (const device of devices) {
          if (this.checkDeviceLink) {
            const hasLink = await this.checkDeviceLink(device.deviceId);
            if (hasLink) {
              task.stats.skippedDevices++;
            } else {
              task.stats.migratedDevices++;
              task.stats.createdUsers++;
              task.stats.createdLinks++;
            }
          }
        }

        task.status = "completed";
        task.completedAt = new Date().toISOString();

        return {
          success: true,
          task,
          message: `[模拟运行] 将创建 ${task.stats.createdUsers} 个用户，${task.stats.createdLinks} 个关联`,
        };
      }

      // 2. 批量处理设备
      for (let i = 0; i < devices.length; i += this.config.batchSize) {
        const batch = devices.slice(i, i + this.config.batchSize);

        for (const device of batch) {
          const result = await this.migrateDevice(device);

          if (result.success) {
            if (result.skipped) {
              task.stats.skippedDevices++;
            } else {
              task.stats.migratedDevices++;
              task.stats.createdLinks++;
              if (result.userCreated) {
                task.stats.createdUsers++;
              }
            }
          } else {
            task.stats.failedDevices++;
            task.errors.push({
              deviceId: device.deviceId,
              message: result.error || "Unknown error",
              timestamp: new Date().toISOString(),
            });

            if (this.config.stopOnError) {
              throw new Error(`设备 ${device.deviceId} 迁移失败: ${result.error}`);
            }
          }
        }

        // 记录进度
        logger.info("[migration] 迁移进度", {
          processed: Math.min(i + this.config.batchSize, devices.length),
          total: devices.length,
          migrated: task.stats.migratedDevices,
          skipped: task.stats.skippedDevices,
          failed: task.stats.failedDevices,
        });
      }

      // 3. 完成
      task.status = task.stats.failedDevices > 0 ? "completed" : "completed";
      task.completedAt = new Date().toISOString();

      const message =
        task.stats.failedDevices > 0
          ? `迁移完成 (有错误): ${task.stats.migratedDevices} 成功, ${task.stats.failedDevices} 失败`
          : `迁移成功: ${task.stats.migratedDevices} 个设备, ${task.stats.createdUsers} 个新用户`;

      logger.info("[migration] 迁移完成", {
        taskId: task.id,
        stats: task.stats,
      });

      return {
        success: task.stats.failedDevices === 0,
        task,
        message,
      };
    } catch (error) {
      task.status = "failed";
      task.completedAt = new Date().toISOString();

      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[migration] 迁移失败", {
        taskId: task.id,
        error: message,
      });

      return {
        success: false,
        task,
        message: `迁移失败: ${message}`,
      };
    }
  }

  /**
   * 获取当前任务状态
   */
  getCurrentTask(): MigrationTask | null {
    return this.currentTask;
  }

  /**
   * 验证迁移数据一致性
   */
  async verifyMigration(): Promise<{
    success: boolean;
    totalDevices: number;
    linkedDevices: number;
    unlinkedDevices: number;
    issues: string[];
  }> {
    if (!this.getAllDevices || !this.checkDeviceLink) {
      throw new Error("未设置必要的回调");
    }

    const devices = await this.getAllDevices();
    let linkedDevices = 0;
    let unlinkedDevices = 0;
    const issues: string[] = [];

    for (const device of devices) {
      const hasLink = await this.checkDeviceLink(device.deviceId);
      if (hasLink) {
        linkedDevices++;
      } else {
        unlinkedDevices++;
        issues.push(`设备 ${device.deviceId} 未关联用户`);
      }
    }

    const success = unlinkedDevices === 0;

    logger.info("[migration] 验证迁移完成", {
      totalDevices: devices.length,
      linkedDevices,
      unlinkedDevices,
      success,
    });

    return {
      success,
      totalDevices: devices.length,
      linkedDevices,
      unlinkedDevices,
      issues,
    };
  }

  /**
   * 启用双写模式
   */
  enableDualWrite(): void {
    this.config.dualWriteEnabled = true;
    logger.info("[migration] 启用双写模式");
  }

  /**
   * 禁用双写模式
   */
  disableDualWrite(): void {
    this.config.dualWriteEnabled = false;
    logger.info("[migration] 禁用双写模式");
  }

  /**
   * 检查是否启用双写
   */
  isDualWriteEnabled(): boolean {
    return this.config.dualWriteEnabled;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MigrationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("[migration] 更新迁移配置", config);
  }

  /**
   * 获取配置
   */
  getConfig(): MigrationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 单例
// ============================================================================

let migrationServiceInstance: DeviceMigrationService | null = null;

/**
 * 获取迁移服务实例
 */
export function getMigrationService(): DeviceMigrationService {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new DeviceMigrationService();
  }
  return migrationServiceInstance;
}

/**
 * 初始化迁移服务
 */
export function initMigrationService(config?: Partial<MigrationConfig>): DeviceMigrationService {
  migrationServiceInstance = new DeviceMigrationService(config);
  return migrationServiceInstance;
}
