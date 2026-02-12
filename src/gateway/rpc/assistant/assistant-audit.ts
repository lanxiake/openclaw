/**
 * 瀹¤鏃ュ織 Gateway RPC 鏂规硶
 *
 * 鎻愪緵瀹¤鏃ュ織鐨勬煡璇€佺粺璁°€佸鍑虹瓑 RPC 鏂规硶
 * 鍖呮嫭:
 * - 鍩轰簬 JSON Lines 鐨勬湰鍦板璁℃棩蹇?(assistant.audit.*)
 * - 鍩轰簬 PostgreSQL 鐨勫寮虹増瀹¤鏈嶅姟 (audit.*)
 */

import {
  initAuditLog,
  writeAuditLog,
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  getAuditConfig,
  updateAuditConfig,
  getRecentAuditLogs,
  type AuditLogFilters,
  type AuditExportOptions,
  type AuditLogConfig,
  type CreateAuditLogInput,
  // 澧炲己鐗堝璁℃湇鍔?  getEnhancedAuditService,
  type AuditLogQueryParams,
} from "../../assistant/audit/index.js";
import type { AuditCategory, AuditRiskLevel } from "../../db/schema/audit.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// 鏃ュ織鏍囩
const LOG_TAG = "assistant-audit-rpc";

/**
 * 楠岃瘉瀛楃涓插弬鏁? */
function validateStringParam(
  params: Record<string, unknown>,
  key: string,
  required: boolean = false,
): string | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      return undefined;
    }
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() || undefined;
}

/**
 * 瀹¤鏃ュ織 RPC 鏂规硶瀹氫箟
 */
export const assistantAuditMethods: GatewayRequestHandlers = {
  /**
   * 鍒濆鍖栧璁℃棩蹇楃郴缁?   */
  "assistant.audit.init": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鍒濆鍖栧璁℃棩蹇楃郴缁焋);

      const config: Partial<AuditLogConfig> = {};

      if (typeof params.enabled === "boolean") {
        config.enabled = params.enabled;
      }
      if (typeof params.retentionDays === "number") {
        config.retentionDays = params.retentionDays;
      }
      if (typeof params.maxEntries === "number") {
        config.maxEntries = params.maxEntries;
      }
      if (typeof params.logChatContent === "boolean") {
        config.logChatContent = params.logChatContent;
      }
      if (typeof params.logFilePaths === "boolean") {
        config.logFilePaths = params.logFilePaths;
      }

      await initAuditLog(config);

      respond(true, { initialized: true, config: getAuditConfig() }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍒濆鍖栧け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鍐欏叆瀹¤鏃ュ織
   */
  "assistant.audit.write": async ({ params, respond, context }) => {
    try {
      const eventType = validateStringParam(params, "eventType", true);
      const title = validateStringParam(params, "title", true);
      const detail = validateStringParam(params, "detail", true);

      if (!eventType || !title || !detail) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Missing required fields: eventType, title, detail",
          ),
        );
        return;
      }

      const sourceType = validateStringParam(params, "sourceType") || "user";
      const sourceName = validateStringParam(params, "sourceName") || "unknown";

      const input: CreateAuditLogInput = {
        eventType: eventType as CreateAuditLogInput["eventType"],
        title,
        detail,
        source: {
          type: sourceType as CreateAuditLogInput["source"]["type"],
          name: sourceName,
          ip: validateStringParam(params, "sourceIp"),
        },
        severity: validateStringParam(params, "severity") as CreateAuditLogInput["severity"],
        result: validateStringParam(params, "result") as CreateAuditLogInput["result"],
        metadata: params.metadata as Record<string, unknown> | undefined,
        sessionId: validateStringParam(params, "sessionId"),
        userId: validateStringParam(params, "userId"),
        deviceId: validateStringParam(params, "deviceId"),
      };

      context.logGateway.debug(`[${LOG_TAG}] 鍐欏叆瀹¤鏃ュ織`, { eventType, title });

      const entry = await writeAuditLog(input);

      respond(true, { entry }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍐欏叆瀹¤鏃ュ織澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鏌ヨ瀹¤鏃ュ織
   */
  "assistant.audit.query": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鏌ヨ瀹¤鏃ュ織`);

      const filters: AuditLogFilters = {
        startTime: validateStringParam(params, "startTime"),
        endTime: validateStringParam(params, "endTime"),
        search: validateStringParam(params, "search"),
        sessionId: validateStringParam(params, "sessionId"),
        offset: typeof params.offset === "number" ? params.offset : 0,
        limit: typeof params.limit === "number" ? params.limit : 50,
        sortOrder: validateStringParam(params, "sortOrder") as AuditLogFilters["sortOrder"],
      };

      // 澶勭悊鏁扮粍鍙傛暟
      if (Array.isArray(params.eventTypes)) {
        filters.eventTypes = params.eventTypes as AuditLogFilters["eventTypes"];
      }
      if (Array.isArray(params.severities)) {
        filters.severities = params.severities as AuditLogFilters["severities"];
      }
      if (Array.isArray(params.results)) {
        filters.results = params.results as AuditLogFilters["results"];
      }
      if (Array.isArray(params.sourceTypes)) {
        filters.sourceTypes = params.sourceTypes as AuditLogFilters["sourceTypes"];
      }

      const result = await queryAuditLogs(filters);

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鏌ヨ瀹¤鏃ュ織澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鏈€杩戠殑瀹¤鏃ュ織
   */
  "assistant.audit.recent": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇鏈€杩戝璁℃棩蹇梎);

      const limit = typeof params.limit === "number" ? params.limit : 20;

      const entries = await getRecentAuditLogs(limit);

      respond(true, { entries, total: entries.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鏈€杩戝璁℃棩蹇楀け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇瀹¤鏃ュ織缁熻
   */
  "assistant.audit.stats": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇瀹¤鏃ュ織缁熻`);

      const stats = await getAuditStats();

      respond(true, stats, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇缁熻澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 瀵煎嚭瀹¤鏃ュ織
   */
  "assistant.audit.export": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 瀵煎嚭瀹¤鏃ュ織`);

      const format = validateStringParam(params, "format") || "json";

      const options: AuditExportOptions = {
        format: format as AuditExportOptions["format"],
        filters: {},
      };

      // 瑙ｆ瀽杩囨护鏉′欢
      if (params.filters && typeof params.filters === "object") {
        const filterParams = params.filters as Record<string, unknown>;
        options.filters = {
          startTime: validateStringParam(filterParams, "startTime"),
          endTime: validateStringParam(filterParams, "endTime"),
          search: validateStringParam(filterParams, "search"),
        };

        if (Array.isArray(filterParams.eventTypes)) {
          options.filters.eventTypes = filterParams.eventTypes as AuditLogFilters["eventTypes"];
        }
        if (Array.isArray(filterParams.severities)) {
          options.filters.severities = filterParams.severities as AuditLogFilters["severities"];
        }
      }

      // 瑙ｆ瀽瀵煎嚭瀛楁
      if (Array.isArray(params.fields)) {
        options.fields = params.fields as AuditExportOptions["fields"];
      }

      const content = await exportAuditLogs(options);

      respond(true, { content, format }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 瀵煎嚭瀹¤鏃ュ織澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 娓呴櫎瀹¤鏃ュ織
   */
  "assistant.audit.clear": async ({ params, respond, context }) => {
    try {
      context.logGateway.warn(`[${LOG_TAG}] 娓呴櫎瀹¤鏃ュ織`);

      const beforeDate = validateStringParam(params, "beforeDate");

      const result = await clearAuditLogs({ beforeDate });

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 娓呴櫎瀹¤鏃ュ織澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇瀹¤鏃ュ織閰嶇疆
   */
  "assistant.audit.config.get": async ({ respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇瀹¤鏃ュ織閰嶇疆`);

      const config = getAuditConfig();

      respond(true, { config }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇閰嶇疆澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鏇存柊瀹¤鏃ュ織閰嶇疆
   */
  "assistant.audit.config.set": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鏇存柊瀹¤鏃ュ織閰嶇疆`);

      const config: Partial<AuditLogConfig> = {};

      if (typeof params.enabled === "boolean") {
        config.enabled = params.enabled;
      }
      if (typeof params.retentionDays === "number") {
        config.retentionDays = params.retentionDays;
      }
      if (typeof params.maxEntries === "number") {
        config.maxEntries = params.maxEntries;
      }
      if (typeof params.logChatContent === "boolean") {
        config.logChatContent = params.logChatContent;
      }
      if (typeof params.logFilePaths === "boolean") {
        config.logFilePaths = params.logFilePaths;
      }
      if (Array.isArray(params.eventTypes)) {
        config.eventTypes = params.eventTypes as AuditLogConfig["eventTypes"];
      }
      if (validateStringParam(params, "minSeverity")) {
        config.minSeverity = validateStringParam(
          params,
          "minSeverity",
        ) as AuditLogConfig["minSeverity"];
      }

      const updatedConfig = await updateAuditConfig(config);

      respond(true, { config: updatedConfig }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鏇存柊閰嶇疆澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  // ============================================================================
  // 澧炲己鐗堝璁℃湇鍔?(鍩轰簬 PostgreSQL, 甯﹂闄╄瘎浼板拰鍛婅)
  // ============================================================================

  /**
   * 鍐欏叆瀹¤鏃ュ織 (澧炲己鐗堬紝鑷姩椋庨櫓璇勪及)
   */
  "audit.log": async ({ params, respond, context }) => {
    try {
      const category = validateStringParam(params, "category", true);
      const action = validateStringParam(params, "action", true);
      const result = validateStringParam(params, "result", true);

      if (!category || !action || !result) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Missing required fields: category, action, result",
          ),
        );
        return;
      }

      const service = getEnhancedAuditService();
      const auditLog = await service.log({
        userId: validateStringParam(params, "userId"),
        deviceId: validateStringParam(params, "deviceId"),
        category: category as AuditCategory,
        action,
        resourceType: validateStringParam(params, "resourceType"),
        resourceId: validateStringParam(params, "resourceId"),
        riskLevel: validateStringParam(params, "riskLevel") as AuditRiskLevel | undefined,
        ipAddress: validateStringParam(params, "ipAddress"),
        userAgent: validateStringParam(params, "userAgent"),
        details: params.details as Record<string, unknown> | undefined,
        beforeState: params.beforeState as Record<string, unknown> | undefined,
        afterState: params.afterState as Record<string, unknown> | undefined,
        result: result as "success" | "failure" | "partial",
        errorMessage: validateStringParam(params, "errorMessage"),
        skipRiskEvaluation: params.skipRiskEvaluation === true,
      });

      context.logGateway.debug(`[${LOG_TAG}] 鍐欏叆澧炲己鐗堝璁℃棩蹇梎, {
        id: auditLog.id,
        category,
        action,
      });

      respond(true, { log: auditLog }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鍐欏叆澧炲己鐗堝璁℃棩蹇楀け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鏌ヨ瀹¤鏃ュ織 (鍒嗛〉)
   */
  "audit.query": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鏌ヨ澧炲己鐗堝璁℃棩蹇梎);

      const queryParams: AuditLogQueryParams = {
        userId: validateStringParam(params, "userId"),
        deviceId: validateStringParam(params, "deviceId"),
        category: validateStringParam(params, "category") as AuditCategory | undefined,
        action: validateStringParam(params, "action"),
        riskLevel: validateStringParam(params, "riskLevel") as AuditRiskLevel | undefined,
        startDate: params.startDate ? new Date(params.startDate as string) : undefined,
        endDate: params.endDate ? new Date(params.endDate as string) : undefined,
        page: typeof params.page === "number" ? params.page : 1,
        pageSize: typeof params.pageSize === "number" ? params.pageSize : 20,
      };

      const service = getEnhancedAuditService();
      const result = await service.query(queryParams);

      respond(true, result, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鏌ヨ澧炲己鐗堝璁℃棩蹇楀け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛鏈€杩戠殑瀹¤鏃ュ織
   */
  "audit.user.recent": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required field: userId"),
        );
        return;
      }

      const limit = typeof params.limit === "number" ? params.limit : 20;

      context.logGateway.debug(`[${LOG_TAG}] 鑾峰彇鐢ㄦ埛鏈€杩戝璁℃棩蹇梎, { userId, limit });

      const service = getEnhancedAuditService();
      const logs = await service.getRecentByUser(userId, limit);

      respond(true, { logs, total: logs.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇鐢ㄦ埛鏈€杩戝璁℃棩蹇楀け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇楂橀闄╂搷浣滄棩蹇?   */
  "audit.highrisk": async ({ params, respond, context }) => {
    try {
      context.logGateway.info(`[${LOG_TAG}] 鑾峰彇楂橀闄╂搷浣滄棩蹇梎);

      // 榛樿鑾峰彇杩囧幓24灏忔椂鐨勯珮椋庨櫓鎿嶄綔
      const hoursAgo = typeof params.hoursAgo === "number" ? params.hoursAgo : 24;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      const limit = typeof params.limit === "number" ? params.limit : 100;

      const service = getEnhancedAuditService();
      const logs = await service.getHighRiskLogs(since, limit);

      respond(true, { logs, total: logs.length, since: since.toISOString() }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇楂橀闄╂搷浣滄棩蹇楀け璐, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 璇锋眰鏁版嵁瀵煎嚭 (甯﹂鐜囬檺鍒?
   */
  "audit.export.request": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);
      const exportType = validateStringParam(params, "exportType", true);
      const format = validateStringParam(params, "format", true);

      if (!userId || !exportType || !format) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Missing required fields: userId, exportType, format",
          ),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] 璇锋眰鏁版嵁瀵煎嚭`, { userId, exportType, format });

      const service = getEnhancedAuditService();
      const result = await service.requestExport({
        userId,
        exportType: exportType as "user_data" | "audit_logs" | "chat_history" | "files",
        format: format as "json" | "csv" | "zip",
        startDate: validateStringParam(params, "startDate"),
        endDate: validateStringParam(params, "endDate"),
        filters: params.filters as Record<string, unknown> | undefined,
        ipAddress: validateStringParam(params, "ipAddress"),
        userAgent: validateStringParam(params, "userAgent"),
      });

      if (result.success) {
        respond(true, { exportId: result.exportId }, undefined);
      } else {
        // 璁＄畻 retryAfterMs (濡傛灉鏈?retryAfter)
        let retryAfterMs: number | undefined;
        if (result.retryAfter) {
          const retryDate = new Date(result.retryAfter);
          retryAfterMs = Math.max(0, retryDate.getTime() - Date.now());
        }

        respond(
          false,
          undefined,
          errorShape(
            result.errorCode === "RATE_LIMITED"
              ? ErrorCodes.RESOURCE_EXHAUSTED
              : ErrorCodes.UNAVAILABLE,
            result.error || "瀵煎嚭璇锋眰澶辫触",
            retryAfterMs ? { retryAfterMs, retryable: true } : undefined,
          ),
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 璇锋眰鏁版嵁瀵煎嚭澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 鑾峰彇鐢ㄦ埛瀵煎嚭鍘嗗彶
   */
  "audit.export.history": async ({ params, respond, context }) => {
    try {
      const userId = validateStringParam(params, "userId", true);

      if (!userId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required field: userId"),
        );
        return;
      }

      const limit = typeof params.limit === "number" ? params.limit : 20;

      context.logGateway.debug(`[${LOG_TAG}] 鑾峰彇瀵煎嚭鍘嗗彶`, { userId, limit });

      const service = getEnhancedAuditService();
      const exports = await service.getExportHistory(userId, limit);

      respond(true, { exports, total: exports.length }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鑾峰彇瀵煎嚭鍘嗗彶澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },

  /**
   * 娓呯悊杩囨湡鏃ュ織鍜屽鍑?   */
  "audit.cleanup": async ({ params, respond, context }) => {
    try {
      context.logGateway.warn(`[${LOG_TAG}] 鎵ц娓呯悊浠诲姟`);

      const retentionDays = typeof params.retentionDays === "number" ? params.retentionDays : 365;

      const service = getEnhancedAuditService();

      // 娓呯悊杩囨湡瀹¤鏃ュ織
      const deletedLogs = await service.cleanupOldLogs(retentionDays);

      // 娓呯悊杩囨湡瀵煎嚭
      const deletedExports = await service.cleanupExpiredExports();

      respond(
        true,
        {
          deletedLogs,
          deletedExports,
          retentionDays,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.logGateway.error(`[${LOG_TAG}] 鎵ц娓呯悊浠诲姟澶辫触`, { error: errorMessage });
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, errorMessage));
    }
  },
};
