/**
 * 用户注册 API 路由 (新版)
 *
 * POST   /api/auth/send-verification-code  - 发送验证码
 * POST   /api/auth/register-by-phone       - 手机号注册
 * POST   /api/auth/register-by-email       - 邮箱注册
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  sendVerificationCode,
  type TargetType,
  type VerificationPurpose,
} from "../../../../../src/services/verification-code-service.js";
import {
  registerByPhone,
  registerByEmail,
  registerByWeChat,
  type RegisterByPhoneParams,
  type RegisterByEmailParams,
  type RegisterByWeChatParams,
} from "../../../../../src/services/user-registration-service.js";
import { login } from "../../../../../src/assistant/auth/auth-service.js";
import { getCreditService } from "../../../../../src/assistant/credits/index.js";
import { generateAccessToken } from "../../../../../src/assistant/auth/jwt.js";
import { getUserSessionRepository } from "../../../../../src/db/index.js";
import { getClientInfo } from "../../plugins/request-utils.js";
import { validateCaptchaToken } from "../../../../../src/services/captcha-service.js";
import {
  isEncrypted,
  decryptPassword,
} from "../../../../../src/services/rsa-key-service.js";

/**
 * 注册用户注册路由
 */
export function registerUserRegistrationRoutes(server: FastifyInstance): void {
  /**
   * POST /api/auth/send-verification-code - 发送验证码
   */
  server.post(
    "/api/auth/send-verification-code",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        phone?: string;
        email?: string;
        purpose?: VerificationPurpose;
      };

      // 参数校验
      if (!body.phone && !body.email) {
        return reply.code(400).send({
          success: false,
          error: "手机号或邮箱必须提供一个",
          code: "VALIDATION_ERROR",
        });
      }

      if (body.phone && body.email) {
        return reply.code(400).send({
          success: false,
          error: "手机号和邮箱只能提供一个",
          code: "VALIDATION_ERROR",
        });
      }

      const target = body.phone || body.email!;
      const targetType: TargetType = body.phone ? "phone" : "email";
      const purpose: VerificationPurpose = body.purpose || "register";

      request.log.info(
        { target, targetType, purpose },
        "[auth] 发送验证码请求"
      );

      try {
        const result = await sendVerificationCode(target, targetType, purpose);

        request.log.info(
          { target, targetType, expiresAt: result.expiresAt },
          "[auth] 验证码发送成功"
        );

        return {
          success: true,
          data: {
            expiresAt: result.expiresAt,
            expiresIn: Math.floor(
              (result.expiresAt.getTime() - Date.now()) / 1000
            ),
          },
        };
      } catch (error) {
        request.log.error(
          { target, targetType, error },
          "[auth] 验证码发送失败"
        );

        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "验证码发送失败",
          code: "SEND_CODE_FAILED",
        });
      }
    }
  );

  /**
   * POST /api/auth/register-by-phone - 手机号注册
   */
  server.post(
    "/api/auth/register-by-phone",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as RegisterByPhoneParams & {
        captchaToken?: string;
      };

      // 验证码 token 校验
      if (
        !body.captchaToken ||
        !(await validateCaptchaToken(body.captchaToken))
      ) {
        return reply.code(400).send({
          success: false,
          error: "验证码无效或已过期，请重新验证",
          code: "CAPTCHA_INVALID",
        });
      }

      // 参数校验
      if (!body.phone) {
        return reply.code(400).send({
          success: false,
          error: "手机号不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.verificationCode) {
        return reply.code(400).send({
          success: false,
          error: "验证码不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info({ phone: body.phone, ipAddress }, "[auth] 手机号注册请求");

      try {
        // 1. 注册用户
        const registerResult = await registerByPhone(body);

        if (!registerResult.success) {
          request.log.warn(
            { phone: body.phone, error: registerResult.error },
            "[auth] 手机号注册失败"
          );

          return reply.code(400).send({
            success: false,
            error: registerResult.error || "注册失败",
            code: "REGISTER_FAILED",
          });
        }

        request.log.info(
          { phone: body.phone, userId: registerResult.user?.id },
          "[auth] 手机号注册成功"
        );

        // 非阻塞赠送注册积分
        if (registerResult.user?.id) {
          getCreditService().grantRegistrationBonus(registerResult.user.id).catch((err) => {
            request.log.error(
              { userId: registerResult.user?.id, error: err },
              "[auth] 注册积分赠送失败（不影响注册流程）",
            );
          });
        }

        // 2. 自动登录
        // RSA 密码解密
        const plainPassword =
          body.password && isEncrypted(body.password)
            ? decryptPassword(body.password)
            : body.password;
        let loginResult;
        if (plainPassword) {
          // 如果设置了密码,使用密码登录
          loginResult = await login({
            identifier: body.phone,
            password: plainPassword,
            ipAddress,
            userAgent,
          });
        } else {
          // 如果没有设置密码,生成 token (无密码登录)
          const { accessToken, expiresIn } = generateAccessToken(registerResult.user!.id);
          const sessionRepo = getUserSessionRepository();
          const { session: _session, refreshToken } = await sessionRepo.create(registerResult.user!.id, {
            ipAddress,
            userAgent,
          });

          loginResult = {
            success: true,
            user: registerResult.user,
            accessToken,
            refreshToken,
            expiresIn,
          };
        }

        return {
          success: true,
          data: {
            user: registerResult.user,
            accessToken: loginResult.accessToken,
            refreshToken: loginResult.refreshToken,
            expiresIn: loginResult.expiresIn,
          },
        };
      } catch (error) {
        request.log.error(
          { phone: body.phone, error },
          "[auth] 手机号注册异常"
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "注册失败",
          code: "REGISTER_ERROR",
        });
      }
    }
  );

  /**
   * POST /api/auth/register-by-email - 邮箱注册
   */
  server.post(
    "/api/auth/register-by-email",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as RegisterByEmailParams & {
        captchaToken?: string;
      };

      // 验证码 token 校验
      if (
        !body.captchaToken ||
        !(await validateCaptchaToken(body.captchaToken))
      ) {
        return reply.code(400).send({
          success: false,
          error: "验证码无效或已过期，请重新验证",
          code: "CAPTCHA_INVALID",
        });
      }

      // 参数校验
      if (!body.email) {
        return reply.code(400).send({
          success: false,
          error: "邮箱不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.verificationCode) {
        return reply.code(400).send({
          success: false,
          error: "验证码不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.password) {
        return reply.code(400).send({
          success: false,
          error: "密码不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info({ email: body.email, ipAddress }, "[auth] 邮箱注册请求");

      try {
        // 1. 注册用户
        const registerResult = await registerByEmail(body);

        if (!registerResult.success) {
          request.log.warn(
            { email: body.email, error: registerResult.error },
            "[auth] 邮箱注册失败"
          );

          return reply.code(400).send({
            success: false,
            error: registerResult.error || "注册失败",
            code: "REGISTER_FAILED",
          });
        }

        request.log.info(
          { email: body.email, userId: registerResult.user?.id },
          "[auth] 邮箱注册成功"
        );

        // 非阻塞赠送注册积分
        if (registerResult.user?.id) {
          getCreditService().grantRegistrationBonus(registerResult.user.id).catch((err) => {
            request.log.error(
              { userId: registerResult.user?.id, error: err },
              "[auth] 注册积分赠送失败（不影响注册流程）",
            );
          });
        }

        // 2. 自动登录
        // RSA 密码解密
        const plainPassword = isEncrypted(body.password)
          ? decryptPassword(body.password)
          : body.password;
        const loginResult = await login({
          identifier: body.email,
          password: plainPassword,
          ipAddress,
          userAgent,
        });

        return {
          success: true,
          data: {
            user: registerResult.user,
            accessToken: loginResult.accessToken,
            refreshToken: loginResult.refreshToken,
            expiresIn: loginResult.expiresIn,
          },
        };
      } catch (error) {
        request.log.error({ email: body.email, error }, "[auth] 邮箱注册异常");

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "注册失败",
          code: "REGISTER_ERROR",
        });
      }
    }
  );

  /**
   * GET /api/auth/wechat/authorize-url - 获取微信授权 URL
   */
  server.get(
    "/api/auth/wechat/authorize-url",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { redirectUri?: string };

      if (!query.redirectUri) {
        return reply.code(400).send({
          success: false,
          error: "redirectUri 参数不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      // TODO: 实现微信 OAuth 授权 URL 生成
      // 需要配置: WECHAT_APP_ID, WECHAT_APP_SECRET
      const wechatAppId = process.env.WECHAT_APP_ID;
      if (!wechatAppId) {
        return reply.code(500).send({
          success: false,
          error: "微信 OAuth 未配置",
          code: "CONFIG_ERROR",
        });
      }

      const state = Math.random().toString(36).substring(7);
      const authorizeUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${wechatAppId}&redirect_uri=${encodeURIComponent(query.redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;

      request.log.info({ redirectUri: query.redirectUri }, "[auth] 生成微信授权 URL");

      return {
        success: true,
        data: {
          authorizeUrl,
          state,
        },
      };
    }
  );

  /**
   * GET /api/auth/wechat/callback - 微信 OAuth 回调
   */
  server.get(
    "/api/auth/wechat/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { code?: string; state?: string };

      if (!query.code) {
        return reply.code(400).send({
          success: false,
          error: "授权码不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info({ code: query.code, state: query.state }, "[auth] 微信 OAuth 回调");

      try {
        // TODO: 实现微信 OAuth 回调处理
        // 1. 使用 code 换取 access_token 和 openid
        // 2. 使用 access_token 获取用户信息
        // 3. 注册或登录用户
        // 4. 重定向到前端,携带 token

        return reply.code(501).send({
          success: false,
          error: "微信 OAuth 回调处理尚未实现",
          code: "NOT_IMPLEMENTED",
        });
      } catch (error) {
        request.log.error({ error }, "[auth] 微信 OAuth 回调异常");

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "授权失败",
          code: "OAUTH_ERROR",
        });
      }
    }
  );

  /**
   * POST /api/auth/wechat/register - 微信注册 (直接使用 openId)
   */
  server.post(
    "/api/auth/wechat/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as RegisterByWeChatParams;

      // 参数校验
      if (!body.wechatOpenId) {
        return reply.code(400).send({
          success: false,
          error: "微信 OpenID 不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      const { ipAddress, userAgent } = getClientInfo(request);

      request.log.info(
        { wechatOpenId: body.wechatOpenId, ipAddress },
        "[auth] 微信注册请求"
      );

      try {
        // 1. 注册用户
        const registerResult = await registerByWeChat(body);

        if (!registerResult.success) {
          request.log.warn(
            { wechatOpenId: body.wechatOpenId, error: registerResult.error },
            "[auth] 微信注册失败"
          );

          return reply.code(400).send({
            success: false,
            error: registerResult.error || "注册失败",
            code: "REGISTER_FAILED",
          });
        }

        request.log.info(
          { wechatOpenId: body.wechatOpenId, userId: registerResult.user?.id },
          "[auth] 微信注册成功"
        );

        // 非阻塞赠送注册积分
        if (registerResult.user?.id) {
          getCreditService().grantRegistrationBonus(registerResult.user.id).catch((err) => {
            request.log.error(
              { userId: registerResult.user?.id, error: err },
              "[auth] 注册积分赠送失败（不影响注册流程）",
            );
          });
        }

        // 2. 自动登录 (生成 token)
        const { accessToken, expiresIn } = generateAccessToken(registerResult.user!.id);
        const sessionRepo = getUserSessionRepository();
        const { session: _session, refreshToken } = await sessionRepo.create(registerResult.user!.id, {
          ipAddress,
          userAgent,
        });

        return {
          success: true,
          data: {
            user: registerResult.user,
            accessToken,
            refreshToken,
            expiresIn,
          },
        };
      } catch (error) {
        request.log.error(
          { wechatOpenId: body.wechatOpenId, error },
          "[auth] 微信注册异常"
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "注册失败",
          code: "REGISTER_ERROR",
        });
      }
    }
  );
}
