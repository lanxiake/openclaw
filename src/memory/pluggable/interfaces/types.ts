/**
 * 记忆系统公共类型
 *
 * 被多个记忆接口共享的类型定义。
 *
 * @module memory/pluggable/interfaces
 */

// ==================== 消息类型 ====================

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * 工具调用
 */
export interface ToolCall {
  /** 调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  arguments: Record<string, unknown>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 对应的调用 ID */
  callId: string;
  /** 执行输出 */
  output: unknown;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 消息
 */
export interface Message {
  /** 消息 ID */
  id: string;
  /** 发送者角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 工具调用列表（assistant 消息可能包含） */
  toolCalls?: ToolCall[];
  /** 工具执行结果（tool 消息包含） */
  toolResult?: ToolResult;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
}
