/**
 * 记忆迁移命令
 *
 * 将本地文件系统中的 workspace .md 文件迁移到数据库。
 * 支持 --dry-run 预览模式和 --user-id 指定目标用户。
 *
 * 用法: mtbot memory migrate [--dry-run] [--user-id <id>] [--workspace-dir <path>]
 */

import fs from "node:fs/promises";
import path from "node:path";

import { getDatabase } from "../db/connection.js";
import { getUserWorkspaceFilesRepository } from "../db/repositories/user-workspace-files.js";
import { getMemoryAuditRepository } from "../db/repositories/memory-audit.js";
import { WORKSPACE_FILE_NAMES, type WorkspaceFileName } from "../db/schema/user-workspace-files.js";
import {
  resolveDefaultAgentWorkspaceDir,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
} from "../agents/workspace.js";
import { defaultRuntime } from "../runtime.js";

/** 迁移选项 */
export interface MigrateOptions {
  dryRun?: boolean;
  userId?: string;
  workspaceDir?: string;
  verbose?: boolean;
}

/** 单个文件的迁移结果 */
interface FileMigrationResult {
  fileName: WorkspaceFileName;
  status: "migrated" | "skipped" | "not_found" | "error";
  contentLength?: number;
  error?: string;
}

/** 迁移汇总 */
interface MigrationSummary {
  userId: string;
  workspaceDir: string;
  dryRun: boolean;
  results: FileMigrationResult[];
  totalMigrated: number;
  totalSkipped: number;
  totalNotFound: number;
  totalErrors: number;
}

/**
 * 文件名到默认常量的映射
 */
const FILE_MAP: Record<string, WorkspaceFileName> = {
  [DEFAULT_SOUL_FILENAME]: "SOUL.md",
  [DEFAULT_IDENTITY_FILENAME]: "IDENTITY.md",
  [DEFAULT_AGENTS_FILENAME]: "AGENTS.md",
  [DEFAULT_TOOLS_FILENAME]: "TOOLS.md",
  [DEFAULT_HEARTBEAT_FILENAME]: "HEARTBEAT.md",
};

/**
 * 读取文件内容（安全方式）
 *
 * @param filePath - 文件路径
 * @returns 文件内容或 null（文件不存在时）
 */
async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * 执行记忆迁移
 *
 * @param opts - 迁移选项
 * @returns 迁移汇总
 */
export async function runMemoryMigrate(opts: MigrateOptions): Promise<MigrationSummary> {
  const dryRun = Boolean(opts.dryRun);
  const userId = opts.userId ?? "default";
  const workspaceDir = opts.workspaceDir ?? resolveDefaultAgentWorkspaceDir();

  defaultRuntime.log(`[memory-migrate] 开始迁移 workspace 文件到数据库`);
  defaultRuntime.log(`  用户 ID: ${userId}`);
  defaultRuntime.log(`  Workspace 目录: ${workspaceDir}`);
  defaultRuntime.log(`  模式: ${dryRun ? "DRY RUN（预览）" : "实际执行"}`);
  defaultRuntime.log("");

  const results: FileMigrationResult[] = [];

  for (const fileName of WORKSPACE_FILE_NAMES) {
    const filePath = path.join(workspaceDir, fileName);
    const content = await readFileContent(filePath);

    if (content === null) {
      defaultRuntime.log(`  [SKIP] ${fileName} — 文件不存在`);
      results.push({ fileName, status: "not_found" });
      continue;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      defaultRuntime.log(`  [SKIP] ${fileName} — 文件为空`);
      results.push({ fileName, status: "skipped", contentLength: 0 });
      continue;
    }

    if (dryRun) {
      defaultRuntime.log(`  [DRY RUN] ${fileName} — 将迁移 (${trimmedContent.length} 字符)`);
      results.push({
        fileName,
        status: "migrated",
        contentLength: trimmedContent.length,
      });
      continue;
    }

    try {
      const db = getDatabase();
      const repo = getUserWorkspaceFilesRepository(db, userId);

      // 检查是否已存在
      const existing = await repo.getByFileName(fileName);
      if (existing) {
        defaultRuntime.log(`  [SKIP] ${fileName} — 数据库中已存在 (id=${existing.id})`);
        results.push({
          fileName,
          status: "skipped",
          contentLength: existing.content.length,
        });
        continue;
      }

      // 写入数据库
      const created = await repo.upsert(fileName, trimmedContent);
      defaultRuntime.log(
        `  [OK] ${fileName} — 已迁移 (${trimmedContent.length} 字符, id=${created.id})`,
      );

      // 记录审计日志
      const auditRepo = getMemoryAuditRepository(db);
      auditRepo
        .log({
          userId,
          action: "update_workspace_file",
          source: "system",
          targetId: created.id,
          details: {
            fileName,
            extra: {
              contentLength: trimmedContent.length,
              migratedFrom: filePath,
            },
          },
        })
        .catch(() => {});

      results.push({
        fileName,
        status: "migrated",
        contentLength: trimmedContent.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      defaultRuntime.error(`  [ERROR] ${fileName} — ${message}`);
      results.push({ fileName, status: "error", error: message });
    }
  }

  const summary: MigrationSummary = {
    userId,
    workspaceDir,
    dryRun,
    results,
    totalMigrated: results.filter((r) => r.status === "migrated").length,
    totalSkipped: results.filter((r) => r.status === "skipped").length,
    totalNotFound: results.filter((r) => r.status === "not_found").length,
    totalErrors: results.filter((r) => r.status === "error").length,
  };

  // 打印汇总
  defaultRuntime.log("");
  defaultRuntime.log(`[memory-migrate] 迁移完成`);
  defaultRuntime.log(`  迁移: ${summary.totalMigrated}`);
  defaultRuntime.log(`  跳过: ${summary.totalSkipped}`);
  defaultRuntime.log(`  未找到: ${summary.totalNotFound}`);
  if (summary.totalErrors > 0) {
    defaultRuntime.log(`  错误: ${summary.totalErrors}`);
  }

  return summary;
}
