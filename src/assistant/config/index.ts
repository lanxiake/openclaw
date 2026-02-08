/**
 * 配置模块导出
 */

export {
  getAllConfigs,
  getConfigByKey,
  getConfigValue,
  setConfigValue,
  createConfig,
  deleteConfig,
  setConfigsBatch,
  getConfigHistory,
  getConfigGroups,
  resetConfigToDefault,
  initializeDefaultConfigs,
  type ConfigServiceOptions,
  type ConfigSearchParams,
  type ConfigSearchResult,
} from "./config-service.js";
