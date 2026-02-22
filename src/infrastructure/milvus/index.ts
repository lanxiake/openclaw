/**
 * Milvus 基础设施模块统一导出
 */

// 连接管理
export {
  type MilvusConfig,
  getMilvusConfigFromEnv,
  createMilvusConnection,
  getMilvus,
  milvusHealthCheck,
  closeMilvusConnection,
  resetMilvusConnection,
  enableMilvusMock,
  disableMilvusMock,
  isMilvusConnected,
} from "./connection.js";

// 向量存储服务
export {
  type VectorSearchResult,
  type VectorUpsertData,
  type MilvusSearchOptions,
  ensureCollection,
  upsertVector,
  batchUpsert,
  deleteVector,
  batchDelete,
  search,
  getCollectionStats,
  dropCollection,
  COLLECTION_NAME,
  VECTOR_DIM,
} from "./vector-store.js";
