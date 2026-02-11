/**
 * AI 助理技能执行器
 *
 * 负责执行技能、管理执行上下文、处理权限和确认
 */

import { randomUUID } from "node:crypto";
import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import type {
  AssistantSkillDefinition,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillRecord,
  SkillRegistry,
  SkillTrigger,
} from "./types.js";

// 日志
const log = createSubsystemLogger("skill-executor");

// === 执行上下文创建 ===

/**
 * 确认请求处理器类型
 */
export type ConfirmHandler = (
  action: string,
  description: string,
  level: "low" | "medium" | "high",
) => Promise<boolean>;

/**
 * 进度报告处理器类型
 */
export type ProgressHandler = (skillId: string, percent: number, message?: string) => void;

/**
 * 技能执行器配置
 */
export interface SkillExecutorConfig {
  /** 确认处理器 */
  confirmHandler?: ConfirmHandler;
  /** 进度处理器 */
  progressHandler?: ProgressHandler;
  /** 默认超时 (毫秒) */
  defaultTimeout?: number;
  /** 是否跳过确认 (仅用于测试) */
  skipConfirmation?: boolean;
}

/**
 * 创建技能执行上下文
 */
function createExecutionContext(
  skill: AssistantSkillDefinition,
  params: {
    sessionId: string;
    userId?: string;
    deviceId?: string;
    params: Record<string, unknown>;
    trigger: SkillTrigger;
  },
  config: SkillExecutorConfig,
): SkillExecutionContext {
  const skillId = skill.metadata.id;

  return {
    skillId,
    sessionId: params.sessionId,
    userId: params.userId,
    deviceId: params.deviceId,
    params: params.params,
    trigger: params.trigger,
    requireConfirmation: skill.metadata.permissions?.requireConfirmation ?? false,

    // 日志函数
    log: {
      info: (message, data) => log.info(`[${skillId}] ${message}`, data),
      warn: (message, data) => log.warn(`[${skillId}] ${message}`, data),
      error: (message, data) => log.error(`[${skillId}] ${message}`, data),
      debug: (message, data) => log.debug(`[${skillId}] ${message}`, data),
    },

    // 进度报告
    progress: (percent, message) => {
      if (config.progressHandler) {
        config.progressHandler(skillId, percent, message);
      }
      log.debug(`[${skillId}] 进度: ${percent}%`, { message });
    },

    // 确认请求
    confirm: async (action, description, level = "medium") => {
      if (config.skipConfirmation) {
        log.debug(`[${skillId}] 跳过确认: ${action}`);
        return true;
      }

      if (config.confirmHandler) {
        log.info(`[${skillId}] 请求确认: ${action}`, { level });
        return config.confirmHandler(action, description, level);
      }

      // 默认拒绝
      log.warn(`[${skillId}] 无确认处理器，默认拒绝: ${action}`);
      return false;
    },
  };
}

// === 权限检查 ===

/**
 * 检查技能权限
 */
function checkSkillPermissions(
  skill: AssistantSkillDefinition,
  params: Record<string, unknown>,
): { allowed: boolean; reason?: string } {
  const permissions = skill.metadata.permissions;

  if (!permissions) {
    return { allowed: true };
  }

  // 检查文件系统权限
  if (permissions.fileSystem) {
    const path = params.path as string | undefined;

    if (path) {
      // 检查读取权限
      if (permissions.fileSystem.read) {
        const readAllowed = permissions.fileSystem.read.some((pattern) =>
          matchPathPattern(path, pattern),
        );
        if (!readAllowed) {
          return { allowed: false, reason: `无权读取路径: ${path}` };
        }
      }

      // 检查写入权限
      if (permissions.fileSystem.write && params.content !== undefined) {
        const writeAllowed = permissions.fileSystem.write.some((pattern) =>
          matchPathPattern(path, pattern),
        );
        if (!writeAllowed) {
          return { allowed: false, reason: `无权写入路径: ${path}` };
        }
      }
    }
  }

  return { allowed: true };
}

/**
 * 路径模式匹配
 */
function matchPathPattern(path: string, pattern: string): boolean {
  // 简单的通配符匹配
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase();
  const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();

  if (normalizedPattern === "*") {
    return true;
  }

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath.startsWith(prefix);
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -2);
    return (
      normalizedPath.startsWith(prefix) && !normalizedPath.slice(prefix.length + 1).includes("/")
    );
  }

  return normalizedPath === normalizedPattern;
}

// === 技能执行 ===

/**
 * 执行技能
 */
export async function executeSkill(
  registry: SkillRegistry,
  skillId: string,
  params: {
    sessionId?: string;
    userId?: string;
    deviceId?: string;
    params?: Record<string, unknown>;
    trigger?: SkillTrigger;
  },
  config: SkillExecutorConfig = {},
): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const sessionId = params.sessionId || randomUUID();

  log.info(`开始执行技能: ${skillId}`, {
    sessionId,
    trigger: params.trigger?.type,
  });

  // 查找技能
  const record = registry.skills.get(skillId);

  if (!record) {
    log.error(`技能不存在: ${skillId}`);
    return {
      success: false,
      error: `技能不存在: ${skillId}`,
    };
  }

  if (record.status !== "loaded" || !record.definition) {
    log.error(`技能未加载: ${skillId}`, { status: record.status });
    return {
      success: false,
      error: `技能未加载或加载失败: ${skillId}`,
    };
  }

  const skill = record.definition;
  const executionParams = params.params || {};

  // 权限检查
  const permissionCheck = checkSkillPermissions(skill, executionParams);

  if (!permissionCheck.allowed) {
    log.warn(`技能权限不足: ${skillId}`, { reason: permissionCheck.reason });
    return {
      success: false,
      error: permissionCheck.reason,
    };
  }

  // 创建执行上下文
  const context = createExecutionContext(
    skill,
    {
      sessionId,
      userId: params.userId,
      deviceId: params.deviceId,
      params: executionParams,
      trigger: params.trigger || { type: "ai-invoke", aiInvocable: true },
    },
    config,
  );

  // 检查是否需要确认
  if (skill.metadata.permissions?.requireConfirmation && !config.skipConfirmation) {
    const actionDesc = `执行技能: ${skill.metadata.name}`;
    const details = `${skill.metadata.description}\n\n参数: ${JSON.stringify(executionParams, null, 2)}`;
    const level = skill.metadata.permissions.fileSystem?.delete ? "high" : "medium";

    const confirmed = await context.confirm(actionDesc, details, level);

    if (!confirmed) {
      log.info(`技能执行被用户拒绝: ${skillId}`);
      return {
        success: false,
        error: "用户取消操作",
      };
    }
  }

  // 执行技能
  try {
    const timeout = config.defaultTimeout || 60000;
    const result = await Promise.race([
      skill.execute(context),
      new Promise<SkillExecutionResult>((_, reject) =>
        setTimeout(() => reject(new Error("执行超时")), timeout),
      ),
    ]);

    const duration = Date.now() - startTime;

    // 更新执行统计
    record.lastExecutedAt = new Date();
    record.executionCount++;

    log.info(`技能执行完成: ${skillId}`, {
      success: result.success,
      duration,
      executionCount: record.executionCount,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    log.error(`技能执行失败: ${skillId}`, {
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 通过命令执行技能
 */
export async function executeSkillByCommand(
  registry: SkillRegistry,
  command: string,
  params: {
    sessionId?: string;
    userId?: string;
    deviceId?: string;
    args?: string;
    params?: Record<string, unknown>;
  },
  config: SkillExecutorConfig = {},
): Promise<SkillExecutionResult> {
  const skillId = registry.commandMap.get(command);

  if (!skillId) {
    return {
      success: false,
      error: `未找到命令: ${command}`,
    };
  }

  return executeSkill(
    registry,
    skillId,
    {
      ...params,
      params: params.params || { args: params.args },
      trigger: { type: "command", command },
    },
    config,
  );
}

/**
 * 批量执行技能 (用于事件触发)
 */
export async function executeSkillsByEvent(
  registry: SkillRegistry,
  event: string,
  params: {
    sessionId?: string;
    userId?: string;
    deviceId?: string;
    eventData?: Record<string, unknown>;
  },
  config: SkillExecutorConfig = {},
): Promise<Map<string, SkillExecutionResult>> {
  const results = new Map<string, SkillExecutionResult>();
  const skillIds = registry.eventMap.get(event) || [];

  log.info(`触发事件: ${event}`, { skillCount: skillIds.length });

  for (const skillId of skillIds) {
    const result = await executeSkill(
      registry,
      skillId,
      {
        ...params,
        params: params.eventData,
        trigger: { type: "event", event },
      },
      config,
    );

    results.set(skillId, result);
  }

  return results;
}

// === 技能验证 ===

/**
 * 验证技能参数
 */
export function validateSkillParams(
  skill: AssistantSkillDefinition,
  params: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const paramDefs = skill.parameters || [];

  for (const paramDef of paramDefs) {
    const value = params[paramDef.name];

    // 检查必需参数
    if (paramDef.required && (value === undefined || value === null)) {
      errors.push(`缺少必需参数: ${paramDef.name}`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // 类型检查
    const actualType = Array.isArray(value) ? "array" : typeof value;

    if (actualType !== paramDef.type) {
      errors.push(`参数类型错误: ${paramDef.name} 应为 ${paramDef.type}，实际为 ${actualType}`);
      continue;
    }

    // 枚举检查
    if (paramDef.enum && paramDef.type === "string") {
      if (!paramDef.enum.includes(value as string)) {
        errors.push(`参数值无效: ${paramDef.name} 应为 [${paramDef.enum.join(", ")}] 之一`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 获取技能帮助信息
 */
export function getSkillHelp(skill: AssistantSkillDefinition): string {
  const lines: string[] = [];

  lines.push(`# ${skill.metadata.name}`);
  lines.push("");
  lines.push(skill.metadata.description);

  if (skill.metadata.longDescription) {
    lines.push("");
    lines.push(skill.metadata.longDescription);
  }

  if (skill.parameters && skill.parameters.length > 0) {
    lines.push("");
    lines.push("## 参数");
    lines.push("");

    for (const param of skill.parameters) {
      const required = param.required ? "(必需)" : "(可选)";
      lines.push(`- **${param.name}** ${required}: ${param.description}`);

      if (param.default !== undefined) {
        lines.push(`  默认值: ${JSON.stringify(param.default)}`);
      }

      if (param.enum) {
        lines.push(`  可选值: ${param.enum.join(", ")}`);
      }
    }
  }

  if (skill.triggers && skill.triggers.length > 0) {
    lines.push("");
    lines.push("## 触发方式");
    lines.push("");

    for (const trigger of skill.triggers) {
      if (trigger.type === "command" && trigger.command) {
        lines.push(`- 命令: /${trigger.command}`);
      }
      if (trigger.type === "keyword" && trigger.keywords) {
        lines.push(`- 关键词: ${trigger.keywords.join(", ")}`);
      }
      if (trigger.type === "schedule" && trigger.cron) {
        lines.push(`- 定时: ${trigger.cron}`);
      }
      if (trigger.type === "event" && trigger.event) {
        lines.push(`- 事件: ${trigger.event}`);
      }
    }
  }

  return lines.join("\n");
}
