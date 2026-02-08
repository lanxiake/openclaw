/**
 * 数据库模块统一导出
 */

// 连接管理
export {
  getDatabase,
  getSqlClient,
  createConnection,
  closeConnection,
  resetConnection,
  healthCheck,
  transaction,
  getDatabaseConfigFromEnv,
  type Database,
  type DatabaseConfig,
} from "./connection.js";

// Schema 和类型
export * from "./schema/index.js";

// 仓库层
export * from "./repositories/index.js";

// 工具函数
export * from "./utils/index.js";
