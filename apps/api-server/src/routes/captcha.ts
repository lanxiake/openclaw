/**
 * 验证码 API 路由
 *
 * GET  /api/captcha/challenge - 获取滑动验证码挑战
 * POST /api/captcha/verify    - 验证滑动位置
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  generateChallenge,
  verifyCaptcha,
} from "../../../../src/services/captcha-service.js";

/**
 * 注册验证码路由
 */
export function registerCaptchaRoutes(server: FastifyInstance): void {
  // 获取滑动验证码挑战
  server.get(
    "/api/captcha/challenge",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const challenge = await generateChallenge();
      return {
        success: true,
        data: challenge,
      };
    },
  );

  // 验证滑动位置
  server.post(
    "/api/captcha/verify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { captchaId, sliderX } = request.body as {
        captchaId?: string;
        sliderX?: number;
      };

      if (!captchaId || sliderX === undefined || sliderX === null) {
        reply.code(400).send({
          success: false,
          error: "Missing captchaId or sliderX",
          code: "INVALID_PARAMS",
        });
        return;
      }

      const result = await verifyCaptcha(captchaId, sliderX);
      return {
        success: result.success,
        data: result.success ? { token: result.token } : undefined,
        error: result.success ? undefined : "验证失败，请重试",
        code: result.success ? undefined : "CAPTCHA_FAILED",
      };
    },
  );
}
