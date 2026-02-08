/**
 * 数据迁移回滚服务 - Migration Rollback Service
 *
 * 提供数据迁移的回滚功能：
 * - 删除迁移创建的虚拟用户
 * - 删除用户-设备关联
 * - 恢复到 JSON 存储模式
 * - 记录回滚操作
 *
 * @author OpenClaw
 */

import { randomUUID } from "node:crypto";
import { getLogger } from "../../logging/logger.js";
import type { User, UserDevice } from "../../db/schema/users.js";

const logger = getLogger();

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 回滚状态
 */
export type RollbackStatus =
  | "pending"     // 待回滚
  | "in_progress" // 回滚中
  | "completed"   // 已完成
  | "failed";     // 失败

/**
 * 回滚类型
 */
export type RollbackType =
  | "full"        // 完整回滚
  | "partial"     // 部分回滚 (指定用户/设备)
  | "dry_run";    // 模拟运行

/**
 * 回滚任务
 */
export interface RollbackTask {
  /** 任务 ID */
  id: string;
  /** 回滚类型 */
  type: RollbackType;
  /** 状态 */
  status: RollbackStatus;
  /** 开始时间 */
  startedAt: string;
  /** 完成时间 */
  completedAt?: string;
  /** 回滚原因 */
  reason?: string;
  /** 统计信息 */
  stats: RollbackStats;
  /** 错误信息 */
  errors: RollbackError[];
}

/**
 * 回滚统计
 */
export interface RollbackStats {
  /** 删除的用户数 */
  deletedUsers: number;
  /** 删除的设备关联数 */
  deletedLinks: number;
  /** 跳过的用户数 (非虚拟用户) */
  skippedUsers: number;
  /** 失败的操作数 */
  failedOperations: number;
}

/**
 * 回滚错误
 */
export interface RollbackError {
  /** 资源类型 */
  resourceType: "user" | "device_link";
  /** 资源 ID */
  resourceId: string;
  /** 错误消息 */
  message: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 回滚结果
 */
export interface RollbackResult {
  /** 是否成功 */
  success: boolean;
  /** 任务信息 */
  task: RollbackTask;
  /** 消息 */
  message: string;
}

// ============================================================================
// 回调类型
// ============================================================================

/**
 * 获取迁移创建的用户
 */
export type GetMigratedUsersCallback = () => Promise<User[]>;

/**
 * 获取用户的设备关联
 */
export type GetUserDevicesCallback = (userId: string) => Promise<UserDevice[]>;

/**
 * 删除用户
 */
export type DeleteUserCallback = (userId: string) => Promise<boolean>;

/**
 * 删除设备关联
 */
export type DeleteDeviceLinkCallback = (linkId: string) => Promise<boolean>;

/**
 * 检查用户是否为虚拟用户
 */
export type IsVirtualUserCallback = (user: User) => boolean;

// ============================================================================
// 回滚服务类
// ============================================================================

/**
 * 迁移回滚服务
 */
export class MigrationRollbackService {
  private currentTask: RollbackTask | null = null;

  // 回调函数
  private getMigratedUsers: GetMigratedUsersCallback | null = null;
  private getUserDevices: GetUserDevicesCallback | null = null;
  private deleteUser: DeleteUserCallback | null = null;
  private deleteDeviceLink: DeleteDeviceLinkCallback | null = null;
  private isVirtualUser: IsVirtualUserCallback | null = null;

  constructor() {
    logger.info("[rollback] 创建迁移回滚服务");
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: {
    getMigratedUsers?: GetMigratedUsersCallback;
    getUserDevices?: GetUserDevicesCallback;
    deleteUser?: DeleteUserCallback;
    deleteDeviceLink?: DeleteDeviceLinkCallback;
    isVirtualUser?: IsVirtualUserCallback;
  }): void {
    if (callbacks.getMigratedUsers) {
      this.getMigratedUsers = callbacks.getMigratedUsers;
    }
    if (callbacks.getUserDevices) {
      this.getUserDevices = callbacks.getUserDevices;
    }
    if (callbacks.deleteUser) {
      this.deleteUser = callbacks.deleteUser;
    }
    if (callbacks.deleteDeviceLink) {
      this.deleteDeviceLink = callbacks.deleteDeviceLink;
    }
    if (callbacks.isVirtualUser) {
      this.isVirtualUser = callbacks.isVirtualUser;
    }
  }

  /**
   * 默认虚拟用户检测
   */
  private defaultIsVirtualUser(user: User): boolean {
    // 检查邮箱是否符合虚拟用户格式
    if (user.email?.includes("@internal.openclaw.local")) {
      return true;
    }

    // 检查元数据
    const metadata = user.metadata as Record<string, unknown> | undefined;
    if (metadata?.migratedFrom === "device-pairing") {
      return true;
    }

    return false;
  }

  /**
   * 执行回滚
   */
  async rollback(
    type: RollbackType = "full",
    options?: {
      reason?: string;
      userIds?: string[];
      deviceIds?: string[];
    }
  ): Promise<RollbackResult> {
    if (!this.getMigratedUsers || !this.getUserDevices) {
      throw new Error("未设置必要的回调");
    }

    if (this.currentTask?.status === "in_progress") {
      throw new Error("回滚任务正在进行中");
    }

    // 创建任务
    const task: RollbackTask = {
      id: randomUUID(),
      type,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      reason: options?.reason,
      stats: {
        deletedUsers: 0,
        deletedLinks: 0,
        skippedUsers: 0,
        failedOperations: 0,
      },
      errors: [],
    };

    this.currentTask = task;

    logger.info("[rollback] 开始回滚", {
      taskId: task.id,
      type,
      reason: options?.reason,
    });

    try {
      // 获取迁移创建的用户
      const users = await this.getMigratedUsers();
      const isVirtual = this.isVirtualUser || this.defaultIsVirtualUser.bind(this);

      // 过滤要处理的用户
      let usersToProcess = users.filter(isVirtual);

      if (type === "partial" && options?.userIds) {
        usersToProcess = usersToProcess.filter((u) =>
          options.userIds!.includes(u.id)
        );
      }

      logger.info("[rollback] 找到虚拟用户", {
        total: users.length,
        virtual: usersToProcess.length,
      });

      if (type === "dry_run") {
        // 模拟运行
        for (const user of usersToProcess) {
          const devices = await this.getUserDevices(user.id);
          task.stats.deletedUsers++;
          task.stats.deletedLinks += devices.length;
        }
        task.stats.skippedUsers = users.length - usersToProcess.length;

        task.status = "completed";
        task.completedAt = new Date().toISOString();

        return {
          success: true,
          task,
          message: `[模拟运行] 将删除 ${task.stats.deletedUsers} 个用户，${task.stats.deletedLinks} 个关联`,
        };
      }

      // 实际执行回滚
      for (const user of usersToProcess) {
        try {
          // 1. 删除设备关联
          const devices = await this.getUserDevices(user.id);
          for (const device of devices) {
            if (this.deleteDeviceLink) {
              const deleted = await this.deleteDeviceLink(device.id);
              if (deleted) {
                task.stats.deletedLinks++;
              } else {
                task.stats.failedOperations++;
                task.errors.push({
                  resourceType: "device_link",
                  resourceId: device.id,
                  message: "删除设备关联失败",
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }

          // 2. 删除用户
          if (this.deleteUser) {
            const deleted = await this.deleteUser(user.id);
            if (deleted) {
              task.stats.deletedUsers++;
              logger.debug("[rollback] 删除虚拟用户", { userId: user.id });
            } else {
              task.stats.failedOperations++;
              task.errors.push({
                resourceType: "user",
                resourceId: user.id,
                message: "删除用户失败",
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          task.stats.failedOperations++;
          task.errors.push({
            resourceType: "user",
            resourceId: user.id,
            message: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          });
          logger.error("[rollback] 回滚用户失败", {
            userId: user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      task.stats.skippedUsers = users.length - usersToProcess.length;
      task.status = task.stats.failedOperations > 0 ? "completed" : "completed";
      task.completedAt = new Date().toISOString();

      const message =
        task.stats.failedOperations > 0
          ? `回滚完成 (有错误): ${task.stats.deletedUsers} 用户已删除, ${task.stats.failedOperations} 操作失败`
          : `回滚成功: 删除 ${task.stats.deletedUsers} 个用户, ${task.stats.deletedLinks} 个关联`;

      logger.info("[rollback] 回滚完成", {
        taskId: task.id,
        stats: task.stats,
      });

      return {
        success: task.stats.failedOperations === 0,
        task,
        message,
      };
    } catch (error) {
      task.status = "failed";
      task.completedAt = new Date().toISOString();

      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[rollback] 回滚失败", {
        taskId: task.id,
        error: message,
      });

      return {
        success: false,
        task,
        message: `回滚失败: ${message}`,
      };
    }
  }

  /**
   * 获取当前任务状态
   */
  getCurrentTask(): RollbackTask | null {
    return this.currentTask;
  }

  /**
   * 预览回滚影响
   */
  async preview(): Promise<{
    usersToDelete: number;
    linksToDelete: number;
    skippedUsers: number;
  }> {
    if (!this.getMigratedUsers || !this.getUserDevices) {
      throw new Error("未设置必要的回调");
    }

    const users = await this.getMigratedUsers();
    const isVirtual = this.isVirtualUser || this.defaultIsVirtualUser.bind(this);
    const virtualUsers = users.filter(isVirtual);

    let linksToDelete = 0;
    for (const user of virtualUsers) {
      const devices = await this.getUserDevices(user.id);
      linksToDelete += devices.length;
    }

    return {
      usersToDelete: virtualUsers.length,
      linksToDelete,
      skippedUsers: users.length - virtualUsers.length,
    };
  }
}

// ============================================================================
// 单例
// ============================================================================

let rollbackServiceInstance: MigrationRollbackService | null = null;

/**
 * 获取回滚服务实例
 */
export function getRollbackService(): MigrationRollbackService {
  if (!rollbackServiceInstance) {
    rollbackServiceInstance = new MigrationRollbackService();
  }
  return rollbackServiceInstance;
}

/**
 * 初始化回滚服务
 */
export function initRollbackService(): MigrationRollbackService {
  rollbackServiceInstance = new MigrationRollbackService();
  return rollbackServiceInstance;
}
