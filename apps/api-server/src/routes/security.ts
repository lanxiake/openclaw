/**
 * 安全相关 API 路由
 *
 * GET /api/auth/public-key - 获取 RSA 公钥用于前端密码加密
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getPublicKeyPem } from "../../../../src/services/rsa-key-service.js";

/**
 * 注册安全路由
 */
export function registerSecurityRoutes(server: FastifyInstance): void {
  // 获取 RSA 公钥
  server.get(
    "/api/auth/public-key",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      return {
        success: true,
        data: {
          publicKey: getPublicKeyPem(),
        },
      };
    },
  );
}
