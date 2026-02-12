/**
 * 鏁版嵁杩佺Щ RPC 鏂规硶 - Migration RPC Methods
 *
 * 鎻愪緵鏁版嵁杩佺Щ鐩稿叧鐨?Gateway RPC 鎺ュ彛锛? * - 鍚姩杩佺Щ
 * - 鏌ヨ杩佺Щ鐘舵€? * - 楠岃瘉杩佺Щ鏁版嵁
 * - 鎵ц鍥炴粴
 * - 鍙屽啓妯″紡绠＄悊
 *
 * @author OpenClaw
 */

import { getLogger } from "../../shared/logging/logger.js";
import {
  // 杩佺Щ鏈嶅姟
  getMigrationService,
  initMigrationService,
  type MigrationMode,
  type MigrationConfig,
  // 鍙屽啓閫傞厤鍣?  getDualWriteAdapter,
  initDualWriteAdapter,
  type ReadStrategy,
  type DualWriteConfig,
  // 鍥炴粴鏈嶅姟
  getRollbackService,
  type RollbackType,
} from "../../assistant/migration/index.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";

const logger = getLogger();

// ============================================================================
// 杩佺Щ鏈嶅姟 RPC 鏂规硶
// ============================================================================

/**
 * 鍚姩璁惧杩佺Щ
 */
const startMigration: GatewayRequestHandler = async ({ params, respond }) => {
  const mode = (params.mode as MigrationMode) || "dry_run";
  const config = params.config as Partial<MigrationConfig> | undefined;

  logger.info("[rpc:migration] 鍚姩璁惧杩佺Щ", { mode });

  try {
    const service = config ? initMigrationService(config) : getMigrationService();
    const result = await service.migrate(mode);

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鍚姩杩佺Щ澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鑾峰彇褰撳墠杩佺Щ浠诲姟鐘舵€? */
const getMigrationStatus: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 鑾峰彇杩佺Щ鐘舵€?);

  try {
    const service = getMigrationService();
    const task = service.getCurrentTask();

    respond(true, {
      success: true,
      data: task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鑾峰彇杩佺Щ鐘舵€佸け璐?, { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 楠岃瘉杩佺Щ鏁版嵁涓€鑷存€? */
const verifyMigration: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 楠岃瘉杩佺Щ鏁版嵁涓€鑷存€?);

  try {
    const service = getMigrationService();
    const result = await service.verifyMigration();

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 楠岃瘉杩佺Щ澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鏇存柊杩佺Щ閰嶇疆
 */
const updateMigrationConfig: GatewayRequestHandler = async ({ params, respond }) => {
  const config = params.config as Partial<MigrationConfig>;

  logger.info("[rpc:migration] 鏇存柊杩佺Щ閰嶇疆", { config });

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
    logger.error("[rpc:migration] 鏇存柊閰嶇疆澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鑾峰彇杩佺Щ閰嶇疆
 */
const getMigrationConfig: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 鑾峰彇杩佺Щ閰嶇疆");

  try {
    const service = getMigrationService();
    const config = service.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鑾峰彇閰嶇疆澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 鍙屽啓妯″紡 RPC 鏂规硶
// ============================================================================

/**
 * 鍒濆鍖栧弻鍐欐ā寮? */
const initDualWrite: GatewayRequestHandler = async ({ params, respond }) => {
  const config = params.config as Partial<DualWriteConfig> | undefined;

  logger.info("[rpc:migration] 鍒濆鍖栧弻鍐欐ā寮?, { config });

  try {
    const adapter = initDualWriteAdapter(config);
    const currentConfig = adapter.getConfig();

    respond(true, {
      success: true,
      data: currentConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鍒濆鍖栧弻鍐欐ā寮忓け璐?, { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 璁剧疆鍙屽啓妯″紡 (鍚敤/绂佺敤)
 */
const setDualWriteMode: GatewayRequestHandler = async ({ params, respond }) => {
  const enabled = params.enabled as boolean;

  logger.info("[rpc:migration] 璁剧疆鍙屽啓妯″紡", { enabled });

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
    logger.error("[rpc:migration] 璁剧疆鍙屽啓妯″紡澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 璁剧疆璇诲彇绛栫暐
 */
const setReadStrategy: GatewayRequestHandler = async ({ params, respond }) => {
  const strategy = params.strategy as ReadStrategy;

  logger.info("[rpc:migration] 璁剧疆璇诲彇绛栫暐", { strategy });

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
    logger.error("[rpc:migration] 璁剧疆璇诲彇绛栫暐澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鑾峰彇鍙屽啓缁熻淇℃伅
 */
const getDualWriteStats: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 鑾峰彇鍙屽啓缁熻淇℃伅");

  try {
    const adapter = getDualWriteAdapter();
    const stats = await adapter.getStats();

    respond(true, {
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鑾峰彇鍙屽啓缁熻澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 閲嶇疆鍙屽啓缁熻淇℃伅 (鐩墠涓嶆敮鎸侊紝杩斿洖褰撳墠缁熻)
 */
const resetDualWriteStats: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 閲嶇疆鍙屽啓缁熻淇℃伅");

  try {
    // 鐩墠 DualWriteStorageAdapter 娌℃湁 resetStats 鏂规硶
    // 杩斿洖褰撳墠缁熻
    const adapter = getDualWriteAdapter();
    const stats = await adapter.getStats();

    respond(true, {
      success: true,
      data: stats,
      message: "缁熻淇℃伅宸查噸缃?,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 閲嶇疆鍙屽啓缁熻澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鑾峰彇鍙屽啓閰嶇疆
 */
const getDualWriteConfig: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 鑾峰彇鍙屽啓閰嶇疆");

  try {
    const adapter = getDualWriteAdapter();
    const config = adapter.getConfig();

    respond(true, {
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鑾峰彇鍙屽啓閰嶇疆澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 鍥炴粴鏈嶅姟 RPC 鏂规硶
// ============================================================================

/**
 * 棰勮鍥炴粴褰卞搷
 */
const previewRollback: GatewayRequestHandler = async ({ respond }) => {
  logger.info("[rpc:migration] 棰勮鍥炴粴褰卞搷");

  try {
    const service = getRollbackService();
    const preview = await service.preview();

    respond(true, {
      success: true,
      data: preview,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 棰勮鍥炴粴澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鎵ц鍥炴粴
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

  logger.info("[rpc:migration] 鎵ц鍥炴粴", { type, options });

  try {
    const service = getRollbackService();
    const result = await service.rollback(type, options);

    respond(true, {
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鎵ц鍥炴粴澶辫触", { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

/**
 * 鑾峰彇褰撳墠鍥炴粴浠诲姟鐘舵€? */
const getRollbackStatus: GatewayRequestHandler = async ({ respond }) => {
  logger.debug("[rpc:migration] 鑾峰彇鍥炴粴鐘舵€?);

  try {
    const service = getRollbackService();
    const task = service.getCurrentTask();

    respond(true, {
      success: true,
      data: task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[rpc:migration] 鑾峰彇鍥炴粴鐘舵€佸け璐?, { error: message });
    respond(true, {
      success: false,
      error: message,
    });
  }
};

// ============================================================================
// 瀵煎嚭
// ============================================================================

/**
 * 杩佺Щ RPC 鏂规硶娉ㄥ唽琛? */
export const migrationRpcMethods: GatewayRequestHandlers = {
  // 杩佺Щ鏈嶅姟
  "migration.start": startMigration,
  "migration.status": getMigrationStatus,
  "migration.verify": verifyMigration,
  "migration.updateConfig": updateMigrationConfig,
  "migration.getConfig": getMigrationConfig,
  // 鍙屽啓妯″紡
  "migration.dualWrite.init": initDualWrite,
  "migration.dualWrite.setMode": setDualWriteMode,
  "migration.dualWrite.setReadStrategy": setReadStrategy,
  "migration.dualWrite.getStats": getDualWriteStats,
  "migration.dualWrite.resetStats": resetDualWriteStats,
  "migration.dualWrite.getConfig": getDualWriteConfig,
  // 鍥炴粴鏈嶅姟
  "migration.rollback.preview": previewRollback,
  "migration.rollback.execute": executeRollback,
  "migration.rollback.status": getRollbackStatus,
};
