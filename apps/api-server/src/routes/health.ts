/**
 * 健康检查路由
 *
 * GET /api/health - 返回服务状态、版本和运行时间
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/** 服务启动时间 */
const startTime = Date.now();

/**
 * 注册健康检查路由
 */
export function registerHealthRoutes(server: FastifyInstance): void {
  server.get(
    "/api/health",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const uptimeMs = Date.now() - startTime;
      const uptimeSeconds = Math.floor(uptimeMs / 1000);

      return {
        success: true,
        data: {
          status: "ok",
          version: "1.0.0",
          uptime: uptimeSeconds,
          uptimeHuman: formatUptime(uptimeSeconds),
          timestamp: new Date().toISOString(),
        },
      };
    },
  );
}

/**
 * 格式化运行时间为人类可读字符串
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}
