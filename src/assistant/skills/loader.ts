/**
 * AI 助理技能加载器
 *
 * 负责发现、加载、验证和管理技能
 * 支持内置技能、已安装技能、工作空间技能
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { createSubsystemLogger } from "../../shared/logging/subsystem.js";
import type {
  AssistantSkillDefinition,
  AssistantSkillMetadata,
  SkillManifest,
  SkillRecord,
  SkillRegistry,
  SkillLoadStatus,
} from "./types.js";

// 日志
const log = createSubsystemLogger("skill-loader");

// === 技能发现 ===

/**
 * 技能候选项
 */
interface SkillCandidate {
  /** 技能目录路径 */
  path: string;
  /** 清单文件路径 */
  manifestPath: string;
  /** 来源类型 */
  origin: "builtin" | "installed" | "workspace" | "remote";
}

/**
 * 技能加载器配置
 */
export interface SkillLoaderConfig {
  /** 内置技能目录 */
  builtinDir?: string;
  /** 已安装技能目录 */
  installedDir?: string;
  /** 工作空间技能目录 */
  workspaceDir?: string;
  /** 额外技能路径 */
  extraPaths?: string[];
  /** 是否启用远程技能 */
  enableRemote?: boolean;
}

/**
 * 获取默认技能目录
 */
function getDefaultSkillDirs(): { builtin: string; installed: string } {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return {
    builtin: join(dirname(import.meta.url.replace("file:///", "")), "../../../skills/builtin"),
    installed: join(homeDir, ".openclaw", "assistant-skills"),
  };
}

/**
 * 发现技能候选项
 */
async function discoverSkillCandidates(config: SkillLoaderConfig): Promise<SkillCandidate[]> {
  const candidates: SkillCandidate[] = [];
  const defaults = getDefaultSkillDirs();

  // 收集所有要扫描的目录
  const dirsToScan: Array<{ dir: string; origin: SkillCandidate["origin"] }> = [];

  // 内置技能
  const builtinDir = config.builtinDir || defaults.builtin;
  if (existsSync(builtinDir)) {
    dirsToScan.push({ dir: builtinDir, origin: "builtin" });
  }

  // 已安装技能
  const installedDir = config.installedDir || defaults.installed;
  if (existsSync(installedDir)) {
    dirsToScan.push({ dir: installedDir, origin: "installed" });
  }

  // 工作空间技能
  if (config.workspaceDir && existsSync(config.workspaceDir)) {
    dirsToScan.push({ dir: config.workspaceDir, origin: "workspace" });
  }

  // 额外路径
  for (const extraPath of config.extraPaths || []) {
    if (existsSync(extraPath)) {
      dirsToScan.push({ dir: extraPath, origin: "installed" });
    }
  }

  // 扫描每个目录
  for (const { dir, origin } of dirsToScan) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillDir = join(dir, entry.name);
        const manifestPath = join(skillDir, "skill.json");

        if (existsSync(manifestPath)) {
          candidates.push({
            path: skillDir,
            manifestPath,
            origin,
          });
          log.debug(`发现技能候选: ${entry.name}`, { origin, path: skillDir });
        }
      }
    } catch (error) {
      log.warn(`扫描技能目录失败: ${dir}`, { error: String(error) });
    }
  }

  log.info(`发现 ${candidates.length} 个技能候选`, {
    builtin: candidates.filter((c) => c.origin === "builtin").length,
    installed: candidates.filter((c) => c.origin === "installed").length,
    workspace: candidates.filter((c) => c.origin === "workspace").length,
  });

  return candidates;
}

// === 技能加载 ===

/**
 * 解析技能清单
 */
async function parseSkillManifest(manifestPath: string): Promise<SkillManifest | null> {
  try {
    const content = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as SkillManifest;

    // 基本验证
    if (!manifest.manifestVersion || manifest.manifestVersion !== "1.0") {
      log.warn(`无效的清单版本: ${manifestPath}`, { version: manifest.manifestVersion });
      return null;
    }

    if (!manifest.metadata?.id || !manifest.metadata?.name) {
      log.warn(`缺少必需的元数据: ${manifestPath}`);
      return null;
    }

    if (!manifest.main) {
      log.warn(`缺少入口文件: ${manifestPath}`);
      return null;
    }

    return manifest;
  } catch (error) {
    log.error(`解析技能清单失败: ${manifestPath}`, { error: String(error) });
    return null;
  }
}

/**
 * 加载技能模块
 */
async function loadSkillModule(
  skillDir: string,
  manifest: SkillManifest,
): Promise<AssistantSkillDefinition | null> {
  const mainPath = join(skillDir, manifest.main);

  if (!existsSync(mainPath)) {
    log.error(`技能入口文件不存在: ${mainPath}`);
    return null;
  }

  try {
    // 动态导入技能模块
    const module = await import(`file://${mainPath.replace(/\\/g, "/")}`);

    // 检查默认导出
    const definition = module.default as AssistantSkillDefinition;

    if (!definition || typeof definition.execute !== "function") {
      log.error(`技能缺少有效的 execute 函数: ${manifest.metadata.id}`);
      return null;
    }

    // 合并清单中的元数据
    return {
      ...definition,
      metadata: {
        ...manifest.metadata,
        ...definition.metadata,
      },
      triggers: manifest.triggers || definition.triggers || [],
      parameters: manifest.parameters || definition.parameters,
    };
  } catch (error) {
    log.error(`加载技能模块失败: ${manifest.metadata.id}`, { error: String(error) });
    return null;
  }
}

/**
 * 创建技能记录
 */
function createSkillRecord(
  candidate: SkillCandidate,
  manifest: SkillManifest,
  definition: AssistantSkillDefinition | null,
  error?: string,
): SkillRecord {
  const status: SkillLoadStatus = error ? "error" : definition ? "loaded" : "pending";

  return {
    id: manifest.metadata.id,
    metadata: manifest.metadata,
    status,
    error,
    source: candidate.path,
    origin: candidate.origin,
    definition: definition || undefined,
    loadedAt: definition ? new Date() : undefined,
    executionCount: 0,
  };
}

// === 技能注册表 ===

/**
 * 创建空的技能注册表
 */
export function createEmptySkillRegistry(): SkillRegistry {
  return {
    skills: new Map(),
    commandMap: new Map(),
    keywordMap: new Map(),
    eventMap: new Map(),
    tools: [],
    version: 0,
  };
}

/**
 * 构建技能索引
 */
function buildSkillIndexes(registry: SkillRegistry): void {
  registry.commandMap.clear();
  registry.keywordMap.clear();
  registry.eventMap.clear();
  registry.tools = [];

  for (const [skillId, record] of registry.skills) {
    if (record.status !== "loaded" || !record.definition) {
      continue;
    }

    const definition = record.definition;

    // 索引触发器
    for (const trigger of definition.triggers) {
      if (trigger.type === "command" && trigger.command) {
        registry.commandMap.set(trigger.command, skillId);
      }

      if (trigger.type === "keyword" && trigger.keywords) {
        for (const keyword of trigger.keywords) {
          const existing = registry.keywordMap.get(keyword) || [];
          existing.push(skillId);
          registry.keywordMap.set(keyword, existing);
        }
      }

      if (trigger.type === "event" && trigger.event) {
        const existing = registry.eventMap.get(trigger.event) || [];
        existing.push(skillId);
        registry.eventMap.set(trigger.event, existing);
      }
    }

    // 收集工具
    if (definition.tools) {
      registry.tools.push(...definition.tools);
    }
  }

  log.debug("技能索引构建完成", {
    commands: registry.commandMap.size,
    keywords: registry.keywordMap.size,
    events: registry.eventMap.size,
    tools: registry.tools.length,
  });
}

// === 主加载函数 ===

/**
 * 加载所有技能
 */
export async function loadAssistantSkills(config: SkillLoaderConfig = {}): Promise<SkillRegistry> {
  log.info("开始加载 AI 助理技能");

  const registry = createEmptySkillRegistry();

  // 发现技能候选
  const candidates = await discoverSkillCandidates(config);

  // 加载每个技能
  for (const candidate of candidates) {
    const manifest = await parseSkillManifest(candidate.manifestPath);

    if (!manifest) {
      continue;
    }

    // 检查是否已存在 (后发现的优先)
    if (registry.skills.has(manifest.metadata.id)) {
      log.debug(`跳过重复技能: ${manifest.metadata.id}`, {
        existing: registry.skills.get(manifest.metadata.id)?.origin,
        new: candidate.origin,
      });
      continue;
    }

    // 加载技能模块
    const definition = await loadSkillModule(candidate.path, manifest);
    const record = createSkillRecord(candidate, manifest, definition);

    // 初始化技能
    if (definition?.init) {
      try {
        await definition.init();
        log.debug(`技能初始化完成: ${manifest.metadata.id}`);
      } catch (error) {
        log.error(`技能初始化失败: ${manifest.metadata.id}`, { error: String(error) });
        record.status = "error";
        record.error = `初始化失败: ${error}`;
      }
    }

    registry.skills.set(manifest.metadata.id, record);
    log.info(`加载技能: ${manifest.metadata.name}`, {
      id: manifest.metadata.id,
      status: record.status,
      origin: record.origin,
    });
  }

  // 构建索引
  buildSkillIndexes(registry);
  registry.version = Date.now();

  log.info(`技能加载完成`, {
    total: registry.skills.size,
    loaded: Array.from(registry.skills.values()).filter((r) => r.status === "loaded").length,
    error: Array.from(registry.skills.values()).filter((r) => r.status === "error").length,
  });

  return registry;
}

/**
 * 卸载技能
 */
export async function unloadSkill(registry: SkillRegistry, skillId: string): Promise<boolean> {
  const record = registry.skills.get(skillId);

  if (!record) {
    log.warn(`技能不存在: ${skillId}`);
    return false;
  }

  // 调用清理函数
  if (record.definition?.cleanup) {
    try {
      await record.definition.cleanup();
      log.debug(`技能清理完成: ${skillId}`);
    } catch (error) {
      log.error(`技能清理失败: ${skillId}`, { error: String(error) });
    }
  }

  // 从注册表移除
  registry.skills.delete(skillId);

  // 重建索引
  buildSkillIndexes(registry);
  registry.version = Date.now();

  log.info(`技能已卸载: ${skillId}`);
  return true;
}

/**
 * 重新加载技能
 */
export async function reloadSkill(registry: SkillRegistry, skillId: string): Promise<boolean> {
  const record = registry.skills.get(skillId);

  if (!record) {
    log.warn(`技能不存在: ${skillId}`);
    return false;
  }

  // 卸载现有技能
  await unloadSkill(registry, skillId);

  // 重新加载
  const manifest = await parseSkillManifest(join(record.source, "skill.json"));

  if (!manifest) {
    return false;
  }

  const definition = await loadSkillModule(record.source, manifest);
  const newRecord = createSkillRecord(
    { path: record.source, manifestPath: join(record.source, "skill.json"), origin: record.origin },
    manifest,
    definition,
  );

  if (definition?.init) {
    try {
      await definition.init();
    } catch (error) {
      newRecord.status = "error";
      newRecord.error = `初始化失败: ${error}`;
    }
  }

  registry.skills.set(skillId, newRecord);
  buildSkillIndexes(registry);
  registry.version = Date.now();

  log.info(`技能重新加载: ${skillId}`, { status: newRecord.status });
  return newRecord.status === "loaded";
}

// === 技能查询 ===

/**
 * 根据命令查找技能
 */
export function findSkillByCommand(registry: SkillRegistry, command: string): SkillRecord | null {
  const skillId = registry.commandMap.get(command);

  if (!skillId) {
    return null;
  }

  return registry.skills.get(skillId) || null;
}

/**
 * 根据关键词查找技能
 */
export function findSkillsByKeyword(registry: SkillRegistry, keyword: string): SkillRecord[] {
  const skillIds = registry.keywordMap.get(keyword) || [];
  return skillIds
    .map((id) => registry.skills.get(id))
    .filter((r): r is SkillRecord => r !== undefined);
}

/**
 * 获取所有已加载的技能
 */
export function getLoadedSkills(registry: SkillRegistry): SkillRecord[] {
  return Array.from(registry.skills.values()).filter((r) => r.status === "loaded");
}

/**
 * 获取所有技能工具
 */
export function getAllSkillTools(registry: SkillRegistry): typeof registry.tools {
  return registry.tools;
}

// === 技能安装/卸载 ===

/**
 * 技能安装选项
 */
export interface SkillInstallOptions {
  /** 安装来源 URL */
  sourceUrl?: string;
  /** 本地路径 */
  localPath?: string;
  /** 强制覆盖 */
  force?: boolean;
}

/**
 * 安装技能
 * @param registry 技能注册表
 * @param options 安装选项
 */
export async function installSkill(
  registry: SkillRegistry,
  options: SkillInstallOptions,
): Promise<{ success: boolean; skillId?: string; error?: string }> {
  const { sourceUrl, localPath, force } = options;

  if (!sourceUrl && !localPath) {
    return { success: false, error: "需要提供 sourceUrl 或 localPath" };
  }

  try {
    let skillDir: string;

    if (localPath) {
      // 本地安装
      skillDir = localPath;
    } else if (sourceUrl) {
      // 远程安装 - TODO: 实现下载逻辑
      return { success: false, error: "远程安装暂未实现" };
    } else {
      return { success: false, error: "无效的安装来源" };
    }

    // 检查清单文件
    const manifestPath = join(skillDir, "skill.json");
    if (!existsSync(manifestPath)) {
      return { success: false, error: `技能清单不存在: ${manifestPath}` };
    }

    const manifest = await parseSkillManifest(manifestPath);
    if (!manifest) {
      return { success: false, error: "无效的技能清单" };
    }

    // 检查是否已存在
    if (registry.skills.has(manifest.metadata.id) && !force) {
      return { success: false, error: `技能已存在: ${manifest.metadata.id}，使用 force=true 覆盖` };
    }

    // 加载技能
    const definition = await loadSkillModule(skillDir, manifest);
    const record = createSkillRecord(
      { path: skillDir, manifestPath, origin: "installed" },
      manifest,
      definition,
    );

    // 初始化技能
    if (definition?.init) {
      try {
        await definition.init();
      } catch (error) {
        record.status = "error";
        record.error = `初始化失败: ${error}`;
      }
    }

    registry.skills.set(manifest.metadata.id, record);
    buildSkillIndexes(registry);
    registry.version = Date.now();

    log.info(`技能安装成功: ${manifest.metadata.id}`);
    return { success: true, skillId: manifest.metadata.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("技能安装失败", { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

// === 技能启用/禁用 ===

/**
 * 启用技能
 */
export async function enableSkill(registry: SkillRegistry, skillId: string): Promise<boolean> {
  const record = registry.skills.get(skillId);

  if (!record) {
    log.warn(`技能不存在: ${skillId}`);
    return false;
  }

  if (record.status === "loaded") {
    log.debug(`技能已启用: ${skillId}`);
    return true;
  }

  if (record.status === "disabled") {
    // 重新加载技能
    return reloadSkill(registry, skillId);
  }

  log.warn(`无法启用技能: ${skillId}，当前状态: ${record.status}`);
  return false;
}

/**
 * 禁用技能
 */
export async function disableSkill(registry: SkillRegistry, skillId: string): Promise<boolean> {
  const record = registry.skills.get(skillId);

  if (!record) {
    log.warn(`技能不存在: ${skillId}`);
    return false;
  }

  if (record.status === "disabled") {
    log.debug(`技能已禁用: ${skillId}`);
    return true;
  }

  // 调用清理函数
  if (record.definition?.cleanup) {
    try {
      await record.definition.cleanup();
    } catch (error) {
      log.error(`技能清理失败: ${skillId}`, { error: String(error) });
    }
  }

  // 更新状态
  record.status = "disabled";
  record.definition = undefined;

  // 重建索引
  buildSkillIndexes(registry);
  registry.version = Date.now();

  log.info(`技能已禁用: ${skillId}`);
  return true;
}

/**
 * 切换技能状态
 */
export async function toggleSkillStatus(
  registry: SkillRegistry,
  skillId: string,
): Promise<{ enabled: boolean; error?: string }> {
  const record = registry.skills.get(skillId);

  if (!record) {
    return { enabled: false, error: `技能不存在: ${skillId}` };
  }

  if (record.status === "loaded") {
    const success = await disableSkill(registry, skillId);
    return { enabled: !success };
  } else {
    const success = await enableSkill(registry, skillId);
    return { enabled: success };
  }
}

// === 技能配置 ===

/**
 * 技能配置存储
 */
const skillConfigs = new Map<string, Record<string, unknown>>();

/**
 * 获取技能配置
 */
export function getSkillConfig(skillId: string): Record<string, unknown> | null {
  return skillConfigs.get(skillId) || null;
}

/**
 * 设置技能配置
 */
export function setSkillConfig(skillId: string, config: Record<string, unknown>): void {
  skillConfigs.set(skillId, config);
  log.debug(`技能配置已更新: ${skillId}`, { keys: Object.keys(config) });
}

/**
 * 清除技能配置
 */
export function clearSkillConfig(skillId: string): void {
  skillConfigs.delete(skillId);
  log.debug(`技能配置已清除: ${skillId}`);
}

// === 技能统计 ===

/**
 * 获取技能统计信息
 */
export function getSkillStats(registry: SkillRegistry): {
  total: number;
  loaded: number;
  disabled: number;
  error: number;
  byCategory: Record<string, number>;
  byOrigin: Record<string, number>;
} {
  const skills = Array.from(registry.skills.values());

  const byCategory: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};

  for (const skill of skills) {
    // 按类别统计
    const category = skill.metadata.category || "custom";
    byCategory[category] = (byCategory[category] || 0) + 1;

    // 按来源统计
    byOrigin[skill.origin] = (byOrigin[skill.origin] || 0) + 1;
  }

  return {
    total: skills.length,
    loaded: skills.filter((s) => s.status === "loaded").length,
    disabled: skills.filter((s) => s.status === "disabled").length,
    error: skills.filter((s) => s.status === "error").length,
    byCategory,
    byOrigin,
  };
}

/**
 * 获取所有技能 (包括禁用的)
 */
export function getAllSkills(registry: SkillRegistry): SkillRecord[] {
  return Array.from(registry.skills.values());
}
