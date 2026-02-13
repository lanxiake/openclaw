/**
 * Redis Pub/Sub 事件总线模块
 *
 * 用于跨进程/服务的事件通信
 * 支持事件发布、订阅、模式订阅等功能
 */

import Redis from "ioredis";

import { getLogger } from "../../logging/logger.js";
import { getRedisConfigFromEnv } from "./connection.js";

const logger = getLogger();

// 事件频道前缀
const CHANNEL_PREFIX = "openclaw:events:";

// 事件类型定义
export type EventType =
  | "session.created"
  | "session.expired"
  | "session.revoked"
  | "quota.updated"
  | "quota.exceeded"
  | "user.updated"
  | "user.suspended"
  | "config.changed"
  | "agent.started"
  | "agent.completed"
  | "agent.error"
  | "message.received"
  | "message.sent"
  | "file.uploaded"
  | "file.deleted"
  | "skill.installed"
  | "skill.uninstalled"
  | "system.shutdown"
  | "system.maintenance";

/**
 * 事件数据结构
 */
export interface EventPayload<T = unknown> {
  /** 事件类型 */
  type: EventType;
  /** 事件数据 */
  data: T;
  /** 事件来源 */
  source: string;
  /** 事件时间戳 */
  timestamp: string;
  /** 关联用户 ID */
  userId?: string;
  /** 关联会话 ID */
  sessionId?: string;
  /** 追踪 ID */
  traceId?: string;
}

/**
 * 事件处理器类型
 */
export type EventHandler<T = unknown> = (event: EventPayload<T>) => void | Promise<void>;

// 模块级变量
let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;
const eventHandlers = new Map<string, Set<EventHandler>>();
const patternHandlers = new Map<string, Set<EventHandler>>();

/**
 * 获取发布者客户端
 */
function getPublisher(): Redis {
  if (!publisherClient) {
    const config = getRedisConfigFromEnv();
    publisherClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      lazyConnect: false,
    });

    publisherClient.on("error", (error) => {
      logger.error("[pubsub] Publisher error", { error: error.message });
    });

    publisherClient.on("connect", () => {
      logger.info("[pubsub] Publisher connected");
    });
  }
  return publisherClient;
}

/**
 * 获取订阅者客户端
 */
function getSubscriber(): Redis {
  if (!subscriberClient) {
    const config = getRedisConfigFromEnv();
    subscriberClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      // 订阅者不需要 keyPrefix
      lazyConnect: false,
    });

    subscriberClient.on("error", (error) => {
      logger.error("[pubsub] Subscriber error", { error: error.message });
    });

    subscriberClient.on("connect", () => {
      logger.info("[pubsub] Subscriber connected");
    });

    // 设置消息处理器
    subscriberClient.on("message", (channel: string, message: string) => {
      handleMessage(channel, message);
    });

    subscriberClient.on("pmessage", (pattern: string, channel: string, message: string) => {
      handlePatternMessage(pattern, channel, message);
    });
  }
  return subscriberClient;
}

/**
 * 处理普通消息
 */
function handleMessage(channel: string, message: string): void {
  const handlers = eventHandlers.get(channel);

  if (!handlers || handlers.size === 0) {
    return;
  }

  try {
    const event = JSON.parse(message) as EventPayload;

    logger.debug("[pubsub] Received event", {
      channel,
      type: event.type,
      source: event.source,
    });

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error("[pubsub] Event handler error", {
              channel,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        logger.error("[pubsub] Event handler error", {
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error("[pubsub] Failed to parse event message", {
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 处理模式匹配消息
 */
function handlePatternMessage(pattern: string, channel: string, message: string): void {
  const handlers = patternHandlers.get(pattern);

  if (!handlers || handlers.size === 0) {
    return;
  }

  try {
    const event = JSON.parse(message) as EventPayload;

    logger.debug("[pubsub] Received pattern event", {
      pattern,
      channel,
      type: event.type,
    });

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error("[pubsub] Pattern handler error", {
              pattern,
              channel,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        logger.error("[pubsub] Pattern handler error", {
          pattern,
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error("[pubsub] Failed to parse pattern event message", {
      pattern,
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 获取完整频道名
 */
function getChannelName(eventType: EventType): string {
  return `${CHANNEL_PREFIX}${eventType}`;
}

/**
 * 发布事件
 *
 * @param eventType 事件类型
 * @param data 事件数据
 * @param options 可选参数
 */
export async function publishEvent<T = unknown>(
  eventType: EventType,
  data: T,
  options: {
    source?: string;
    userId?: string;
    sessionId?: string;
    traceId?: string;
  } = {},
): Promise<void> {
  const publisher = getPublisher();
  const channel = getChannelName(eventType);

  const event: EventPayload<T> = {
    type: eventType,
    data,
    source: options.source || "gateway",
    timestamp: new Date().toISOString(),
    userId: options.userId,
    sessionId: options.sessionId,
    traceId: options.traceId,
  };

  try {
    await publisher.publish(channel, JSON.stringify(event));

    logger.debug("[pubsub] Event published", {
      channel,
      type: eventType,
      source: event.source,
    });
  } catch (error) {
    logger.error("[pubsub] Failed to publish event", {
      channel,
      type: eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 订阅事件
 *
 * @param eventType 事件类型
 * @param handler 事件处理器
 * @returns 取消订阅函数
 */
export async function subscribeEvent<T = unknown>(
  eventType: EventType,
  handler: EventHandler<T>,
): Promise<() => Promise<void>> {
  const subscriber = getSubscriber();
  const channel = getChannelName(eventType);

  // 添加处理器
  if (!eventHandlers.has(channel)) {
    eventHandlers.set(channel, new Set());
    // 首次订阅该频道
    await subscriber.subscribe(channel);
    logger.info("[pubsub] Subscribed to channel", { channel });
  }

  eventHandlers.get(channel)!.add(handler as EventHandler);

  // 返回取消订阅函数
  return async () => {
    const handlers = eventHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler as EventHandler);

      // 如果没有处理器了，取消订阅
      if (handlers.size === 0) {
        eventHandlers.delete(channel);
        await subscriber.unsubscribe(channel);
        logger.info("[pubsub] Unsubscribed from channel", { channel });
      }
    }
  };
}

/**
 * 订阅事件模式
 *
 * @param pattern 模式（如 "session.*"）
 * @param handler 事件处理器
 * @returns 取消订阅函数
 */
export async function subscribePattern<T = unknown>(
  pattern: string,
  handler: EventHandler<T>,
): Promise<() => Promise<void>> {
  const subscriber = getSubscriber();
  const fullPattern = `${CHANNEL_PREFIX}${pattern}`;

  // 添加处理器
  if (!patternHandlers.has(fullPattern)) {
    patternHandlers.set(fullPattern, new Set());
    // 首次订阅该模式
    await subscriber.psubscribe(fullPattern);
    logger.info("[pubsub] Subscribed to pattern", { pattern: fullPattern });
  }

  patternHandlers.get(fullPattern)!.add(handler as EventHandler);

  // 返回取消订阅函数
  return async () => {
    const handlers = patternHandlers.get(fullPattern);
    if (handlers) {
      handlers.delete(handler as EventHandler);

      // 如果没有处理器了，取消订阅
      if (handlers.size === 0) {
        patternHandlers.delete(fullPattern);
        await subscriber.punsubscribe(fullPattern);
        logger.info("[pubsub] Unsubscribed from pattern", { pattern: fullPattern });
      }
    }
  };
}

/**
 * 关闭 Pub/Sub 连接
 */
export async function closePubSub(): Promise<void> {
  logger.info("[pubsub] Closing Pub/Sub connections...");

  try {
    if (subscriberClient) {
      // 取消所有订阅
      await subscriberClient.unsubscribe();
      await subscriberClient.punsubscribe();
      await subscriberClient.quit();
      subscriberClient = null;
    }

    if (publisherClient) {
      await publisherClient.quit();
      publisherClient = null;
    }

    // 清理处理器
    eventHandlers.clear();
    patternHandlers.clear();

    logger.info("[pubsub] Pub/Sub connections closed");
  } catch (error) {
    logger.error("[pubsub] Error closing Pub/Sub connections", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 获取订阅统计
 */
export function getPubSubStats(): {
  channels: number;
  patterns: number;
  handlers: number;
} {
  let totalHandlers = 0;

  for (const handlers of eventHandlers.values()) {
    totalHandlers += handlers.size;
  }

  for (const handlers of patternHandlers.values()) {
    totalHandlers += handlers.size;
  }

  return {
    channels: eventHandlers.size,
    patterns: patternHandlers.size,
    handlers: totalHandlers,
  };
}

// 进程退出时关闭连接
process.on("SIGTERM", async () => {
  await closePubSub();
});

process.on("SIGINT", async () => {
  await closePubSub();
});
