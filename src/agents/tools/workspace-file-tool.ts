/**
 * Workspace 文件工具 — Agent 读写数据库中的用户 workspace 文件
 *
 * 提供 2 个操作：
 * - read: 读取指定 workspace 文件内容
 * - update: 更新指定 workspace 文件内容
 *
 * 所有操作通过 AsyncLocalStorage 获取当前用户上下文，
 * 并记录审计日志（fire-and-forget）。
 */

import { Type } from "@sinclair/typebox";
import { getDatabase } from "../../db/connection.js";
import { getUserWorkspaceFilesRepository } from "../../db/repositories/user-workspace-files.js";
import { getMemoryAuditRepository } from "../../db/repositories/memory-audit.js";
import type { WorkspaceFileName } from "../../db/schema/index.js";
import { getLogger } from "../../logging/logger.js";
import { stringEnum } from "../schema/typebox.js";
import { getUserContext } from "../user-context-store.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const logger = getLogger();

/** 工具支持的操作 */
const WORKSPACE_FILE_ACTIONS = ["read", "update"] as const;

/** 允许操作的文件名 */
const ALLOWED_FILE_NAMES = [
  "SOUL.md",
  "IDENTITY.md",
  "AGENTS.md",
  "TOOLS.md",
  "HEARTBEAT.md",
] as const;

/**
 * 工具参数 Schema（扁平化，运行时按 action 验证）
 */
const WorkspaceFileToolSchema = Type.Object({
  action: stringEnum(WORKSPACE_FILE_ACTIONS, {
    description: "操作类型: read=读取文件, update=更新文件",
  }),
  fileName: stringEnum(ALLOWED_FILE_NAMES, {
    description: "workspace 文件名: SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, HEARTBEAT.md",
  }),
  // update 参数
  content: Type.Optional(Type.String({ description: "文件新内容（update 必填）" })),
});

/**
 * 创建 Workspace 文件工具
 *
 * 允许 Agent 在对话中读写用户的 workspace 配置文件，
 * 通过 AsyncLocalStorage 获取当前用户上下文。
 *
 * @returns Agent 工具定义
 */
export function createWorkspaceFileTool(): AnyAgentTool {
  return {
    label: "Workspace 文件",
    name: "workspace_file",
    description: `读取和更新用户的 workspace 配置文件。支持以下操作：

- read: 读取指定 workspace 文件的内容
- update: 更新指定 workspace 文件的内容

可操作的文件：
- SOUL.md: 你的性格和行为模式定义
- IDENTITY.md: 你的身份和角色定义
- AGENTS.md: 可用代理的配置
- TOOLS.md: 可用工具的配置
- HEARTBEAT.md: 定时心跳任务配置

使用场景：
- 当用户要求修改你的性格或说话风格时，读取并更新 SOUL.md
- 当用户要求修改你的身份定义时，读取并更新 IDENTITY.md
- 需要查看当前配置时，使用 read 操作`,
    parameters: WorkspaceFileToolSchema,

    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });

      switch (action) {
        case "read":
          return handleRead(params);
        case "update":
          return handleUpdate(params);
        default:
          throw new Error(`未知的 action: ${action}`);
      }
    },
  };
}

/**
 * 记录审计日志（fire-and-forget，不阻塞主流程）
 */
function logAudit(params: {
  userId: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): void {
  try {
    const db = getDatabase();
    const auditRepo = getMemoryAuditRepository(db);

    auditRepo
      .log({
        userId: params.userId,
        action: params.action as Parameters<typeof auditRepo.log>[0]["action"],
        source: "agent",
        targetId: params.targetId,
        details: params.details,
      })
      .catch((err) => {
        logger.warn(`[workspace-file-tool] 审计日志写入失败`, err);
      });
  } catch (err) {
    logger.warn(`[workspace-file-tool] 审计日志初始化失败`, err);
  }
}

/**
 * 获取当前用户 ID，无用户上下文时返回错误结果
 */
function requireUserId(): { userId: string } | { error: string } {
  const userContext = getUserContext();

  if (!userContext || !userContext.userId) {
    return { error: "无法获取用户上下文，当前未绑定用户" };
  }

  return { userId: userContext.userId };
}

/**
 * 处理 read 操作：读取 workspace 文件
 */
async function handleRead(params: Record<string, unknown>) {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  const fileName = readStringParam(params, "fileName", { required: true });

  logger.debug(`[workspace-file-tool] read, userId=${userId}, fileName=${fileName}`);

  const db = getDatabase();
  const repo = getUserWorkspaceFilesRepository(db, userId);

  const file = await repo.getByFileName(fileName as WorkspaceFileName);

  logAudit({
    userId,
    action: "read_workspace_file",
    details: { fileName, found: !!file },
  });

  if (!file) {
    return jsonResult({
      ok: true,
      fileName,
      content: null,
      message: `文件 ${fileName} 尚未创建，可使用 update 操作写入内容`,
    });
  }

  return jsonResult({
    ok: true,
    fileName: file.fileName,
    content: file.content,
    isCustomized: file.isCustomized,
    updatedAt: file.updatedAt?.toISOString(),
  });
}

/**
 * 处理 update 操作：更新 workspace 文件
 */
async function handleUpdate(params: Record<string, unknown>) {
  const userResult = requireUserId();
  if ("error" in userResult) {
    return jsonResult(userResult);
  }
  const { userId } = userResult;

  const fileName = readStringParam(params, "fileName", { required: true });
  const content = readStringParam(params, "content", { allowEmpty: true });

  if (content === undefined) {
    return jsonResult({ error: "content 是必填参数：请提供文件新内容" });
  }

  logger.debug(
    `[workspace-file-tool] update, userId=${userId}, fileName=${fileName}, contentLength=${content.length}`,
  );

  const db = getDatabase();
  const repo = getUserWorkspaceFilesRepository(db, userId);

  const file = await repo.upsert(fileName as WorkspaceFileName, content);

  logAudit({
    userId,
    action: "update_workspace_file",
    targetId: file.id,
    details: { fileName, contentLength: content.length },
  });

  return jsonResult({
    ok: true,
    fileName: file.fileName,
    message: `已更新 ${fileName}（${content.length} 字符）`,
    isCustomized: file.isCustomized,
    updatedAt: file.updatedAt?.toISOString(),
  });
}
