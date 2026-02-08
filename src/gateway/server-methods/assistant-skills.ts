/**
 * AI 助理技能系统 RPC 方法处理器
 *
 * 为客户端提供 AI 助理技能相关的 RPC 方法
 * 与现有 skills.ts 区分，专门服务于 Windows 助理
 */

import {
  loadAssistantSkills,
  executeSkill,
  executeSkillByCommand,
  getLoadedSkills,
  getAllSkillTools,
  findSkillByCommand,
  // 新增导入
  installSkill,
  enableSkill,
  disableSkill,
  toggleSkillStatus,
  getSkillConfig,
  setSkillConfig,
  getSkillStats,
  getAllSkills,
  unloadSkill,
  type SkillRegistry,
  type SkillLoaderConfig,
} from "../../assistant/skills/index.js";
import {
  queryStoreSkills,
  getStoreSkillDetail,
  getFeaturedSkills,
  getPopularSkills,
  getRecentSkills,
  getStoreStats,
  checkSkillUpdates,
  searchSkills,
  syncInstalledSkills,
  refreshStoreIndex,
  type StoreFilters,
} from "../../assistant/skills/store.js";
import {
  getCategoryList,
  createSkill as createStoreSkill,
} from "../../assistant/skills/skill-service.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// 日志标签
const LOG_TAG = "assistant-skills";

// 全局技能注册表 (懒加载)
let skillRegistry: SkillRegistry | null = null;

/**
 * 获取或初始化技能注册表
 */
async function getSkillRegistry(config?: SkillLoaderConfig): Promise<SkillRegistry> {
  if (!skillRegistry) {
    skillRegistry = await loadAssistantSkills(config);
  }
  return skillRegistry;
}

/**
 * 验证字符串参数
 */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required = false
): string | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }

  return value.trim();
}

/**
 * AI 助理技能系统 RPC 方法处理器
 */
export const assistantSkillHandlers: GatewayRequestHandlers = {
  /**
   * 获取已加载的技能列表
   */
  "assistant.skills.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能列表`);

      const registry = await getSkillRegistry();
      const skills = getLoadedSkills(registry);

      const skillList = skills.map((record) => ({
        id: record.id,
        name: record.metadata.name,
        description: record.metadata.description,
        version: record.metadata.version,
        category: record.metadata.category,
        icon: record.metadata.icon,
        status: record.status,
        origin: record.origin,
        runMode: record.metadata.runMode,
        subscription: record.metadata.subscription,
        executionCount: record.executionCount,
        lastExecutedAt: record.lastExecutedAt?.toISOString(),
      }));

      respond(true, { skills: skillList, total: skillList.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取技能详情
   */
  "assistant.skills.get": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId")
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 获取技能详情`, { skillId });

      const registry = await getSkillRegistry();
      const record = registry.skills.get(skillId);

      if (!record) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`)
        );
        return;
      }

      respond(
        true,
        {
          id: record.id,
          metadata: record.metadata,
          status: record.status,
          error: record.error,
          origin: record.origin,
          source: record.source,
          triggers: record.definition?.triggers,
          parameters: record.definition?.parameters,
          executionCount: record.executionCount,
          lastExecutedAt: record.lastExecutedAt?.toISOString(),
          loadedAt: record.loadedAt?.toISOString(),
        },
        undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 执行技能
   */
  "assistant.skills.execute": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const sessionId = validateStringParam(params, "sessionId");
      const skillParams = (params.params as Record<string, unknown>) || {};

      if (!skillId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId")
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 执行技能`, {
        skillId,
        sessionId,
        params: Object.keys(skillParams),
      });

      const registry = await getSkillRegistry();

      // 创建确认处理器 (通过 Gateway 广播到客户端)
      const confirmHandler = async (
        action: string,
        description: string,
        level: "low" | "medium" | "high"
      ): Promise<boolean> => {
        // TODO: 实现通过 Gateway 广播确认请求到客户端
        // 目前默认批准 (生产环境需要实现完整的确认流程)
        context.logGateway.warn(`[${LOG_TAG}] 技能请求确认 (自动批准)`, {
          skillId,
          action,
          level,
        });
        return true;
      };

      // 创建进度处理器
      const progressHandler = (
        _skillId: string,
        percent: number,
        message?: string
      ): void => {
        // TODO: 通过 Gateway 广播进度到客户端
        context.logGateway.debug(`[${LOG_TAG}] 技能进度`, {
          skillId,
          percent,
          message,
        });
      };

      const result = await executeSkill(
        registry,
        skillId,
        {
          sessionId,
          params: skillParams,
        },
        {
          confirmHandler,
          progressHandler,
          defaultTimeout: 120000,
        }
      );

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 技能执行失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 通过命令执行技能
   */
  "assistant.skills.executeByCommand": async ({ params, respond, context }) => {
    try {
      const command = validateStringParam(params, "command", true);
      const sessionId = validateStringParam(params, "sessionId");
      const args = validateStringParam(params, "args");

      if (!command) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing command")
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 通过命令执行技能`, { command, args });

      const registry = await getSkillRegistry();

      const result = await executeSkillByCommand(
        registry,
        command,
        {
          sessionId,
          args,
        },
        {
          defaultTimeout: 120000,
        }
      );

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取技能提供的工具
   */
  "assistant.skills.tools": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能工具列表`);

      const registry = await getSkillRegistry();
      const tools = getAllSkillTools(registry);

      const toolList = tools.map((tool) => ({
        name: tool.name,
        label: tool.label,
        description: tool.description,
      }));

      respond(true, { tools: toolList, total: toolList.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 重新加载技能
   */
  "assistant.skills.reload": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 重新加载技能`);

      // 重置注册表
      skillRegistry = null;
      const registry = await getSkillRegistry();

      const loadedCount = Array.from(registry.skills.values()).filter(
        (r) => r.status === "loaded"
      ).length;

      respond(
        true,
        {
          total: registry.skills.size,
          loaded: loadedCount,
          version: registry.version,
        },
        undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 重新加载技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 查找命令对应的技能
   */
  "assistant.skills.findByCommand": async ({ params, respond, context }) => {
    try {
      const command = validateStringParam(params, "command", true);

      if (!command) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing command")
        );
        return;
      }

      const registry = await getSkillRegistry();
      const record = findSkillByCommand(registry, command);

      if (!record) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `No skill found for command: ${command}`)
        );
        return;
      }

      respond(
        true,
        {
          id: record.id,
          name: record.metadata.name,
          description: record.metadata.description,
        },
        undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  // === 技能管理 RPC 方法 ===

  /**
   * 安装技能
   */
  "assistant.skills.install": async ({ params, respond, context }) => {
    try {
      const localPath = validateStringParam(params, "localPath");
      const sourceUrl = validateStringParam(params, "sourceUrl");
      const force = Boolean(params.force);

      context.logGateway.info(`[${LOG_TAG}] 安装技能`, { localPath, sourceUrl, force });

      const registry = await getSkillRegistry();
      const result = await installSkill(registry, { localPath, sourceUrl, force });

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 安装技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 卸载技能
   */
  "assistant.skills.uninstall": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 卸载技能`, { skillId });

      const registry = await getSkillRegistry();
      const success = await unloadSkill(registry, skillId);

      respond(true, { success, skillId }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 卸载技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 启用技能
   */
  "assistant.skills.enable": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 启用技能`, { skillId });

      const registry = await getSkillRegistry();
      const success = await enableSkill(registry, skillId);

      respond(true, { success, skillId, enabled: success }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 禁用技能
   */
  "assistant.skills.disable": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 禁用技能`, { skillId });

      const registry = await getSkillRegistry();
      const success = await disableSkill(registry, skillId);

      respond(true, { success, skillId, enabled: !success }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 切换技能状态
   */
  "assistant.skills.toggle": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 切换技能状态`, { skillId });

      const registry = await getSkillRegistry();
      const result = await toggleSkillStatus(registry, skillId);

      respond(true, { skillId, ...result }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取技能配置
   */
  "assistant.skills.getConfig": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      const config = getSkillConfig(skillId);
      respond(true, { skillId, config }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 设置技能配置
   */
  "assistant.skills.setConfig": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const config = params.config as Record<string, unknown>;

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      if (!config || typeof config !== "object") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 设置技能配置`, { skillId, keys: Object.keys(config) });

      setSkillConfig(skillId, config);
      respond(true, { success: true, skillId }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取技能统计信息
   */
  "assistant.skills.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能统计`);

      const registry = await getSkillRegistry();
      const stats = getSkillStats(registry);

      respond(true, stats, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取所有技能 (包括禁用的)
   */
  "assistant.skills.listAll": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取所有技能`);

      const registry = await getSkillRegistry();
      const skills = getAllSkills(registry);

      const skillList = skills.map((record) => ({
        id: record.id,
        name: record.metadata.name,
        description: record.metadata.description,
        version: record.metadata.version,
        category: record.metadata.category,
        icon: record.metadata.icon,
        status: record.status,
        origin: record.origin,
        runMode: record.metadata.runMode,
        subscription: record.metadata.subscription,
        executionCount: record.executionCount,
        lastExecutedAt: record.lastExecutedAt?.toISOString(),
        error: record.error,
      }));

      respond(true, { skills: skillList, total: skillList.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  // === 技能商店 RPC 方法 ===

  /**
   * 查询商店技能列表
   */
  "assistant.store.query": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 查询商店技能`, { params });

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      // 解析筛选条件
      const filters: StoreFilters = {
        category: params.category as string | undefined,
        subscription: params.subscription as StoreFilters["subscription"],
        sortBy: params.sortBy as StoreFilters["sortBy"],
        search: params.search as string | undefined,
        offset: typeof params.offset === "number" ? params.offset : 0,
        limit: typeof params.limit === "number" ? params.limit : 20,
      };

      if (params.tags && Array.isArray(params.tags)) {
        filters.tags = params.tags as string[];
      }

      const result = await queryStoreSkills(filters);

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 查询商店技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取商店技能详情
   */
  "assistant.store.detail": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 获取商店技能详情`, { skillId });

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const detail = await getStoreSkillDetail(skillId);

      if (!detail) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`));
        return;
      }

      respond(true, detail, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 获取推荐技能
   */
  "assistant.store.featured": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取推荐技能`);

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const limit = typeof params.limit === "number" ? params.limit : 3;
      const skills = await getFeaturedSkills(limit);

      respond(true, { skills, total: skills.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取热门技能
   */
  "assistant.store.popular": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取热门技能`);

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const limit = typeof params.limit === "number" ? params.limit : 4;
      const skills = await getPopularSkills(limit);

      respond(true, { skills, total: skills.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取最新技能
   */
  "assistant.store.recent": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取最新技能`);

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const limit = typeof params.limit === "number" ? params.limit : 4;
      const skills = await getRecentSkills(limit);

      respond(true, { skills, total: skills.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取商店统计信息
   */
  "assistant.store.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取商店统计`);

      const stats = await getStoreStats();

      respond(true, stats, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 搜索商店技能
   */
  "assistant.store.search": async ({ params, respond, context }) => {
    try {
      const query = validateStringParam(params, "query", true);

      if (!query) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing query"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 搜索商店技能`, { query });

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const limit = typeof params.limit === "number" ? params.limit : 10;
      const skills = await searchSkills(query, limit);

      respond(true, { skills, total: skills.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 检查技能更新
   */
  "assistant.store.checkUpdates": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 检查技能更新`);

      const registry = await getSkillRegistry();
      const updatable = await checkSkillUpdates(registry);

      respond(true, { skills: updatable, total: updatable.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 刷新商店索引
   */
  "assistant.store.refresh": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 刷新商店索引`);

      await refreshStoreIndex();

      // 同步已安装技能状态
      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const stats = await getStoreStats();

      respond(true, { refreshed: true, stats }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 刷新商店索引失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 从商店安装技能
   */
  "assistant.store.install": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 从商店安装技能`, { skillId });

      // 获取技能详情
      const storeSkill = await getStoreSkillDetail(skillId);

      if (!storeSkill) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found in store: ${skillId}`));
        return;
      }

      // 如果技能已安装，直接返回成功
      if (storeSkill.installed) {
        respond(true, { success: true, skillId, message: "技能已安装" }, undefined);
        return;
      }

      // 如果有 sourceUrl，则从 URL 安装
      if (storeSkill.sourceUrl) {
        const registry = await getSkillRegistry();
        const result = await installSkill(registry, { sourceUrl: storeSkill.sourceUrl });

        if (result.success) {
          await syncInstalledSkills(registry);
        }

        respond(true, result, undefined);
      } else {
        // 对于内置技能，标记为已安装（实际上已经在技能注册表中了）
        const registry = await getSkillRegistry();
        const record = registry.skills.get(skillId);

        if (record) {
          respond(true, { success: true, skillId, message: "内置技能已可用" }, undefined);
        } else {
          respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "技能安装源不可用"));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 从商店安装技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 获取技能分类列表
   */
  "assistant.store.categories": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 获取技能分类列表`);

      const result = await getCategoryList();

      // 转换为前端期望的格式
      const categories = result.items.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon || "📦",
        count: c.skillCount,
      }));

      respond(true, { categories, total: categories.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 获取技能分类列表失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 提交技能到商店
   */
  "assistant.store.submit": async ({ params, respond, context }) => {
    try {
      const name = validateStringParam(params, "name", true);
      const description = validateStringParam(params, "description", true);
      const version = validateStringParam(params, "version");
      const readme = validateStringParam(params, "readme");
      const categoryId = validateStringParam(params, "categoryId");
      const subscriptionLevel = validateStringParam(params, "subscriptionLevel");
      const iconUrl = validateStringParam(params, "iconUrl");
      const manifestUrl = validateStringParam(params, "manifestUrl");
      const packageUrl = validateStringParam(params, "packageUrl");
      const tags = params.tags as string[] | undefined;
      const config = params.config as Record<string, unknown> | undefined;

      if (!name || !description) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 提交技能到商店`, { name, version });

      // 创建技能
      const skill = await createStoreSkill({
        name,
        description,
        readme: readme || null,
        version: version || "1.0.0",
        categoryId: categoryId || null,
        tags: tags || null,
        subscriptionLevel: (subscriptionLevel as "free" | "pro" | "team" | "enterprise") || "free",
        iconUrl: iconUrl || null,
        manifestUrl: manifestUrl || null,
        packageUrl: packageUrl || null,
        config: config || null,
        status: "pending",
        // TODO: 从认证上下文获取用户信息
        authorId: null,
        authorName: null,
      });

      respond(
        true,
        {
          success: true,
          skillId: skill.id,
          skill: {
            id: skill.id,
            name: skill.name,
            version: skill.version,
            status: skill.status,
          },
          message: "技能提交成功，等待审核",
        },
        undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 提交技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
