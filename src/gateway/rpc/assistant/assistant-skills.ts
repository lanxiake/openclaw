/**
 * AI 鍔╃悊鎶€鑳界郴缁?RPC 鏂规硶澶勭悊鍣? *
 * 涓哄鎴风鎻愪緵 AI 鍔╃悊鎶€鑳界浉鍏崇殑 RPC 鏂规硶
 * 涓庣幇鏈?skills.ts 鍖哄垎锛屼笓闂ㄦ湇鍔′簬 Windows 鍔╃悊
 */

import {
  loadAssistantSkills,
  executeSkill,
  executeSkillByCommand,
  getLoadedSkills,
  getAllSkillTools,
  findSkillByCommand,
  // 鏂板瀵煎叆
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
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// 鏃ュ織鏍囩
const LOG_TAG = "assistant-skills";

// 鍏ㄥ眬鎶€鑳芥敞鍐岃〃 (鎳掑姞杞?
let skillRegistry: SkillRegistry | null = null;

/**
 * 鑾峰彇鎴栧垵濮嬪寲鎶€鑳芥敞鍐岃〃
 */
async function getSkillRegistry(config?: SkillLoaderConfig): Promise<SkillRegistry> {
  if (!skillRegistry) {
    skillRegistry = await loadAssistantSkills(config);
  }
  return skillRegistry;
}

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
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
 * AI 鍔╃悊鎶€鑳界郴缁?RPC 鏂规硶澶勭悊鍣? */
export const assistantSkillHandlers: GatewayRequestHandlers = {
  /**
   * 鑾峰彇宸插姞杞界殑鎶€鑳藉垪琛?   */
  "assistant.skills.list": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垪琛╜);

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
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垪琛ㄥけ璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳借鎯?   */
  "assistant.skills.get": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳借鎯卄, { skillId });

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
   * 鎵ц鎶€鑳?   */
  "assistant.skills.execute": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);
      const sessionId = validateStringParam(params, "sessionId");
      const skillParams = (params.params as Record<string, unknown>) || {};

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鎵ц鎶€鑳絗, {
        skillId,
        sessionId,
        params: Object.keys(skillParams),
      });

      const registry = await getSkillRegistry();

      // 鍒涘缓纭澶勭悊鍣?(閫氳繃 Gateway 骞挎挱鍒板鎴风)
      const confirmHandler = async (
        action: string,
        description: string,
        level: "low" | "medium" | "high",
      ): Promise<boolean> => {
        // TODO: 瀹炵幇閫氳繃 Gateway 骞挎挱纭璇锋眰鍒板鎴风
        // 鐩墠榛樿鎵瑰噯 (鐢熶骇鐜闇€瑕佸疄鐜板畬鏁寸殑纭娴佺▼)
        context.logGateway.warn(`[${LOG_TAG}] 鎶€鑳借姹傜‘璁?(鑷姩鎵瑰噯)`, {
          skillId,
          action,
          level,
        });
        return true;
      };

      // 鍒涘缓杩涘害澶勭悊鍣?      const progressHandler = (_skillId: string, percent: number, message?: string): void => {
        // TODO: 閫氳繃 Gateway 骞挎挱杩涘害鍒板鎴风
        context.logGateway.debug(`[${LOG_TAG}] 鎶€鑳借繘搴, {
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
      context.logGateway.error(`[${LOG_TAG}] 鎶€鑳芥墽琛屽け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 閫氳繃鍛戒护鎵ц鎶€鑳?   */
  "assistant.skills.executeByCommand": async ({ params, respond, context }) => {
    try {
      const command = validateStringParam(params, "command", true);
      const sessionId = validateStringParam(params, "sessionId");
      const args = validateStringParam(params, "args");

      if (!command) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing command"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 閫氳繃鍛戒护鎵ц鎶€鑳絗, { command, args });

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
   * 鑾峰彇鎶€鑳芥彁渚涚殑宸ュ叿
   */
  "assistant.skills.tools": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉伐鍏峰垪琛╜);

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
   * 閲嶆柊鍔犺浇鎶€鑳?   */
  "assistant.skills.reload": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 閲嶆柊鍔犺浇鎶€鑳絗);

      // 閲嶇疆娉ㄥ唽琛?      skillRegistry = null;
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
      context.logGateway.error(`[${LOG_TAG}] 閲嶆柊鍔犺浇鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鏌ユ壘鍛戒护瀵瑰簲鐨勬妧鑳?   */
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

  // === 鎶€鑳界鐞?RPC 鏂规硶 ===

  /**
   * 瀹夎鎶€鑳?   */
  "assistant.skills.install": async ({ params, respond, context }) => {
    try {
      const localPath = validateStringParam(params, "localPath");
      const sourceUrl = validateStringParam(params, "sourceUrl");
      const force = Boolean(params.force);

      context.logGateway.info(`[${LOG_TAG}] 瀹夎鎶€鑳絗, { localPath, sourceUrl, force });

      const registry = await getSkillRegistry();
      const result = await installSkill(registry, { localPath, sourceUrl, force });

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 瀹夎鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍗歌浇鎶€鑳?   */
  "assistant.skills.uninstall": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鍗歌浇鎶€鑳絗, { skillId });

      const registry = await getSkillRegistry();
      const success = await unloadSkill(registry, skillId);

      respond(true, { success, skillId }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍗歌浇鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍚敤鎶€鑳?   */
  "assistant.skills.enable": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鍚敤鎶€鑳絗, { skillId });

      const registry = await getSkillRegistry();
      const success = await enableSkill(registry, skillId);

      respond(true, { success, skillId, enabled: success }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 绂佺敤鎶€鑳?   */
  "assistant.skills.disable": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 绂佺敤鎶€鑳絗, { skillId });

      const registry = await getSkillRegistry();
      const success = await disableSkill(registry, skillId);

      respond(true, { success, skillId, enabled: !success }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍒囨崲鎶€鑳界姸鎬?   */
  "assistant.skills.toggle": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鍒囨崲鎶€鑳界姸鎬乣, { skillId });

      const registry = await getSkillRegistry();
      const result = await toggleSkillStatus(registry, skillId);

      respond(true, { skillId, ...result }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳介厤缃?   */
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
   * 璁剧疆鎶€鑳介厤缃?   */
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

      context.logGateway.info(`[${LOG_TAG}] 璁剧疆鎶€鑳介厤缃甡, { skillId, keys: Object.keys(config) });

      setSkillConfig(skillId, config);
      respond(true, { success: true, skillId }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳界粺璁′俊鎭?   */
  "assistant.skills.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳界粺璁);

      const registry = await getSkillRegistry();
      const stats = getSkillStats(registry);

      respond(true, stats, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎵€鏈夋妧鑳?(鍖呮嫭绂佺敤鐨?
   */
  "assistant.skills.listAll": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎵€鏈夋妧鑳絗);

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

  // === 鎶€鑳藉晢搴?RPC 鏂规硶 ===

  /**
   * 鏌ヨ鍟嗗簵鎶€鑳藉垪琛?   */
  "assistant.store.query": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鏌ヨ鍟嗗簵鎶€鑳絗, { params });

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      // 瑙ｆ瀽绛涢€夋潯浠?      const filters: StoreFilters = {
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
      context.logGateway.error(`[${LOG_TAG}] 鏌ヨ鍟嗗簵鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鍟嗗簵鎶€鑳借鎯?   */
  "assistant.store.detail": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鍟嗗簵鎶€鑳借鎯卄, { skillId });

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
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
   * 鑾峰彇鎺ㄨ崘鎶€鑳?   */
  "assistant.store.featured": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎺ㄨ崘鎶€鑳絗);

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
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
   * 鑾峰彇鐑棬鎶€鑳?   */
  "assistant.store.popular": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鐑棬鎶€鑳絗);

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
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
   * 鑾峰彇鏈€鏂版妧鑳?   */
  "assistant.store.recent": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鏈€鏂版妧鑳絗);

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
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
   * 鑾峰彇鍟嗗簵缁熻淇℃伅
   */
  "assistant.store.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鍟嗗簵缁熻`);

      const stats = await getStoreStats();

      respond(true, stats, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鎼滅储鍟嗗簵鎶€鑳?   */
  "assistant.store.search": async ({ params, respond, context }) => {
    try {
      const query = validateStringParam(params, "query", true);

      if (!query) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing query"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 鎼滅储鍟嗗簵鎶€鑳絗, { query });

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
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
   * 妫€鏌ユ妧鑳芥洿鏂?   */
  "assistant.store.checkUpdates": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 妫€鏌ユ妧鑳芥洿鏂癭);

      const registry = await getSkillRegistry();
      const updatable = await checkSkillUpdates(registry);

      respond(true, { skills: updatable, total: updatable.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍒锋柊鍟嗗簵绱㈠紩
   */
  "assistant.store.refresh": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鍒锋柊鍟嗗簵绱㈠紩`);

      await refreshStoreIndex();

      // 鍚屾宸插畨瑁呮妧鑳界姸鎬?      const registry = await getSkillRegistry();
      await syncInstalledSkills(registry);

      const stats = await getStoreStats();

      respond(true, { refreshed: true, stats }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍒锋柊鍟嗗簵绱㈠紩澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 浠庡晢搴楀畨瑁呮妧鑳?   */
  "assistant.store.install": async ({ params, respond, context }) => {
    try {
      const skillId = validateStringParam(params, "skillId", true);

      if (!skillId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing skillId"));
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 浠庡晢搴楀畨瑁呮妧鑳絗, { skillId });

      // 鑾峰彇鎶€鑳借鎯?      const storeSkill = await getStoreSkillDetail(skillId);

      if (!storeSkill) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Skill not found in store: ${skillId}`),
        );
        return;
      }

      // 濡傛灉鎶€鑳藉凡瀹夎锛岀洿鎺ヨ繑鍥炴垚鍔?      if (storeSkill.installed) {
        respond(true, { success: true, skillId, message: "鎶€鑳藉凡瀹夎" }, undefined);
        return;
      }

      // 濡傛灉鏈?sourceUrl锛屽垯浠?URL 瀹夎
      if (storeSkill.sourceUrl) {
        const registry = await getSkillRegistry();
        const result = await installSkill(registry, { sourceUrl: storeSkill.sourceUrl });

        if (result.success) {
          await syncInstalledSkills(registry);
        }

        respond(true, result, undefined);
      } else {
        // 瀵逛簬鍐呯疆鎶€鑳斤紝鏍囪涓哄凡瀹夎锛堝疄闄呬笂宸茬粡鍦ㄦ妧鑳芥敞鍐岃〃涓簡锛?        const registry = await getSkillRegistry();
        const record = registry.skills.get(skillId);

        if (record) {
          respond(true, { success: true, skillId, message: "鍐呯疆鎶€鑳藉凡鍙敤" }, undefined);
        } else {
          respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "鎶€鑳藉畨瑁呮簮涓嶅彲鐢?));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 浠庡晢搴楀畨瑁呮妧鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鎶€鑳藉垎绫诲垪琛?   */
  "assistant.store.categories": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垎绫诲垪琛╜);

      const result = await getCategoryList();

      // 杞崲涓哄墠绔湡鏈涚殑鏍煎紡
      const categories = result.items.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon || "馃摝",
        count: c.skillCount,
      }));

      respond(true, { categories, total: categories.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鎶€鑳藉垎绫诲垪琛ㄥけ璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鎻愪氦鎶€鑳藉埌鍟嗗簵
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

      context.logGateway.info(`[${LOG_TAG}] 鎻愪氦鎶€鑳藉埌鍟嗗簵`, { name, version });

      // 鍒涘缓鎶€鑳?      const skill = await createStoreSkill({
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
        // TODO: 浠庤璇佷笂涓嬫枃鑾峰彇鐢ㄦ埛淇℃伅
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
          message: "鎶€鑳芥彁浜ゆ垚鍔燂紝绛夊緟瀹℃牳",
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鎻愪氦鎶€鑳藉け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
