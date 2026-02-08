/**
 * 数据迁移模块 - Data Migration Module
 *
 * 提供从 JSON 文件存储到 PostgreSQL 数据库的迁移功能：
 * - 设备数据迁移服务
 * - 双写模式适配器
 * - 迁移回滚支持
 *
 * @author OpenClaw
 */

// ============================================================================
// 设备迁移服务
// ============================================================================

export {
  // 类型
  type MigrationStatus,
  type MigrationMode,
  type MigrationTask,
  type MigrationStats,
  type MigrationError,
  type MigrationResult,
  type VirtualUserInfo,
  type MigrationConfig,
  // 回调类型
  type GetAllDevicesCallback,
  type CheckDeviceLinkCallback,
  type CreateUserCallback,
  type CreateUserDeviceCallback,
  type FindUserByEmailCallback,
  // 常量
  DEFAULT_MIGRATION_CONFIG,
  // 服务类
  DeviceMigrationService,
  // 单例函数
  getMigrationService,
  initMigrationService,
} from "./device-migration.js";

// ============================================================================
// 双写模式适配器
// ============================================================================

export {
  // 类型
  type StorageSource,
  type ReadStrategy,
  type DualWriteConfig,
  // 回调类型
  type JsonStorageCallbacks,
  type PostgresStorageCallbacks,
  // 常量
  DEFAULT_DUAL_WRITE_CONFIG,
  // 服务类
  DualWriteStorageAdapter,
  // 单例函数
  getDualWriteAdapter,
  initDualWriteAdapter,
} from "./dual-write-adapter.js";

// ============================================================================
// 迁移回滚服务
// ============================================================================

export {
  // 类型
  type RollbackStatus,
  type RollbackType,
  type RollbackTask,
  type RollbackStats,
  type RollbackError,
  type RollbackResult,
  // 回调类型
  type GetMigratedUsersCallback,
  type GetUserDevicesCallback,
  type DeleteUserCallback,
  type DeleteDeviceLinkCallback,
  type IsVirtualUserCallback,
  // 服务类
  MigrationRollbackService,
  // 单例函数
  getRollbackService,
  initRollbackService,
} from "./rollback-service.js";
