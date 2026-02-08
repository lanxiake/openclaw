/**
 * AI 助理技能系统 - 入口文件
 *
 * 导出技能系统的所有公共 API
 */

// 类型导出
export type {
  // 基础类型
  SkillRunMode,
  SkillCategory,
  SkillSubscriptionType,
  SkillSubscription,
  SkillDependencies,
  SkillInstallSpec,
  SkillPermissions,
  AssistantSkillMetadata,

  // 技能定义
  SkillTriggerType,
  SkillTrigger,
  SkillParameter,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutor,
  AssistantSkillDefinition,

  // 技能清单
  SkillManifest,

  // 技能注册表
  SkillLoadStatus,
  SkillRecord,
  SkillRegistry,

  // 技能商店
  SkillStoreEntry,
  SkillSearchParams,
  SkillSearchResult,
} from "./types.js";

// 加载器导出
export {
  loadAssistantSkills,
  unloadSkill,
  reloadSkill,
  findSkillByCommand,
  findSkillsByKeyword,
  getLoadedSkills,
  getAllSkillTools,
  createEmptySkillRegistry,
  // 新增：技能管理
  installSkill,
  enableSkill,
  disableSkill,
  toggleSkillStatus,
  getSkillConfig,
  setSkillConfig,
  clearSkillConfig,
  getSkillStats,
  getAllSkills,
  type SkillLoaderConfig,
  type SkillInstallOptions,
} from "./loader.js";

// 执行器导出
export {
  executeSkill,
  executeSkillByCommand,
  executeSkillsByEvent,
  validateSkillParams,
  getSkillHelp,
  type ConfirmHandler,
  type ProgressHandler,
  type SkillExecutorConfig,
} from "./executor.js";
