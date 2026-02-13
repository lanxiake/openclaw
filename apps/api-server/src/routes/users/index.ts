/**
 * 用户自服务 API 路由
 *
 * GET    /api/users/me              - 获取当前用户信息
 * PUT    /api/users/me              - 更新当前用户信息
 * GET    /api/users/me/devices      - 获取用户设备列表
 * GET    /api/users/me/subscription - 获取用户订阅信息
 * GET    /api/users/me/usage        - 获取用户使用量
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { listUserDevices } from "../../../../../src/assistant/device/service.js";
import {
  getUserSubscription,
  getUserPlan,
  getUserDailyUsage,
  getUserMonthlyUsage,
} from "../../../../../src/assistant/subscription/service.js";
import { getRequestUser } from "../../plugins/auth.js";

/**
 * 注册用户自服务路由
 */
export function registerUsersRoutes(server: FastifyInstance): void {
  /**
   * GET /api/users/me - 获取当前用户信息
   */
  server.get(
    "/api/users/me",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[users] 获取当前用户信息",
      );

      // TODO: 从数据库获取完整用户信息
      // 目前返回 JWT 中的基本信息
      return {
        success: true,
        data: {
          id: user.userId,
          type: user.type,
        },
      };
    },
  );

  /**
   * PUT /api/users/me - 更新当前用户信息
   */
  server.put(
    "/api/users/me",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        displayName?: string;
        avatar?: string;
      };

      request.log.info(
        { userId: user.userId },
        "[users] 更新当前用户信息",
      );

      // TODO: 实现用户信息更新逻辑
      return {
        success: true,
        data: {
          id: user.userId,
          displayName: body.displayName,
          avatar: body.avatar,
        },
      };
    },
  );

  /**
   * GET /api/users/me/devices - 获取用户设备列表
   */
  server.get(
    "/api/users/me/devices",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[users] 获取用户设备列表",
      );

      const result = await listUserDevices(user.userId);

      return {
        success: true,
        data: result.devices,
        meta: {
          total: result.total,
          quota: result.quota,
        },
      };
    },
  );

  /**
   * GET /api/users/me/subscription - 获取用户订阅信息
   */
  server.get(
    "/api/users/me/subscription",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[users] 获取用户订阅信息",
      );

      const subscription = await getUserSubscription(user.userId);
      const plan = await getUserPlan(user.userId);

      return {
        success: true,
        data: {
          subscription,
          plan,
        },
      };
    },
  );

  /**
   * GET /api/users/me/usage - 获取用户使用量
   */
  server.get(
    "/api/users/me/usage",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info(
        { userId: user.userId },
        "[users] 获取用户使用量",
      );

      const dailyUsage = await getUserDailyUsage(user.userId);
      const monthlyUsage = await getUserMonthlyUsage(user.userId);

      return {
        success: true,
        data: {
          daily: dailyUsage,
          monthly: monthlyUsage,
        },
      };
    },
  );
}
