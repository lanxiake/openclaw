/**
 * 数据库配置变更监听器
 *
 * 通过 PostgreSQL LISTEN/NOTIFY 机制监听配置表变更，
 * 触发 Gateway 配置热重载或冷重启。
 *
 * 监听频道: config_changed
 * 覆盖的配置表:
 *   - gateway_configs     → restart (核心网关配置)
 *   - model_providers     → hot     (模型提供商)
 *   - agent_configs       → hot     (Agent 默认配置)
 *   - auth_profiles       → hot     (认证配置)
 *   - auth_profile_order  → hot     (认证排序)
 *   - system_configs      → conditional (取决于 key)
 */

import postgres from "postgres";

import { getLogger } from "../logging/logger.js";
import { getDatabaseConfigFromEnv } from "../db/connection.js";

const logger = getLogger();

/** LISTEN/NOTIFY 频道名 */
const NOTIFY_CHANNEL = "config_changed";

/** 默认防抖等待时间 (毫秒) */
const DEFAULT_DEBOUNCE_MS = 500;

/** 断线重连延迟 (毫秒) */
const RECONNECT_DELAY_MS = 5000;

/** 最大重连延迟 (毫秒) */
const MAX_RECONNECT_DELAY_MS = 60000;

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 配置变更通知结构 */
export interface ConfigChangeNotification {
  /** 变更的表名 */
  table: string;
  /** 操作类型: INSERT / UPDATE / DELETE */
  operation: string;
  /** 记录 ID */
  id: string;
  /** 配置类型: system / tenant */
  configType: string;
  /** 租户 ID (仅 tenant 类型) */
  userId: string | null;
  /** system_configs 的 key (仅 system_configs 表) */
  key?: string;
}

/** 重载动作类型 */
export type DbReloadAction = "restart" | "hot" | "conditional" | "none";

/** 数据库配置监听器选项 */
export interface ConfigDbWatcherOptions {
  /** 配置变更回调 — 外部决定具体如何重载 */
  onConfigChanged: (notification: ConfigChangeNotification, action: DbReloadAction) => void;
  /** 防抖等待时间 (毫秒) */
  debounceMs?: number;
  /** 日志接口 */
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/** 数据库配置监听器句柄 */
export interface ConfigDbWatcher {
  /** 停止监听 */
  stop: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// 表 → 重载动作 映射
// ---------------------------------------------------------------------------

/** 配置表的重载规则 */
const TABLE_RELOAD_MAP: Record<string, DbReloadAction> = {
  gateway_configs: "restart",
  model_providers: "hot",
  agent_configs: "hot",
  auth_profiles: "hot",
  auth_profile_order: "hot",
  system_configs: "conditional",
};

/** system_configs key → 重载动作 细化规则 */
const SYSTEM_CONFIG_KEY_RELOAD_MAP: Record<string, DbReloadAction> = {
  cron: "hot",
  hooks: "hot",
  logging: "none",
  session: "none",
  messages: "none",
  approvals: "none",
  talk: "none",
  ui: "none",
  tools: "none",
  memory_embedding: "hot",
  memory_llm: "hot",
};

// ---------------------------------------------------------------------------
// 公开函数
// ---------------------------------------------------------------------------

/**
 * 解析 NOTIFY payload 为 ConfigChangeNotification
 *
 * @param payload - NOTIFY 的 payload 字符串 (JSON)
 * @returns 解析后的通知对象，解析失败返回 null
 */
export function parseConfigNotification(payload: string): ConfigChangeNotification | null {
  try {
    const data = JSON.parse(payload);

    // 验证必填字段
    if (!data.table || !data.operation || !data.id) {
      logger.warn("[ConfigDbWatcher] 通知缺少必填字段", { payload });
      return null;
    }

    return {
      table: data.table,
      operation: data.operation,
      id: data.id,
      configType: data.config_type || "system",
      userId: data.user_id || null,
      key: data.key || undefined,
    };
  } catch {
    logger.warn("[ConfigDbWatcher] 无法解析 NOTIFY payload", { payload });
    return null;
  }
}

/**
 * 根据表名（和可选的 key）确定重载动作
 *
 * @param table - 变更的表名
 * @param key - system_configs 的 key (可选)
 * @returns 重载动作类型
 */
export function mapTableToReloadAction(table: string, key?: string): DbReloadAction {
  const baseAction = TABLE_RELOAD_MAP[table];

  if (baseAction === undefined) {
    return "none";
  }

  // system_configs 按 key 细化
  if (baseAction === "conditional" && key) {
    return SYSTEM_CONFIG_KEY_RELOAD_MAP[key] ?? "none";
  }

  return baseAction;
}

/**
 * 启动数据库配置变更监听器
 *
 * 使用独立的 postgres 连接执行 LISTEN，不占用连接池。
 * 支持自动断线重连，重连后回调一次 onConfigChanged 触发全量刷新。
 *
 * @param opts - 监听器选项
 * @returns 监听器句柄（用于停止）
 */
export function startConfigDbWatcher(opts: ConfigDbWatcherOptions): ConfigDbWatcher {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const log = opts.log ?? {
    info: (msg: string) => logger.info(msg),
    warn: (msg: string) => logger.warn(msg),
    error: (msg: string) => logger.error(msg),
  };

  let stopped = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingNotifications: ConfigChangeNotification[] = [];
  let listenSql: ReturnType<typeof postgres> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let unlistenFn: (() => Promise<void>) | null = null;

  /**
   * 处理防抖后的批量通知
   *
   * 将积累的通知合并，选择最高优先级的动作执行
   */
  const flushNotifications = () => {
    if (stopped || pendingNotifications.length === 0) {
      return;
    }

    const batch = [...pendingNotifications];
    pendingNotifications = [];

    log.info(`[ConfigDbWatcher] 处理 ${batch.length} 条配置变更通知`);

    // 逐条处理，外部回调决定具体行为
    for (const notification of batch) {
      const action = mapTableToReloadAction(notification.table, notification.key);

      if (action === "none") {
        continue;
      }

      log.info(
        `[ConfigDbWatcher] 配置变更: ${notification.table}.${notification.operation} → ${action}` +
          (notification.key ? ` (key=${notification.key})` : ""),
      );

      opts.onConfigChanged(notification, action);
    }
  };

  /**
   * 添加通知到防抖队列
   */
  const scheduleNotification = (notification: ConfigChangeNotification) => {
    pendingNotifications.push(notification);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(flushNotifications, debounceMs);
  };

  /**
   * 创建独立连接并开始 LISTEN
   */
  const connect = async () => {
    if (stopped) {
      return;
    }

    try {
      const config = getDatabaseConfigFromEnv();
      const ssl = config.ssl ? { rejectUnauthorized: false } : false;

      // 创建独立连接（不使用连接池，max=1 专用于 LISTEN）
      listenSql = postgres(config.connectionString, {
        max: 1,
        idle_timeout: 0, // 永不超时
        connect_timeout: 10,
        ssl: ssl as any,
        onnotice: () => {}, // 忽略 NOTICE
      });

      // 开始监听
      const listenResult = await listenSql.listen(
        NOTIFY_CHANNEL,
        (payload: string) => {
          const notification = parseConfigNotification(payload);
          if (notification) {
            scheduleNotification(notification);
          }
        },
        () => {
          // onlisten 回调
          log.info(`[ConfigDbWatcher] 已连接并监听频道: ${NOTIFY_CHANNEL}`);
        },
      );

      unlistenFn = async () => {
        await listenResult.unlisten();
      };

      // 重连成功，重置计数器
      reconnectAttempts = 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`[ConfigDbWatcher] LISTEN 连接失败: ${errorMsg}`);

      // 清理失败的连接
      if (listenSql) {
        await listenSql.end().catch(() => {});
        listenSql = null;
      }
      unlistenFn = null;

      // 安排重连
      scheduleReconnect();
    }
  };

  /**
   * 安排重连（指数退避）
   */
  const scheduleReconnect = () => {
    if (stopped) {
      return;
    }

    reconnectAttempts += 1;
    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS,
    );

    log.warn(`[ConfigDbWatcher] 将在 ${delay}ms 后尝试重连 (第 ${reconnectAttempts} 次)`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  // 启动连接
  void connect();

  return {
    stop: async () => {
      stopped = true;

      // 清理定时器
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // 取消监听
      if (unlistenFn) {
        await unlistenFn().catch(() => {});
        unlistenFn = null;
      }

      // 关闭连接
      if (listenSql) {
        await listenSql.end().catch(() => {});
        listenSql = null;
      }

      log.info("[ConfigDbWatcher] 监听器已停止");
    },
  };
}
