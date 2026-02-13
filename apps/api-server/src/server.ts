/**
 * Fastify 实例创建与插件注册
 *
 * 注册顺序：CORS → Rate Limit → Error Handler → Auth → Routes
 */

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { type AppConfig } from "./config.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerAdminAuthPlugin } from "./plugins/admin-auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import {
  registerAdminAuthRoutes,
  registerAdminUsersRoutes,
  registerAdminSubscriptionsRoutes,
  registerAdminPlansRoutes,
  registerAdminSkillsRoutes,
  registerAdminAuditRoutes,
  registerAdminConfigRoutes,
  registerAdminMonitorRoutes,
  registerAdminDashboardRoutes,
} from "./routes/admin/index.js";
import { registerAuthRoutes } from "./routes/auth/index.js";
import { registerUsersRoutes } from "./routes/users/index.js";

/**
 * 创建并配置 Fastify 实例
 *
 * @param config - 应用配置
 * @returns 配置完成的 Fastify 实例
 */
export async function createServer(
  config: AppConfig,
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // 存储配置到 Fastify 实例
  server.decorate("config", config);

  // 1. CORS 插件
  await server.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  // 2. 限流插件
  await server.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      success: false,
      error: "Too many requests, please try again later",
      code: "RATE_LIMIT_EXCEEDED",
    }),
  });

  // 3. 全局错误处理插件
  registerErrorHandler(server);

  // 4. 认证插件
  registerAuthPlugin(server, config);
  registerAdminAuthPlugin(server, config);

  // 5. 路由注册
  registerHealthRoutes(server);

  // 6. 管理员 API 路由
  registerAdminAuthRoutes(server);
  registerAdminUsersRoutes(server);
  registerAdminSubscriptionsRoutes(server);
  registerAdminPlansRoutes(server);
  registerAdminSkillsRoutes(server);
  registerAdminAuditRoutes(server);
  registerAdminConfigRoutes(server);
  registerAdminMonitorRoutes(server);
  registerAdminDashboardRoutes(server);

  // 7. 用户 API 路由（公开 + 认证）
  registerAuthRoutes(server);
  registerUsersRoutes(server);

  return server;
}
