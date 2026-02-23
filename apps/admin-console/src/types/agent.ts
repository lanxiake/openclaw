/**
 * 自定义 Agent 管理相关类型定义
 *
 * 定义 Agent 实体、CRUD 请求参数和列表查询参数
 * 对应后端 /api/admin/agents/* REST API
 */

/**
 * Agent 身份配置
 */
export interface AgentIdentity {
  /** 显示名称 */
  name?: string
  /** 主题色 */
  theme?: string
  /** 表情符号 */
  emoji?: string
  /** 头像路径或 data URI */
  avatar?: string
}

/**
 * Agent 模型配置
 */
export interface AgentModelConfig {
  /** 主模型 (provider/model 格式) */
  primary?: string
  /** 备用模型链 */
  fallbacks?: string[]
}

/**
 * Agent 工具配置
 */
export interface AgentToolsConfig {
  /** 允许的工具列表 */
  allowedTools?: string[]
  /** 禁止的工具列表 */
  deniedTools?: string[]
  /** 自动批准的工具 */
  autoApprove?: string[]
}

/**
 * Agent 沙箱配置
 */
export interface AgentSandboxConfig {
  /** 沙箱模式 */
  mode?: 'off' | 'non-main' | 'all'
  /** 工作空间访问权限 */
  workspaceAccess?: 'none' | 'ro' | 'rw'
}

/**
 * 自定义 Agent 实体
 */
export interface CustomAgent {
  /** Agent 唯一标识 */
  id: string
  /** 所属用户 (null = 系统级) */
  userId?: string | null
  /** Agent 名称 */
  name: string
  /** Agent 描述 */
  description?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 身份配置 */
  identity: AgentIdentity
  /** 模型配置 */
  model?: AgentModelConfig
  /** 工具配置 */
  tools?: AgentToolsConfig
  /** 沙箱配置 */
  sandbox?: AgentSandboxConfig
  /** 是否启用 */
  isEnabled: boolean
  /** 是否为默认 Agent */
  isDefault: boolean
  /** 排序权重 */
  sortOrder: number
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 创建 Agent 请求参数
 */
export interface CreateAgentRequest {
  /** Agent 名称（必填） */
  name: string
  /** Agent 描述 */
  description?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 身份配置 */
  identity?: AgentIdentity
  /** 模型配置 */
  model?: AgentModelConfig
  /** 工具配置 */
  tools?: AgentToolsConfig
  /** 沙箱配置 */
  sandbox?: AgentSandboxConfig
  /** 是否启用 */
  isEnabled?: boolean
}

/**
 * 更新 Agent 请求参数
 */
export interface UpdateAgentRequest {
  /** Agent 名称 */
  name?: string
  /** Agent 描述 */
  description?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 身份配置 */
  identity?: AgentIdentity
  /** 模型配置 */
  model?: AgentModelConfig
  /** 工具配置 */
  tools?: AgentToolsConfig
  /** 沙箱配置 */
  sandbox?: AgentSandboxConfig
  /** 是否启用 */
  isEnabled?: boolean
}

/**
 * Agent 列表查询参数
 */
export interface AgentListQuery {
  /** 搜索关键词 */
  search?: string
  /** 状态过滤 */
  status?: 'all' | 'enabled' | 'disabled'
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
}

/**
 * Agent 列表响应
 */
export interface AgentListResponse {
  agents: CustomAgent[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
