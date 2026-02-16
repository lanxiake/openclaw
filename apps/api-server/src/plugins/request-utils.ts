/**
 * 请求工具函数
 *
 * 提供从 Fastify 请求中提取通用信息的工具方法
 */

import type { FastifyRequest } from "fastify";

/**
 * 客户端信息
 */
export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
}

/**
 * 从请求中提取客户端信息
 *
 * 优先从 x-forwarded-for 头部获取 IP（支持反向代理），
 * 回退到 request.ip，最后使用 "unknown"。
 *
 * @param request - Fastify 请求对象
 * @returns 客户端 IP 和 User-Agent
 */
export function getClientInfo(request: FastifyRequest): ClientInfo {
  const ipAddress =
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    request.ip ||
    "unknown";
  const userAgent = (request.headers["user-agent"] as string) || "unknown";
  return { ipAddress, userAgent };
}
