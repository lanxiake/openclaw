/**
 * 记忆默认模板种子数据
 *
 * 将 docs/reference/templates/ 目录下的 workspace 模板文件内容
 * 写入 system_configs 表（group=memory），作为默认模板供新用户初始化。
 *
 * 幂等执行：已存在的配置不会被覆盖。
 */

import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { getDatabase, generateId } from "../index.js";
import { systemConfigs, CONFIG_KEYS, CONFIG_GROUPS } from "../schema/system-config.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/**
 * 模板文件名到配置键的映射
 */
const TEMPLATE_CONFIG_MAP: Record<string, string> = {
  "SOUL.md": CONFIG_KEYS.MEMORY_DEFAULT_SOUL,
  "IDENTITY.md": CONFIG_KEYS.MEMORY_DEFAULT_IDENTITY,
  "AGENTS.md": CONFIG_KEYS.MEMORY_DEFAULT_AGENTS,
  "TOOLS.md": CONFIG_KEYS.MEMORY_DEFAULT_TOOLS,
  "HEARTBEAT.md": CONFIG_KEYS.MEMORY_DEFAULT_HEARTBEAT,
};

/**
 * 从模板文件内容中去除 YAML frontmatter
 *
 * @param content - 原始文件内容
 * @returns 去除 frontmatter 后的内容
 */
function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterRegex, "").trim();
}

/**
 * 获取模板文件目录路径
 *
 * 优先使用 import.meta.url 相对路径（源码开发环境），
 * 若路径不存在则 fallback 到 process.cwd() + docs/reference/templates/（编译后部署环境）。
 *
 * @returns 模板文件所在目录的绝对路径
 */
function getTemplatesDir(): string {
  // 方案 1: 从当前文件位置回溯到项目根目录（源码环境: src/db/seed/ → ../../..）
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const primaryPath = join(currentDir, "..", "..", "..", "docs", "reference", "templates");
  if (existsSync(primaryPath)) {
    logger.debug(`[memory-defaults] 使用 import.meta.url 路径: ${primaryPath}`);
    return primaryPath;
  }

  // 方案 2: 从编译产物位置回溯（dist/db/seed/ → ../../..）
  const distPath = join(currentDir, "..", "..", "docs", "reference", "templates");
  if (existsSync(distPath)) {
    logger.debug(`[memory-defaults] 使用 dist 相对路径: ${distPath}`);
    return distPath;
  }

  // 方案 3: fallback 到 process.cwd()（部署环境）
  const cwdPath = join(process.cwd(), "docs", "reference", "templates");
  logger.debug(`[memory-defaults] fallback 到 cwd 路径: ${cwdPath}`);
  return cwdPath;
}

/**
 * 读取单个模板文件内容
 *
 * @param fileName - 模板文件名
 * @returns 去除 frontmatter 后的模板内容，文件不存在返回 null
 */
async function readTemplateFile(fileName: string): Promise<string | null> {
  try {
    const filePath = join(getTemplatesDir(), fileName);
    const content = await readFile(filePath, "utf-8");
    logger.debug(`[memory-defaults] 读取模板文件: ${fileName}, 大小=${content.length}`);
    return stripFrontmatter(content);
  } catch (error) {
    logger.warn(`[memory-defaults] 模板文件不存在或读取失败: ${fileName}`);
    return null;
  }
}

/**
 * 种子默认记忆模板到 system_configs 表
 *
 * 遍历所有模板文件，对于 system_configs 中不存在的配置键，
 * 从文件读取内容并插入。已存在的配置不会被覆盖（幂等）。
 *
 * @returns 新插入的模板数量
 */
export async function seedMemoryDefaults(): Promise<number> {
  logger.info("[memory-defaults] 开始种子默认记忆模板...");

  const db = getDatabase();
  let insertedCount = 0;

  for (const [fileName, configKey] of Object.entries(TEMPLATE_CONFIG_MAP)) {
    // 检查配置是否已存在
    const [existing] = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, configKey))
      .limit(1);

    if (existing) {
      logger.debug(`[memory-defaults] 配置已存在, 跳过: ${configKey}`);
      continue;
    }

    // 读取模板文件
    const content = await readTemplateFile(fileName);
    if (!content) {
      logger.warn(`[memory-defaults] 无法读取模板, 跳过: ${fileName}`);
      continue;
    }

    // 插入配置
    const id = generateId();
    await db.insert(systemConfigs).values({
      id,
      key: configKey,
      value: content,
      valueType: "string",
      group: CONFIG_GROUPS.MEMORY,
      description: `默认 ${fileName} 模板内容，新用户初始化时使用`,
      isSensitive: false,
      isReadonly: false,
      requiresRestart: false,
      defaultValue: content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    insertedCount++;
    logger.info(`[memory-defaults] 插入模板: ${configKey} (${fileName})`);
  }

  logger.info(`[memory-defaults] 种子完成, 新插入 ${insertedCount} 个模板`);
  return insertedCount;
}

/**
 * 获取所有默认记忆模板
 *
 * @returns 模板配置键到内容的 Map
 */
export async function getMemoryDefaults(): Promise<Map<string, string>> {
  logger.debug("[memory-defaults] 获取所有默认记忆模板");

  const db = getDatabase();
  const configKeys = Object.values(TEMPLATE_CONFIG_MAP);

  const defaults = new Map<string, string>();

  for (const key of configKeys) {
    const [config] = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);

    if (config) {
      // system_configs 的 value 是 jsonb 类型，可能是字符串或已解析
      const content = typeof config.value === "string" ? config.value : String(config.value);
      defaults.set(key, content);
    }
  }

  logger.debug(`[memory-defaults] 获取到 ${defaults.size} 个模板`);
  return defaults;
}

/**
 * 获取所有默认记忆模板（按文件名索引）
 *
 * 从 system_configs 查询默认模板，将 configKey 转换为 fileName 作为 key。
 * 用于 initializeForUser() 期望的 Map<fileName, content> 格式。
 *
 * @returns 文件名到内容的 Map（如 "SOUL.md" → 内容）
 */
export async function getMemoryDefaultsByFileName(): Promise<Map<string, string>> {
  logger.debug("[memory-defaults] 获取所有默认记忆模板 (按文件名索引)");

  const defaults = await getMemoryDefaults();
  const result = new Map<string, string>();

  for (const [configKey, content] of defaults) {
    const fileName = getFileNameFromConfigKey(configKey);
    if (fileName) {
      result.set(fileName, content);
    }
  }

  logger.debug(`[memory-defaults] 按文件名索引获取到 ${result.size} 个模板`);
  return result;
}

/**
 * 获取配置键对应的文件名
 *
 * @param configKey - system_configs 的 key
 * @returns 对应的 workspace 文件名
 */
export function getFileNameFromConfigKey(configKey: string): string | null {
  for (const [fileName, key] of Object.entries(TEMPLATE_CONFIG_MAP)) {
    if (key === configKey) {
      return fileName;
    }
  }
  return null;
}

/**
 * 获取文件名对应的配置键
 *
 * @param fileName - workspace 文件名
 * @returns 对应的 system_configs 的 key
 */
export function getConfigKeyFromFileName(fileName: string): string | null {
  return TEMPLATE_CONFIG_MAP[fileName] ?? null;
}

/**
 * 从原始文件重新加载模板并更新 system_configs
 *
 * @param configKey - 要重置的配置键，不传则重置所有
 * @returns 重置的模板数量
 */
export async function resetMemoryDefaultsFromFiles(configKey?: string): Promise<number> {
  logger.info(`[memory-defaults] 从文件重置模板: ${configKey ?? "全部"}`);

  const db = getDatabase();
  let resetCount = 0;

  const entries = configKey
    ? Object.entries(TEMPLATE_CONFIG_MAP).filter(([, key]) => key === configKey)
    : Object.entries(TEMPLATE_CONFIG_MAP);

  for (const [fileName, key] of entries) {
    const content = await readTemplateFile(fileName);
    if (!content) {
      logger.warn(`[memory-defaults] 无法读取模板文件, 跳过: ${fileName}`);
      continue;
    }

    // 检查是否已存在
    const [existing] = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);

    if (existing) {
      // 更新
      await db
        .update(systemConfigs)
        .set({
          value: content,
          defaultValue: content,
          updatedAt: new Date(),
        })
        .where(eq(systemConfigs.key, key));
    } else {
      // 插入
      const id = generateId();
      await db.insert(systemConfigs).values({
        id,
        key,
        value: content,
        valueType: "string",
        group: CONFIG_GROUPS.MEMORY,
        description: `默认 ${fileName} 模板内容，新用户初始化时使用`,
        isSensitive: false,
        isReadonly: false,
        requiresRestart: false,
        defaultValue: content,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    resetCount++;
    logger.info(`[memory-defaults] 重置模板: ${key} (${fileName})`);
  }

  logger.info(`[memory-defaults] 重置完成, 共 ${resetCount} 个模板`);
  return resetCount;
}
