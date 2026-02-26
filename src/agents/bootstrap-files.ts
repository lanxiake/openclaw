/**
 * Bootstrap 文件加载器
 *
 * 支持数据库优先加载（多用户隔离），文件系统 fallback。
 * 当 userContext.workspaceFiles 存在时，从数据库 Map 构建 bootstrap 文件，
 * 不存在时 fallback 到文件系统加载。
 */

import type { MtBotConfig } from "../config/config.js";
import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import {
  filterBootstrapFilesForSession,
  loadWorkspaceBootstrapFiles,
  type WorkspaceBootstrapFile,
} from "./workspace.js";
import { buildBootstrapContextFiles, resolveBootstrapMaxChars } from "./pi-embedded-helpers.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import type { UserAgentContext } from "./user-context.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

export function makeBootstrapWarn(params: {
  sessionLabel: string;
  warn?: (message: string) => void;
}): ((message: string) => void) | undefined {
  if (!params.warn) {
    return undefined;
  }
  return (message: string) => params.warn?.(`${message} (sessionKey=${params.sessionLabel})`);
}

/**
 * 从数据库 workspace 文件 Map 构建 WorkspaceBootstrapFile 数组
 *
 * @param workspaceFiles - 文件名到内容的映射
 * @returns WorkspaceBootstrapFile 数组
 */
function buildBootstrapFilesFromMap(workspaceFiles: Map<string, string>): WorkspaceBootstrapFile[] {
  const files: WorkspaceBootstrapFile[] = [];

  for (const [fileName, content] of workspaceFiles) {
    files.push({
      name: fileName as WorkspaceBootstrapFile["name"],
      path: fileName,
      content,
      missing: false,
    });
  }

  logger.debug(`[bootstrap-files] 从数据库构建 bootstrap 文件, count=${files.length}`);

  return files;
}

export async function resolveBootstrapFilesForRun(params: {
  workspaceDir: string;
  config?: MtBotConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  /** 用户上下文（包含数据库 workspace 文件），数据库优先加载 */
  userContext?: UserAgentContext;
}): Promise<WorkspaceBootstrapFile[]> {
  const sessionKey = params.sessionKey ?? params.sessionId;

  // 数据库优先：如果用户上下文中有 workspace 文件，从 Map 构建
  let rawBootstrapFiles: WorkspaceBootstrapFile[];

  if (params.userContext?.workspaceFiles && params.userContext.workspaceFiles.size > 0) {
    logger.debug(
      `[bootstrap-files] 使用数据库 workspace 文件, userId=${params.userContext.userId}, count=${params.userContext.workspaceFiles.size}`,
    );
    rawBootstrapFiles = buildBootstrapFilesFromMap(params.userContext.workspaceFiles);
  } else {
    // Fallback: 从文件系统加载
    logger.debug("[bootstrap-files] 从文件系统加载 workspace 文件");
    rawBootstrapFiles = await loadWorkspaceBootstrapFiles(params.workspaceDir);
  }

  const bootstrapFiles = filterBootstrapFilesForSession(rawBootstrapFiles, sessionKey);

  return applyBootstrapHookOverrides({
    files: bootstrapFiles,
    workspaceDir: params.workspaceDir,
    config: params.config,
    sessionKey: params.sessionKey,
    sessionId: params.sessionId,
    agentId: params.agentId,
  });
}

export async function resolveBootstrapContextForRun(params: {
  workspaceDir: string;
  config?: MtBotConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  warn?: (message: string) => void;
  /** 用户上下文（包含数据库 workspace 文件），数据库优先加载 */
  userContext?: UserAgentContext;
}): Promise<{
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
}> {
  const bootstrapFiles = await resolveBootstrapFilesForRun(params);
  const contextFiles = buildBootstrapContextFiles(bootstrapFiles, {
    maxChars: resolveBootstrapMaxChars(params.config),
    warn: params.warn,
  });
  return { bootstrapFiles, contextFiles };
}
