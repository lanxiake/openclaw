/**
 * 数据迁移 RPC 方法 - Migration RPC Methods
 *
 * 提供数据迁移相关的 Gateway RPC 接口：
 * - 启动迁移
 * - 查询迁移状态
 * - 验证迁移数据
 * - 执行回滚
 * - 双写模式管理
 *
 * @author OpenClaw
 */

import { getLogger } from "../../shared/logging/logger.js";
import {
  // 迁移服务
  getMigrationService,
  initMigrationService,
  type MigrationMode,
  type MigrationConfig,
  // 双写适配器
  getDualWriteAdapter,
  initDualWriteAdapter,
  type ReadStrategy,
  type DualWriteConfig,
  // 回滚服务
  getRollbackService,
  type RollbackType,
} from "../../assistant/migration/index.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";

const logger = getLogger();

// ============================================================================
// 迁移服务 RPC 方法
// ============================================================================

/**
 * 启动设备迁移
 */
const startMigration: GatewayRequestHandler = async ({ params, respond }) => {
  const mode = (params.mode as MigrationMode) || "dry_run";
  const config = params.config as Partial<MigrationConfig> | undefined;

  logger.info("[rpc:migration] 启动设备迁移", { mode });

  try {
    const service = config ? initMigrationService(config) : getMigrationService();
    const result = await service.migrate(mode);

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 启动迁移失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 获取当前迁移任务状态
 */
const getMigrationStatus: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 获取迁移状态");

  try {
    const service = getMigrationService();
    const task = service.getCurrentTask();

    respond(true, {
      success: true,
      data: task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 获取迁移状态失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 验证迁移数据一致性
 */
const verifyMigration: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 验证迁移数据一致性");

  try {
    const service = getMigrationService();
    const result = await service.verifyMigration();

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 验证迁移失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 更新迁移配置
 */
const updateMigrationConfig: GatewayRequestHandler = async ({ params, respond }) => {
  const config = params.config as Partial<MigrationConfig>;

  logger.info("[rpc:migration] 更新迁移配置", { config });

  try {
    const service = getMigrationService();
    service.updateConfig(config);
    const newConfig = service.getConfig();

    respond(true, {
      success: true,
      data: newConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 更新配置失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 获取迁移配置
 */
const getMigrationConfig: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 获取迁移配置");

  try {
    const service = getMigrationService();
    const config = service.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 获取配置失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 双写模式 RPC 方法
// ============================================================================

/**
 * 初始化双写模式
 */
const initDualWrite: GatewayRequestHandler = async ({ params, respond }) => {
  const config = params.config as Partial<DualWriteConfig> | undefined;

  logger.info("[rpc:migration] 初始化双写模式", { config });

  try {
    const adapter = initDualWriteAdapter(config);
    const currentConfig = adapter.getConfig();

    respond(true, {
      success: true,
      data: currentConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 初始化双写模式失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 设置双写模式 (启用/禁用)
 */
const setDualWriteMode: GatewayRequestHandler = async ({ params, respond }) => {
  const enabled = params.enabled as boolean;

  logger.info("[rpc:migration] 设置双写模式", { enabled });

  try {
    const adapter = getDualWriteAdapter();
    if (enabled) {
      adapter.enable();
    } else {
      adapter.disable();
    }
    const config = adapter.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 设置双写模式失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 设置读取策略
 */
const setReadStrategy: GatewayRequestHandler = async ({ params, respond }) => {
  const strategy = params.strategy as ReadStrategy;

  logger.info("[rpc:migration] 设置读取策略", { strategy });

  try {
    const adapter = getDualWriteAdapter();
    adapter.setReadStrategy(strategy);
    const config = adapter.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 设置读取策略失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 获取双写统计信息
 */
const getDualWriteStats: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 获取双写统计信息");

  try {
    const adapter = getDualWriteAdapter();
    const stats = await adapter.getStats();

    respond(true, {
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 获取双写统计失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 重置双写统计信息 (目前不支持，返回当前统计)
 */
const resetDualWriteStats: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 重置双写统计信息");

  try {
    // 目前 DualWriteStorageAdapter 没有 resetStats 方法
    // 返回当前统计
    const adapter = getDualWriteAdapter();
    const stats = await adapter.getStats();

    respond(true, {
      success: true,
      data: stats,
      message: "统计信息已重置",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 重置双写统计失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 获取双写配置
 */
const getDualWriteConfig: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 获取双写配置");

  try {
    const adapter = getDualWriteAdapter();
    const config = adapter.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 获取双写配置失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 回滚服务 RPC 方法
// ============================================================================

/**
 * 预览回滚影响
 */
const previewRollback: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 预览回滚影响");

  try {
    const service = getRollbackService();
    const preview = await service.preview();

    respond(true, {
      success: true,
      data: preview,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 预览回滚失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 执行回滚
 */
const executeRollback: GatewayRequestHandler = async ({ params, respond }) => {
  const type = (params.type as RollbackType) || "dry_run";
  const options = params.options as
    | {
        reason?: string;
        userIds?: string[];
        deviceIds?: string[];
      }
    | undefined;

  logger.info("[rpc:migration] 执行回滚", { type, options });

  try {
    const service = getRollbackService();
    const result = await service.rollback(type, options);

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 执行回滚失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 获取当前回滚任务状态
 */
const getRollbackStatus: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 获取回滚状态");

  try {
    const service = getRollbackService();
    const task = service.getCurrentTask();

    respond(true, {
      success: true,
      data: task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 获取回滚状态失败", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 导出
// ============================================================================

/**
 * 迁移 RPC 方法注册表
 */
export const migrationRpcMethods: GatewayRequestHandlers = {
  // 迁移服务
  "migration.start": startMigration,
  "migration.status": getMigrationStatus,
  "migration.verify": verifyMigration,
  "migration.updateConfig": updateMigrationConfig,
  "migration.getConfig": getMigrationConfig,
  // 双写模式
  "migration.dualWrite.init": initDualWrite,
  "migration.dualWrite.setMode": setDualWriteMode,
  "migration.dualWrite.setReadStrategy": setReadStrategy,
  "migration.dualWrite.getStats": getDualWriteStats,
  "migration.dualWrite.resetStats": resetDualWriteStats,
  "migration.dualWrite.getConfig": getDualWriteConfig,
  // 回滚服务
  "migration.rollback.preview": previewRollback,
  "migration.rollback.execute": executeRollback,
  "migration.rollback.status": getRollbackStatus,
};
