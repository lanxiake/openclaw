/**
 * 双写存储适配器 - Dual Write Storage Adapter
 *
 * 在迁移过程中同时写入 JSON 文件和 PostgreSQL 数据库
 * 支持渐进式迁移，读取可以从任一来源
 *
 * @author OpenClaw
 */

import { getLogger } from "../../logging/logger.js";
import type { PairedDevice } from "../../infra/device-pairing.js";
import type { NewUserDevice, UserDevice } from "../../db/schema/users.js";
import { getMigrationService } from "./device-migration.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 存储源
 */
export type StorageSource = "json" | "postgres" | "dual";

/**
 * 读取策略
 */
export type ReadStrategy =
  | "json_primary"      // 以 JSON 为主
  | "postgres_primary"  // 以 PostgreSQL 为主
  | "merge";            // 合并两个来源

/**
 * 双写配置
 */
export interface DualWriteConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 读取策略 */
  readStrategy: ReadStrategy;
  /** 是否同步写入 (否则异步) */
  syncWrite: boolean;
  /** 写入失败是否抛出错误 */
  failOnWriteError: boolean;
}

/**
 * 默认双写配置
 */
export const DEFAULT_DUAL_WRITE_CONFIG: DualWriteConfig = {
  enabled: false,
  readStrategy: "json_primary",
  syncWrite: true,
  failOnWriteError: false,
};

// ============================================================================
// 回调类型
// ============================================================================

/**
 * JSON 存储操作回调
 */
export interface JsonStorageCallbacks {
  /** 获取所有配对设备 */
  getAllDevices: () => Promise<PairedDevice[]>;
  /** 获取单个设备 */
  getDevice: (deviceId: string) => Promise<PairedDevice | null>;
  /** 保存设备 */
  saveDevice: (device: PairedDevice) => Promise<void>;
  /** 删除设备 */
  deleteDevice: (deviceId: string) => Promise<void>;
}

/**
 * PostgreSQL 存储操作回调
 */
export interface PostgresStorageCallbacks {
  /** 获取用户设备关联 */
  getUserDeviceByDeviceId: (deviceId: string) => Promise<UserDevice | null>;
  /** 获取用户的所有设备 */
  getUserDevices: (userId: string) => Promise<UserDevice[]>;
  /** 创建用户设备关联 */
  createUserDevice: (link: NewUserDevice) => Promise<UserDevice>;
  /** 更新用户设备关联 */
  updateUserDevice: (id: string, updates: Partial<UserDevice>) => Promise<UserDevice | null>;
  /** 删除用户设备关联 */
  deleteUserDevice: (id: string) => Promise<boolean>;
  /** 根据设备 ID 删除关联 */
  deleteUserDeviceByDeviceId: (deviceId: string) => Promise<boolean>;
}

// ============================================================================
// 双写存储适配器
// ============================================================================

/**
 * 双写存储适配器
 */
export class DualWriteStorageAdapter {
  private config: DualWriteConfig;
  private jsonCallbacks: JsonStorageCallbacks | null = null;
  private postgresCallbacks: PostgresStorageCallbacks | null = null;

  constructor(config: Partial<DualWriteConfig> = {}) {
    this.config = { ...DEFAULT_DUAL_WRITE_CONFIG, ...config };
    logger.info("[dual-write] 创建双写存储适配器", {
      enabled: this.config.enabled,
      readStrategy: this.config.readStrategy,
    });
  }

  /**
   * 设置 JSON 存储回调
   */
  setJsonCallbacks(callbacks: JsonStorageCallbacks): void {
    this.jsonCallbacks = callbacks;
  }

  /**
   * 设置 PostgreSQL 存储回调
   */
  setPostgresCallbacks(callbacks: PostgresStorageCallbacks): void {
    this.postgresCallbacks = callbacks;
  }

  /**
   * 启用双写
   */
  enable(): void {
    this.config.enabled = true;
    getMigrationService().enableDualWrite();
    logger.info("[dual-write] 双写模式已启用");
  }

  /**
   * 禁用双写
   */
  disable(): void {
    this.config.enabled = false;
    getMigrationService().disableDualWrite();
    logger.info("[dual-write] 双写模式已禁用");
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 设置读取策略
   */
  setReadStrategy(strategy: ReadStrategy): void {
    this.config.readStrategy = strategy;
    logger.info("[dual-write] 更新读取策略", { strategy });
  }

  /**
   * 写入设备数据
   *
   * 在双写模式下同时写入两个存储
   */
  async writeDevice(
    device: PairedDevice,
    userDeviceLink?: NewUserDevice
  ): Promise<void> {
    if (!this.config.enabled) {
      // 非双写模式，只写 JSON
      if (this.jsonCallbacks) {
        await this.jsonCallbacks.saveDevice(device);
      }
      return;
    }

    const writeJson = async () => {
      if (this.jsonCallbacks) {
        try {
          await this.jsonCallbacks.saveDevice(device);
          logger.debug("[dual-write] JSON 写入成功", {
            deviceId: device.deviceId,
          });
        } catch (error) {
          logger.error("[dual-write] JSON 写入失败", {
            deviceId: device.deviceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          if (this.config.failOnWriteError) {
            throw error;
          }
        }
      }
    };

    const writePostgres = async () => {
      if (this.postgresCallbacks && userDeviceLink) {
        try {
          // 检查是否已存在
          const existing = await this.postgresCallbacks.getUserDeviceByDeviceId(
            device.deviceId
          );
          if (existing) {
            // 更新
            await this.postgresCallbacks.updateUserDevice(existing.id, {
              alias: device.displayName,
              lastActiveAt: new Date(),
            });
          } else {
            // 创建
            await this.postgresCallbacks.createUserDevice(userDeviceLink);
          }
          logger.debug("[dual-write] PostgreSQL 写入成功", {
            deviceId: device.deviceId,
          });
        } catch (error) {
          logger.error("[dual-write] PostgreSQL 写入失败", {
            deviceId: device.deviceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          if (this.config.failOnWriteError) {
            throw error;
          }
        }
      }
    };

    if (this.config.syncWrite) {
      // 同步写入
      await Promise.all([writeJson(), writePostgres()]);
    } else {
      // 异步写入 (先写 JSON，后台写 PostgreSQL)
      await writeJson();
      writePostgres().catch((error) => {
        logger.error("[dual-write] 异步 PostgreSQL 写入失败", {
          deviceId: device.deviceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }
  }

  /**
   * 删除设备数据
   */
  async deleteDevice(deviceId: string): Promise<void> {
    if (!this.config.enabled) {
      // 非双写模式，只删除 JSON
      if (this.jsonCallbacks) {
        await this.jsonCallbacks.deleteDevice(deviceId);
      }
      return;
    }

    const deleteJson = async () => {
      if (this.jsonCallbacks) {
        try {
          await this.jsonCallbacks.deleteDevice(deviceId);
          logger.debug("[dual-write] JSON 删除成功", { deviceId });
        } catch (error) {
          logger.error("[dual-write] JSON 删除失败", {
            deviceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          if (this.config.failOnWriteError) {
            throw error;
          }
        }
      }
    };

    const deletePostgres = async () => {
      if (this.postgresCallbacks) {
        try {
          await this.postgresCallbacks.deleteUserDeviceByDeviceId(deviceId);
          logger.debug("[dual-write] PostgreSQL 删除成功", { deviceId });
        } catch (error) {
          logger.error("[dual-write] PostgreSQL 删除失败", {
            deviceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          if (this.config.failOnWriteError) {
            throw error;
          }
        }
      }
    };

    if (this.config.syncWrite) {
      await Promise.all([deleteJson(), deletePostgres()]);
    } else {
      await deleteJson();
      deletePostgres().catch((error) => {
        logger.error("[dual-write] 异步 PostgreSQL 删除失败", {
          deviceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }
  }

  /**
   * 读取设备数据
   *
   * 根据读取策略从不同来源读取
   */
  async readDevice(deviceId: string): Promise<{
    device: PairedDevice | null;
    userDevice: UserDevice | null;
    source: StorageSource;
  }> {
    let device: PairedDevice | null = null;
    let userDevice: UserDevice | null = null;
    let source: StorageSource = "json";

    switch (this.config.readStrategy) {
      case "json_primary":
        // 以 JSON 为主
        if (this.jsonCallbacks) {
          device = await this.jsonCallbacks.getDevice(deviceId);
        }
        if (this.postgresCallbacks) {
          userDevice = await this.postgresCallbacks.getUserDeviceByDeviceId(deviceId);
        }
        source = "json";
        break;

      case "postgres_primary":
        // 以 PostgreSQL 为主
        if (this.postgresCallbacks) {
          userDevice = await this.postgresCallbacks.getUserDeviceByDeviceId(deviceId);
        }
        if (this.jsonCallbacks) {
          device = await this.jsonCallbacks.getDevice(deviceId);
        }
        source = userDevice ? "postgres" : "json";
        break;

      case "merge":
        // 合并两个来源
        const [jsonResult, postgresResult] = await Promise.all([
          this.jsonCallbacks?.getDevice(deviceId) ?? null,
          this.postgresCallbacks?.getUserDeviceByDeviceId(deviceId) ?? null,
        ]);
        device = jsonResult;
        userDevice = postgresResult;
        source = "dual";
        break;
    }

    return { device, userDevice, source };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DualWriteConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("[dual-write] 更新配置", config);
  }

  /**
   * 获取配置
   */
  getConfig(): DualWriteConfig {
    return { ...this.config };
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    jsonDeviceCount: number;
    postgresLinkCount: number;
    syncStatus: "synced" | "partial" | "not_synced";
  }> {
    let jsonDeviceCount = 0;
    let postgresLinkCount = 0;

    if (this.jsonCallbacks) {
      const devices = await this.jsonCallbacks.getAllDevices();
      jsonDeviceCount = devices.length;
    }

    // PostgreSQL 统计需要单独查询

    let syncStatus: "synced" | "partial" | "not_synced" = "not_synced";
    if (jsonDeviceCount === postgresLinkCount) {
      syncStatus = "synced";
    } else if (postgresLinkCount > 0) {
      syncStatus = "partial";
    }

    return {
      jsonDeviceCount,
      postgresLinkCount,
      syncStatus,
    };
  }
}

// ============================================================================
// 单例
// ============================================================================

let dualWriteAdapterInstance: DualWriteStorageAdapter | null = null;

/**
 * 获取双写适配器实例
 */
export function getDualWriteAdapter(): DualWriteStorageAdapter {
  if (!dualWriteAdapterInstance) {
    dualWriteAdapterInstance = new DualWriteStorageAdapter();
  }
  return dualWriteAdapterInstance;
}

/**
 * 初始化双写适配器
 */
export function initDualWriteAdapter(
  config?: Partial<DualWriteConfig>
): DualWriteStorageAdapter {
  dualWriteAdapterInstance = new DualWriteStorageAdapter(config);
  return dualWriteAdapterInstance;
}
