/**
 * AI 助理技能系统 - 类型定义
 *
 * 定义技能的结构、元数据、执行上下文等核心类型
 * 基于现有 src/agents/skills/ 和 src/plugins/ 架构扩展
 */

import type { AnyAgentTool } from "../../agent/tools/common.js";

// === 技能类型定义 ===

/**
 * 技能运行模式
 * - server: 在服务端执行 (Gateway 侧)
 * - local: 在客户端执行 (Windows 客户端侧)
 * - hybrid: 部分服务端、部分客户端
 */
export type SkillRunMode = "server" | "local" | "hybrid";

/**
 * 技能类别
 */
export type SkillCategory =
  | "file-management" // 文件管理
  | "system-tools" // 系统工具
  | "productivity" // 生产力
  | "automation" // 自动化
  | "communication" // 通讯
  | "development" // 开发工具
  | "media" // 媒体处理
  | "custom"; // 自定义

/**
 * 技能订阅模式
 */
export type SkillSubscriptionType = "free" | "premium" | "enterprise";

/**
 * 技能订阅信息
 */
export interface SkillSubscription {
  /** 订阅类型 */
  type: SkillSubscriptionType;
  /** 是否需要订阅才能使用 */
  required: boolean;
  /** 价格 (分) */
  price?: number;
  /** 计费周期 */
  period?: "monthly" | "yearly" | "once";
  /** 试用天数 */
  trialDays?: number;
}

/**
 * 技能依赖项
 */
export interface SkillDependencies {
  /** 必需的二进制工具 */
  bins?: string[];
  /** 任意一个即可的二进制工具 */
  anyBins?: string[];
  /** 必需的环境变量 */
  env?: string[];
  /** 必需的配置项 */
  config?: string[];
  /** 支持的操作系统 */
  os?: ("windows" | "macos" | "linux")[];
  /** 最低 Windows 版本 */
  minWindowsVersion?: string;
  /** 其他技能依赖 */
  skills?: string[];
}

/**
 * 技能安装规范
 */
export interface SkillInstallSpec {
  /** 安装 ID */
  id?: string;
  /** 安装方式 */
  kind: "npm" | "pip" | "winget" | "choco" | "download" | "script";
  /** 显示标签 */
  label?: string;
  /** 安装后提供的二进制 */
  bins?: string[];
  /** 支持的操作系统 */
  os?: ("windows" | "macos" | "linux")[];
  /** 包名 (npm/pip/winget/choco) */
  package?: string;
  /** 下载 URL */
  url?: string;
  /** 安装脚本 (PowerShell) */
  script?: string;
}

/**
 * 技能权限要求
 */
export interface SkillPermissions {
  /** 文件系统访问 */
  fileSystem?: {
    /** 允许读取的路径模式 */
    read?: string[];
    /** 允许写入的路径模式 */
    write?: string[];
    /** 允许删除的路径模式 */
    delete?: string[];
  };
  /** 网络访问 */
  network?: {
    /** 允许访问的域名 */
    domains?: string[];
    /** 允许的端口 */
    ports?: number[];
  };
  /** 进程管理 */
  process?: {
    /** 允许启动的程序 */
    launch?: string[];
    /** 允许结束的进程 */
    kill?: boolean;
  };
  /** 系统信息访问 */
  system?: {
    /** 允许读取系统信息 */
    read?: boolean;
  };
  /** 剪贴板访问 */
  clipboard?: {
    read?: boolean;
    write?: boolean;
  };
  /** 是否需要敏感操作确认 */
  requireConfirmation?: boolean;
}

/**
 * 技能元数据
 */
export interface AssistantSkillMetadata {
  /** 技能唯一标识 */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 详细说明 */
  longDescription?: string;
  /** 版本号 */
  version: string;
  /** 作者 */
  author?: string;
  /** 主页 URL */
  homepage?: string;
  /** 图标 (emoji 或 URL) */
  icon?: string;
  /** 类别 */
  category: SkillCategory;
  /** 标签 */
  tags?: string[];
  /** 运行模式 */
  runMode: SkillRunMode;
  /** 依赖项 */
  dependencies?: SkillDependencies;
  /** 安装规范 */
  install?: SkillInstallSpec[];
  /** 权限要求 */
  permissions?: SkillPermissions;
  /** 订阅信息 */
  subscription?: SkillSubscription;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否总是加载 (系统技能) */
  alwaysLoad?: boolean;
}

// === 技能定义 ===

/**
 * 技能触发器类型
 */
export type SkillTriggerType =
  | "command" // 命令触发 (如 /organize)
  | "keyword" // 关键词触发
  | "schedule" // 定时触发
  | "event" // 事件触发
  | "ai-invoke"; // AI 自动调用

/**
 * 技能触发器配置
 */
export interface SkillTrigger {
  /** 触发类型 */
  type: SkillTriggerType;
  /** 命令名 (command 类型) */
  command?: string;
  /** 关键词列表 (keyword 类型) */
  keywords?: string[];
  /** Cron 表达式 (schedule 类型) */
  cron?: string;
  /** 事件名 (event 类型) */
  event?: string;
  /** AI 是否可以自动调用 */
  aiInvocable?: boolean;
}

/**
 * 技能参数定义
 */
export interface SkillParameter {
  /** 参数名 */
  name: string;
  /** 参数描述 */
  description: string;
  /** 参数类型 */
  type: "string" | "number" | "boolean" | "array" | "object";
  /** 是否必需 */
  required?: boolean;
  /** 默认值 */
  default?: unknown;
  /** 枚举值 (type=string 时) */
  enum?: string[];
  /** 数组元素类型 (type=array 时) */
  items?: SkillParameter;
}

/**
 * 技能执行上下文
 */
export interface SkillExecutionContext {
  /** 技能 ID */
  skillId: string;
  /** 会话 ID */
  sessionId: string;
  /** 用户 ID */
  userId?: string;
  /** 设备 ID */
  deviceId?: string;
  /** 调用参数 */
  params: Record<string, unknown>;
  /** 触发方式 */
  trigger: SkillTrigger;
  /** 是否需要确认 */
  requireConfirmation: boolean;
  /** 日志函数 */
  log: {
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug: (message: string, data?: Record<string, unknown>) => void;
  };
  /** 进度报告 */
  progress: (percent: number, message?: string) => void;
  /** 请求用户确认 */
  confirm: (
    action: string,
    description: string,
    level?: "low" | "medium" | "high",
  ) => Promise<boolean>;
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行摘要 (显示给用户) */
  summary?: string;
  /** 下一步建议 */
  suggestions?: string[];
}

/**
 * 技能执行函数
 */
export type SkillExecutor = (context: SkillExecutionContext) => Promise<SkillExecutionResult>;

/**
 * 完整的技能定义
 */
export interface AssistantSkillDefinition {
  /** 技能元数据 */
  metadata: AssistantSkillMetadata;
  /** 触发器配置 */
  triggers: SkillTrigger[];
  /** 参数定义 */
  parameters?: SkillParameter[];
  /** 提供的工具 (供 AI 调用) */
  tools?: AnyAgentTool[];
  /** 技能执行函数 */
  execute: SkillExecutor;
  /** 初始化函数 */
  init?: () => Promise<void>;
  /** 清理函数 */
  cleanup?: () => Promise<void>;
}

// === 技能清单 ===

/**
 * 技能清单文件 (skill.json)
 */
export interface SkillManifest {
  /** 清单版本 */
  manifestVersion: "1.0";
  /** 技能元数据 */
  metadata: AssistantSkillMetadata;
  /** 触发器配置 */
  triggers: SkillTrigger[];
  /** 参数定义 */
  parameters?: SkillParameter[];
  /** 入口文件 */
  main: string;
  /** 配置 schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
}

// === 技能注册表 ===

/**
 * 已加载技能的状态
 */
export type SkillLoadStatus = "loaded" | "disabled" | "error" | "pending";

/**
 * 技能注册记录
 */
export interface SkillRecord {
  /** 技能 ID */
  id: string;
  /** 技能元数据 */
  metadata: AssistantSkillMetadata;
  /** 加载状态 */
  status: SkillLoadStatus;
  /** 错误信息 (status=error 时) */
  error?: string;
  /** 技能来源路径 */
  source: string;
  /** 来源类型 */
  origin: "builtin" | "installed" | "workspace" | "remote";
  /** 技能定义 (已加载时) */
  definition?: AssistantSkillDefinition;
  /** 加载时间 */
  loadedAt?: Date;
  /** 最后执行时间 */
  lastExecutedAt?: Date;
  /** 执行次数 */
  executionCount: number;
}

/**
 * 技能注册表
 */
export interface SkillRegistry {
  /** 所有技能记录 */
  skills: Map<string, SkillRecord>;
  /** 命令到技能的映射 */
  commandMap: Map<string, string>;
  /** 关键词到技能的映射 */
  keywordMap: Map<string, string[]>;
  /** 事件到技能的映射 */
  eventMap: Map<string, string[]>;
  /** 所有工具 */
  tools: AnyAgentTool[];
  /** 版本号 (用于缓存失效) */
  version: number;
}

// === 技能商店 ===

/**
 * 技能商店条目
 */
export interface SkillStoreEntry {
  /** 技能元数据 */
  metadata: AssistantSkillMetadata;
  /** 下载次数 */
  downloads: number;
  /** 评分 (1-5) */
  rating: number;
  /** 评价数 */
  reviewCount: number;
  /** 发布日期 */
  publishedAt: Date;
  /** 最后更新 */
  updatedAt: Date;
  /** 下载 URL */
  downloadUrl: string;
  /** 截图 */
  screenshots?: string[];
}

/**
 * 技能搜索参数
 */
export interface SkillSearchParams {
  /** 搜索关键词 */
  query?: string;
  /** 类别筛选 */
  category?: SkillCategory;
  /** 订阅类型筛选 */
  subscription?: SkillSubscriptionType;
  /** 排序方式 */
  sortBy?: "downloads" | "rating" | "updated" | "name";
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
  /** 分页偏移 */
  offset?: number;
  /** 每页数量 */
  limit?: number;
}

/**
 * 技能搜索结果
 */
export interface SkillSearchResult {
  /** 技能列表 */
  skills: SkillStoreEntry[];
  /** 总数 */
  total: number;
  /** 当前偏移 */
  offset: number;
  /** 每页数量 */
  limit: number;
}
