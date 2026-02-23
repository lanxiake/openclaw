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
  registerModelProviderRoutes,
  registerAgentConfigRoutes,
  registerAuthProfileRoutes,
  registerGatewayConfigRoutes,
  registerAdminAnalyticsRoutes,
  registerAdminLlmLogRoutes,
  registerAdminCreditsRoutes,
  registerAdminAdminsRoutes,
} from "./routes/admin/index.js";
import { registerAuthRoutes } from "./routes/auth/index.js";
import { registerUsersRoutes } from "./routes/users/index.js";
import { registerDeviceManagementRoutes } from "./routes/devices/index.js";
import { registerConversationsRoutes } from "./routes/conversations/index.js";
import { registerMemoriesRoutes } from "./routes/memories/index.js";
import { registerAssistantConfigRoutes } from "./routes/assistant-config/index.js";
import { registerSkillsRoutes } from "./routes/skills/index.js";
import { registerFilesRoutes } from "./routes/files/index.js";
import { registerStoreRoutes } from "./routes/store/index.js";
import { registerPlansRoutes } from "./routes/plans/index.js";
import { registerSubscriptionsRoutes } from "./routes/subscriptions/index.js";
import { registerPaymentsRoutes } from "./routes/payments/index.js";
import { registerAuditRoutes } from "./routes/audit/index.js";
import { registerUserConfigRoutes } from "./routes/user-config/index.js";
import { registerCreditsRoutes } from "./routes/credits/index.js";

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

  // 注册 application/octet-stream 内容类型解析器（技能包上传使用）
  server.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

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
  registerModelProviderRoutes(server);
  registerAgentConfigRoutes(server);
  registerAuthProfileRoutes(server);
  registerGatewayConfigRoutes(server);
  registerAdminAnalyticsRoutes(server);
  registerAdminLlmLogRoutes(server);
  registerAdminCreditsRoutes(server);
  registerAdminAdminsRoutes(server);

  // 7. 用户 API 路由（公开 + 认证）
  registerAuthRoutes(server);
  registerUsersRoutes(server);
  registerDeviceManagementRoutes(server);

  // 8. 用户功能 API 路由（需认证）
  registerConversationsRoutes(server);
  registerMemoriesRoutes(server);
  registerAssistantConfigRoutes(server);
  registerUserConfigRoutes(server);
  registerSkillsRoutes(server);
  registerFilesRoutes(server);
  registerAuditRoutes(server);

  // 9. 技能商店 API 路由（部分公开）
  registerStoreRoutes(server);

  // 10. 订阅与支付 API 路由
  registerPlansRoutes(server);
  registerSubscriptionsRoutes(server);
  registerPaymentsRoutes(server);

  // 11. 积分 API 路由
  registerCreditsRoutes(server);

  return server;
}
