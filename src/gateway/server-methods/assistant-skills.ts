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
import {
  ClientSkillDispatcher,
  shouldDispatchToClient,
} from "../../assistant/skills/client-dispatch.js";
import { packSkill, type PackageInput } from "../../assistant/skills/skill-packager.js";
import { SkillPushDispatcher, type SkillInstallResult } from "../../assistant/skills/skill-push.js";
import { checkUpdates as checkVersionUpdates } from "../../assistant/skills/version-checker.js";
import type { SkillExecuteResult } from "../protocol/skill-execution.js";

// 日志标签
const LOG_TAG = "assistant-skills";

// 全局客户端技能调度器 (单例)
const clientSkillDispatcher = new ClientSkillDispatcher();

// 全局技能推送调度器 (单例)
const skillPushDispatcher = new SkillPushDispatcher();

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
  required = false,
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 获取技能详情`, { skillId });

      const registry = await getSkillRegistry();
      const record = registry.skills.get(skillId);

      if (!record) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`),
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
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, errorMessage));
    }
  },

  /**
   * 执行技能
   *
   * 根据技能来源自动路由：
   * - builtin 技能 → 在 Gateway 服务端直接执行
   * - installed/workspace/remote 技能 → 调度到用户的客户端设备执行
   */
  "assistant.skills.execute": async ({ params, respond, context, client }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const sessionId = validateStringParam(params, "sessionId");
      const skillParams = (params.params as Record<string, unknown>) || {};

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 执行技能`, {
        skillId,
        sessionId,
        params: Object.keys(skillParams),
      });

      const registry = await getSkillRegistry();

      // 查找技能记录以判断路由
      const skillRecord = registry.skills.get(skillId);

      if (!skillRecord) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `技能不存在: ${skillId}`));
        return;
      }

      // runMode 路由：non-builtin 技能调度到客户端
      if (shouldDispatchToClient(skillRecord.origin)) {
        context.logGateway.info(`[${LOG_TAG}] 技能路由到客户端执行`, {
          skillId,
          origin: skillRecord.origin,
        });

        // 获取用户 ID
        // 优先从 client 认证信息提取，fallback 到 RPC 参数中的 userId
        const userId = client?.authenticatedUser?.userId || validateStringParam(params, "userId");

        if (!userId) {
          respond(
            false,
            undefined,
            errorShape(
              ErrorCodes.UNAVAILABLE,
              "无法确定用户身份，无法调度到客户端。请确保已认证或传递 userId 参数。",
            ),
          );
          return;
        }

        const result = await clientSkillDispatcher.dispatch({
          userId,
          skillId,
          skillName: skillRecord.metadata.name,
          params: skillParams,
          requireConfirm: skillRecord.metadata.permissions?.requireConfirmation ?? false,
          sendToUserClients: context.sendToUserClients,
          timeoutMs: 120_000,
        });

        respond(true, result, undefined);
        return;
      }

      // builtin 技能：走原有的服务端执行逻辑
      context.logGateway.info(`[${LOG_TAG}] 技能在服务端执行`, {
        skillId,
        origin: skillRecord.origin,
      });

      // 创建确认处理器 (通过 Gateway 广播到客户端)
      const confirmHandler = async (
        action: string,
        description: string,
        level: "low" | "medium" | "high",
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
      const progressHandler = (_skillId: string, percent: number, message?: string): void => {
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
        },
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing command"));
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
        },
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
        (r) => r.status === "loaded",
      ).length;

      respond(
        true,
        {
          total: registry.skills.size,
          loaded: loadedCount,
          version: registry.version,
        },
        undefined,
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
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing command"));
        return;
      }

      const registry = await getSkillRegistry();
      const record = findSkillByCommand(registry, command);

      if (!record) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `No skill found for command: ${command}`),
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
        undefined,
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
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found: ${skillId}`),
        );
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
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found in store: ${skillId}`),
        );
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
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
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
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 提交技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 创建技能并推送到客户端设备安装
   *
   * Agent 调用此方法，传入代码和 manifest 信息
   * Gateway 负责打包、推送到客户端、注册元数据
   */
  "assistant.skills.createAndPush": async ({ params, respond, context, client }) => {
    try {
      const name = validateStringParam(params, "name", true);
      const code = validateStringParam(params, "code", true);
      const language = validateStringParam(params, "language", true);

      if (!name || !code || !language) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "name, code, language 为必填参数"),
        );
        return;
      }

      const validLanguages = ["typescript", "python", "shell"];
      if (!validLanguages.includes(language)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `不支持的语言: ${language}，可选: ${validLanguages.join(", ")}`,
          ),
        );
        return;
      }

      const description = validateStringParam(params, "description") || "";
      const triggers = Array.isArray(params.triggers) ? params.triggers : [];
      const permissions =
        params.permissions && typeof params.permissions === "object" ? params.permissions : {};

      // 推断入口文件名
      const entryMap: Record<string, string> = {
        typescript: "index.ts",
        python: "main.py",
        shell: "run.sh",
      };
      const entry = entryMap[language] || "index.ts";

      // 生成技能 ID
      const skillId = `user-${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`;

      context.logGateway.info(`[${LOG_TAG}] 开始创建技能`, {
        skillId,
        name,
        language,
        codeLength: code.length,
      });

      // 1. 构建 PackageInput
      const packageInput: PackageInput = {
        manifest: {
          id: skillId,
          name,
          description,
          version: "1.0.0",
          author: "agent",
          entry,
          runtime: language as "typescript" | "python" | "shell",
          permissions: permissions as PackageInput["manifest"]["permissions"],
          category: "custom",
        },
        files: {
          [entry]: code,
        },
      };

      // 2. 打包
      const os = await import("node:os");
      const packageOutput = await packSkill(packageInput, os.tmpdir());

      // 3. 获取 userId
      const userId = client?.authenticatedUser?.userId;
      if (!userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "需要认证用户才能创建技能"),
        );
        return;
      }

      // 4. 推送到客户端设备
      const pushResult = await skillPushDispatcher.pushToDevice({
        userId,
        packageOutput,
        sendToUserClients: context.sendToUserClients,
        timeoutMs: 120_000,
      });

      if (!pushResult.success) {
        context.logGateway.warn(`[${LOG_TAG}] 技能推送到设备失败`, {
          skillId,
          error: pushResult.error,
        });

        respond(
          true,
          {
            success: true,
            skillId,
            warning: `技能已创建但推送到设备失败: ${pushResult.error}。技能包已准备好，可在设备端手动安装。`,
          },
          undefined,
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 技能创建并推送成功`, {
        skillId,
        name,
      });

      respond(
        true,
        {
          success: true,
          skillId,
          message: `技能 "${name}" 已创建并推送到设备`,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 创建技能失败`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 接收客户端回传的技能安装结果
   *
   * Client → Gateway: 客户端完成技能安装后回传结果
   * 由 SkillPushDispatcher 匹配到对应的 pending request 并 resolve
   */
  "assistant.skill.installResult": async ({ params, respond, context }) => {
    try {
      const requestId = validateStringParam(params, "requestId", true);

      if (!requestId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing requestId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 收到客户端技能安装结果`, {
        requestId,
        success: params.success,
      });

      const result: SkillInstallResult = {
        requestId,
        success: Boolean(params.success),
        error: typeof params.error === "string" ? params.error : undefined,
      };

      const handled = skillPushDispatcher.handleInstallResult(result);

      if (!handled) {
        context.logGateway.warn(`[${LOG_TAG}] 未找到匹配的技能安装请求`, {
          requestId,
        });
      }

      respond(true, { handled }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 处理技能安装结果失败`, {
        error: errorMessage,
      });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 接收客户端回传的技能执行结果
   *
   * Client → Gateway: 客户端完成本地技能执行后回传结果
   * 由 ClientSkillDispatcher 匹配到对应的 pending request 并 resolve
   */
  "assistant.skill.result": async ({ params, respond, context }) => {
    try {
      const requestId = validateStringParam(params, "requestId", true);

      if (!requestId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing requestId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 收到客户端技能执行结果`, {
        requestId,
        success: params.success,
      });

      const result: SkillExecuteResult = {
        requestId,
        success: Boolean(params.success),
        result: params.result,
        error: params.error as SkillExecuteResult["error"],
        executionTimeMs: typeof params.executionTimeMs === "number" ? params.executionTimeMs : 0,
        resourceUsage: params.resourceUsage as SkillExecuteResult["resourceUsage"],
      };

      const handled = clientSkillDispatcher.handleResult(result);

      if (!handled) {
        context.logGateway.warn(`[${LOG_TAG}] 未找到匹配的技能执行请求`, {
          requestId,
        });
      }

      respond(true, { handled }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 处理技能执行结果失败`, {
        error: errorMessage,
      });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 检查客户端已安装技能的版本更新
   *
   * Client → Gateway: 发送已安装技能列表
   * Gateway → Client: 返回每个技能是否有更新可用
   *
   * params: { installedSkills: Array<{ skillId: string; version: string }> }
   */
  "assistant.skills.checkUpdates": async ({ params, respond, context }) => {
    try {
      const installedSkills = params.installedSkills;

      if (!Array.isArray(installedSkills)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "installedSkills must be an array"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 检查技能版本更新`, {
        count: installedSkills.length,
      });

      // 从技能商店逐个查询最新版本
      const registry = new Map<string, { latestVersion: string }>();
      for (const skill of installedSkills) {
        const storeSkill = await getStoreSkillDetail(skill.skillId);
        if (storeSkill) {
          registry.set(storeSkill.id, { latestVersion: storeSkill.version });
        }
      }

      // 使用 version-checker 批量比较
      const results = checkVersionUpdates(
        installedSkills.map((s: { skillId: string; version: string }) => ({
          skillId: s.skillId,
          version: s.version,
        })),
        registry,
      );

      context.logGateway.info(`[${LOG_TAG}] 版本检查完成`, {
        checked: results.length,
        updatesAvailable: results.filter((r) => r.hasUpdate).length,
      });

      respond(true, { updates: results }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 版本检查失败`, {
        error: errorMessage,
      });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
