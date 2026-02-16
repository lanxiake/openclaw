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
import {
  getUserRepository,
  type UserRepository,
} from "../../../../../src/db/repositories/users.js";
import type { User } from "../../../../../src/db/schema/index.js";
import { getRequestUser } from "../../plugins/auth.js";

/**
 * 过滤用户对象中的敏感字段
 */
function filterSensitiveFields(
  user: User,
): Omit<User, "passwordHash" | "mfaSecret" | "mfaBackupCodes"> {
  const { passwordHash: _, mfaSecret: __, mfaBackupCodes: ___, ...safeUser } = user;
  return safeUser;
}

/** 路由配置选项 */
export interface UsersRoutesOptions {
  /** 可选的 UserRepository 实例，用于测试时注入 mock */
  userRepository?: UserRepository;
}

/**
 * 注册用户自服务路由
 */
export function registerUsersRoutes(
  server: FastifyInstance,
  options: UsersRoutesOptions = {},
): void {
  // 使用注入的 repository 或默认实例
  const userRepo = options.userRepository ?? getUserRepository();
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

      // 从数据库获取完整用户信息
      const dbUser = await userRepo.findById(user.userId);

      if (!dbUser) {
        request.log.warn({ userId: user.userId }, "[users] 用户不存在");
        return reply.code(404).send({
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // 过滤敏感字段后返回
      return {
        success: true,
        data: filterSensitiveFields(dbUser),
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

      // 输入验证：至少需要一个字段
      if (!body.displayName && !body.avatar) {
        return reply.code(400).send({
          success: false,
          error: "At least one field (displayName or avatar) is required",
          code: "VALIDATION_ERROR",
        });
      }

      // 输入验证：displayName 长度限制
      if (body.displayName && body.displayName.length > 100) {
        return reply.code(400).send({
          success: false,
          error: "displayName must be 100 characters or less",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { userId: user.userId, fields: Object.keys(body) },
        "[users] 更新当前用户信息",
      );

      // 检查用户是否存在
      const existingUser = await userRepo.findById(user.userId);
      if (!existingUser) {
        request.log.warn({ userId: user.userId }, "[users] 用户不存在");
        return reply.code(404).send({
          success: false,
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // 构建更新数据
      const updateData: { displayName?: string; avatarUrl?: string } = {};
      if (body.displayName !== undefined) {
        updateData.displayName = body.displayName;
      }
      if (body.avatar !== undefined) {
        updateData.avatarUrl = body.avatar;
      }

      // 执行更新
      const updatedUser = await userRepo.update(user.userId, updateData);
      if (!updatedUser) {
        request.log.error({ userId: user.userId }, "[users] 更新用户失败");
        return reply.code(500).send({
          success: false,
          error: "Failed to update user",
          code: "UPDATE_FAILED",
        });
      }

      request.log.info({ userId: user.userId }, "[users] 用户信息更新成功");

      // 过滤敏感字段后返回
      return {
        success: true,
        data: filterSensitiveFields(updatedUser),
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
