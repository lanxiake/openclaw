/**
 * Swagger 文档配置插件
 *
 * 使用 @fastify/swagger 和 @fastify/swagger-ui 提供 API 文档
 */

import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * 注册 Swagger 文档插件
 */
export async function registerSwaggerPlugin(server: FastifyInstance): Promise<void> {
  // 注册 Swagger 核心插件
  await server.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "OpenClaw API Server",
        description: "OpenClaw 多租户 AI 助手平台 REST API",
        version: "1.0.0",
        contact: {
          name: "OpenClaw Team",
        },
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server",
        },
      ],
      tags: [
        { name: "health", description: "健康检查" },
        { name: "auth", description: "用户认证" },
        { name: "users", description: "用户自服务" },
        { name: "conversations", description: "对话管理" },
        { name: "memories", description: "记忆管理" },
        { name: "assistant-config", description: "AI 助手配置" },
        { name: "skills", description: "用户自建技能" },
        { name: "files", description: "文件管理" },
        { name: "store", description: "技能商店" },
        { name: "admin-auth", description: "管理员认证" },
        { name: "admin-users", description: "用户管理（管理员）" },
        { name: "admin-subscriptions", description: "订阅管理（管理员）" },
        { name: "admin-plans", description: "套餐管理（管理员）" },
        { name: "admin-skills", description: "技能管理（管理员）" },
        { name: "admin-audit", description: "审计日志（管理员）" },
        { name: "admin-config", description: "系统配置（管理员）" },
        { name: "admin-monitor", description: "系统监控（管理员）" },
        { name: "admin-dashboard", description: "仪表盘（管理员）" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "用户或管理员 JWT Token",
          },
        },
      },
    },
  });

  // 注册 Swagger UI 插件
  await server.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  server.log.info("[swagger] Swagger UI 已注册，访问 /docs 查看 API 文档");
}
