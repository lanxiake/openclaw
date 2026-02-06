/**
 * Assistant RPC 方法处理器
 *
 * 为 Windows 客户端提供 AI 助理相关的 RPC 方法
 * 包括对话、文件操作、系统操作等功能
 */

import { randomUUID } from "node:crypto";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { resolveAssistantIdentity } from "../assistant-identity.js";
import type { GatewayRequestHandlers } from "./types.js";

// 日志标签
const LOG_TAG = "assistant";

/**
 * 操作确认请求缓存
 * key: requestId, value: { action, resolve, reject, timeout }
 */
const pendingConfirmations = new Map<
  string,
  {
    action: string;
    description: string;
    level: "low" | "medium" | "high";
    resolve: (approved: boolean) => void;
    reject: (reason: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

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
 * 验证数字参数
 */
function validateNumberParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): number | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return value;
}

/**
 * 验证布尔参数
 */
function validateBooleanParam(
  params: Record<string, unknown>,
  key: string,
  required = false,
): boolean | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Parameter ${key} must be a boolean`);
  }
  return value;
}

/**
 * Assistant RPC 方法处理器
 */
export const assistantHandlers: GatewayRequestHandlers = {
  /**
   * 获取助理信息
   * 返回助理的名称、头像等身份信息
   */
  "assistant.info": ({ respond }) => {
    const cfg = loadConfig();
    const identity = resolveAssistantIdentity({ cfg });

    respond(
      true,
      {
        name: identity.name,
        avatar: identity.avatar,
        agentId: identity.agentId,
        version: "0.1.0",
        capabilities: [
          "chat",
          "file.list",
          "file.read",
          "file.write",
          "file.move",
          "file.delete",
          "system.info",
          "process.list",
          "process.kill",
          "app.launch",
        ],
      },
      undefined,
    );
  },

  /**
   * 对话接口
   * 接收用户消息，返回 AI 回复
   */
  "assistant.chat": async ({ params, respond, context }) => {
    try {
      const message = validateStringParam(params, "message", true);
      const sessionId = validateStringParam(params, "sessionId") ?? randomUUID();

      if (!message) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameter: message"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] chat request`, {
        sessionId,
        messageLength: message.length,
      });

      // TODO: 调用 AI 代理处理对话
      // 目前返回模拟响应
      const response = {
        content: `收到您的消息: "${message}"。AI 助理功能正在开发中，敬请期待！`,
        sessionId,
        timestamp: Date.now(),
      };

      respond(true, response, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, errorMessage),
      );
    }
  },

  /**
   * 请求用户确认敏感操作
   * 发送确认请求到客户端，等待用户响应
   */
  "assistant.confirm.request": async ({ params, respond, context }) => {
    try {
      const action = validateStringParam(params, "action", true);
      const description = validateStringParam(params, "description", true);
      const level = (validateStringParam(params, "level") ?? "medium") as
        | "low"
        | "medium"
        | "high";
      const timeoutMs = validateNumberParam(params, "timeoutMs") ?? 30000;

      if (!action || !description) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      const requestId = randomUUID();

      context.logGateway.info(`[${LOG_TAG}] confirm request`, {
        requestId,
        action,
        level,
      });

      // 创建确认请求的 Promise
      const confirmPromise = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingConfirmations.delete(requestId);
          reject(new Error("Confirmation timeout"));
        }, timeoutMs);

        pendingConfirmations.set(requestId, {
          action,
          description,
          level,
          resolve,
          reject,
          timeout,
        });
      });

      // 广播确认请求到客户端
      context.broadcast("confirm.request", {
        requestId,
        action,
        description,
        level,
        timeoutMs,
      });

      // 等待用户响应
      const approved = await confirmPromise;

      respond(
        true,
        {
          requestId,
          approved,
        },
        undefined,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, errorMessage),
      );
    }
  },

  /**
   * 用户响应确认请求
   */
  "assistant.confirm.response": ({ params, respond, context }) => {
    try {
      const requestId = validateStringParam(params, "requestId", true);
      const approved = validateBooleanParam(params, "approved", true);

      if (!requestId || approved === undefined) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing required parameters"),
        );
        return;
      }

      const pending = pendingConfirmations.get(requestId);
      if (!pending) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.NOT_FOUND, "Confirmation request not found or expired"),
        );
        return;
      }

      context.logGateway.info(`[${LOG_TAG}] confirm response`, {
        requestId,
        approved,
      });

      // 清理超时定时器
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(requestId);

      // 解析确认 Promise
      pending.resolve(approved);

      respond(true, { requestId, approved }, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, errorMessage),
      );
    }
  },

  /**
   * 获取客户端能力
   * 返回当前连接的客户端支持的功能列表
   */
  "assistant.capabilities": ({ respond }) => {
    respond(
      true,
      {
        version: "0.1.0",
        platform: "windows",
        features: {
          fileOperations: true,
          processManagement: true,
          systemInfo: true,
          skillExecution: true,
          notifications: true,
        },
      },
      undefined,
    );
  },

  /**
   * 心跳检测
   */
  "assistant.heartbeat": ({ params, respond }) => {
    const timestamp = validateNumberParam(params, "timestamp") ?? Date.now();

    respond(
      true,
      {
        timestamp,
        serverTime: Date.now(),
        status: "ok",
      },
      undefined,
    );
  },
};
