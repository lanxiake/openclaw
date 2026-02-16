/**
 * 设备管理 API 路由
 *
 * 提供设备列表查询、更新、撤销和配对功能
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getUserDeviceRepository } from "../../../../../src/db/index.js";
import {
  listDevicesByUserId,
  getPairedDevice,
  requestDevicePairing,
  approveDevicePairing,
  rejectDevicePairing,
  updateDeviceUserId,
  type PendingRequestCompat as DevicePairingPendingRequest,
} from "../../../../../src/infra/device-pairing-db.js";

/**
 * 从请求中提取用户 ID
 */
function getUserIdFromRequest(request: FastifyRequest): string | null {
  // 从 JWT token 中提取用户 ID
  // 假设 JWT 已经在中间件中验证并解析到 request.user
  const user = (request as any).user;
  return user?.id || null;
}

/**
 * 注册设备管理路由
 */
export function registerDeviceManagementRoutes(server: FastifyInstance): void {
  /**
   * GET /api/devices - 获取当前用户的设备列表
   */
  server.get(
    "/api/devices",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId }, "[devices] 查询用户设备列表");

      try {
        // 1. 从数据库查询 user_devices
        const userDeviceRepo = getUserDeviceRepository();
        const userDevices = await userDeviceRepo.findByUserId(userId);

        // 2. 从 device-pairing 获取设备详细信息
        const devices = await Promise.all(
          userDevices.map(async (ud) => {
            const pairedDevice = await getPairedDevice(ud.deviceId);

            return {
              deviceId: ud.deviceId,
              userId: ud.userId,
              alias: ud.alias,
              isPrimary: ud.isPrimary,
              linkedAt: ud.linkedAt,
              lastActiveAt: ud.lastActiveAt,
              // 从 device-pairing 获取的信息
              displayName: pairedDevice?.displayName,
              platform: pairedDevice?.platform,
              role: pairedDevice?.role,
              scopes: pairedDevice?.scopes || [],
            };
          })
        );

        request.log.info({ userId, count: devices.length }, "[devices] 查询成功");

        return {
          success: true,
          data: {
            devices,
          },
        };
      } catch (error) {
        request.log.error({ userId, error }, "[devices] 查询失败");

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "查询失败",
          code: "QUERY_ERROR",
        });
      }
    }
  );

  /**
   * PATCH /api/devices/:deviceId - 更新设备信息
   */
  server.patch(
    "/api/devices/:deviceId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);
      const { deviceId } = request.params as { deviceId: string };
      const body = request.body as {
        alias?: string;
        isPrimary?: boolean;
      };

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId, deviceId, body }, "[devices] 更新设备信息");

      try {
        // 1. 验证设备是否属于当前用户
        const userDeviceRepo = getUserDeviceRepository();
        const userDevice = await userDeviceRepo.findByDeviceId(deviceId);

        if (!userDevice || userDevice.userId !== userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此设备",
            code: "FORBIDDEN",
          });
        }

        // 2. 更新设备信息
        const updated = await userDeviceRepo.update(deviceId, {
          alias: body.alias,
          isPrimary: body.isPrimary,
        });

        request.log.info({ userId, deviceId }, "[devices] 更新成功");

        return {
          success: true,
          data: {
            device: updated,
          },
        };
      } catch (error) {
        request.log.error({ userId, deviceId, error }, "[devices] 更新失败");

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "更新失败",
          code: "UPDATE_ERROR",
        });
      }
    }
  );

  /**
   * DELETE /api/devices/:deviceId - 撤销设备
   */
  server.delete(
    "/api/devices/:deviceId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);
      const { deviceId } = request.params as { deviceId: string };

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId, deviceId }, "[devices] 撤销设备");

      try {
        // 1. 验证设备是否属于当前用户
        const userDeviceRepo = getUserDeviceRepository();
        const userDevice = await userDeviceRepo.findByDeviceId(deviceId);

        if (!userDevice || userDevice.userId !== userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此设备",
            code: "FORBIDDEN",
          });
        }

        // 2. 从数据库删除 user_devices 记录
        await userDeviceRepo.delete(deviceId);

        // 3. TODO: 从 device-pairing 中撤销设备
        // 需要实现 revokeDevice() 函数

        request.log.info({ userId, deviceId }, "[devices] 撤销成功");

        return {
          success: true,
        };
      } catch (error) {
        request.log.error({ userId, deviceId, error }, "[devices] 撤销失败");

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "撤销失败",
          code: "DELETE_ERROR",
        });
      }
    }
  );

  /**
   * POST /api/devices/pair-request - 发起设备配对请求
   */
  server.post(
    "/api/devices/pair-request",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);
      const body = request.body as {
        deviceId: string;
        publicKey: string;
        displayName?: string;
        platform?: string;
        clientId?: string;
        clientMode?: string;
        role?: string;
        scopes?: string[];
      };

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      // 参数校验
      if (!body.deviceId) {
        return reply.code(400).send({
          success: false,
          error: "设备 ID 不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      if (!body.publicKey) {
        return reply.code(400).send({
          success: false,
          error: "设备公钥不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      const remoteIp =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        request.ip ||
        "unknown";

      request.log.info(
        { userId, deviceId: body.deviceId, platform: body.platform },
        "[devices] 发起设备配对请求"
      );

      try {
        const result = await requestDevicePairing({
          deviceId: body.deviceId,
          publicKey: body.publicKey,
          userId,
          displayName: body.displayName,
          platform: body.platform,
          clientId: body.clientId,
          clientMode: body.clientMode,
          role: body.role,
          scopes: body.scopes,
          remoteIp,
        });

        request.log.info(
          {
            userId,
            deviceId: body.deviceId,
            requestId: result.request.requestId,
            created: result.created,
          },
          "[devices] 配对请求已创建"
        );

        // 计算过期时间 (5 分钟)
        const expiresAt = new Date(result.request.ts + 5 * 60 * 1000);

        return {
          success: true,
          data: {
            requestId: result.request.requestId,
            status: result.status,
            expiresAt: expiresAt.toISOString(),
          },
        };
      } catch (error) {
        request.log.error(
          { userId, deviceId: body.deviceId, error },
          "[devices] 配对请求失败"
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "配对请求失败",
          code: "PAIR_REQUEST_ERROR",
        });
      }
    }
  );

  /**
   * POST /api/devices/pair-approve - 批准设备配对
   */
  server.post(
    "/api/devices/pair-approve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);
      const body = request.body as {
        requestId: string;
        role?: string;
        scopes?: string[];
      };

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      // 参数校验
      if (!body.requestId) {
        return reply.code(400).send({
          success: false,
          error: "配对请求 ID 不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { userId, requestId: body.requestId },
        "[devices] 批准设备配对"
      );

      try {
        // 1. 批准配对请求
        const result = await approveDevicePairing(body.requestId);

        if (!result) {
          return reply.code(404).send({
            success: false,
            error: "配对请求不存在或已过期",
            code: "REQUEST_NOT_FOUND",
          });
        }

        // 2. 更新 device-pairing 中的 userId
        await updateDeviceUserId(result.device.deviceId, userId);

        // 3. 创建 user_devices 关联
        const userDeviceRepo = getUserDeviceRepository();
        try {
          await userDeviceRepo.linkDevice(userId, result.device.deviceId, {
            alias: result.device.displayName,
            isPrimary: false,
          });
        } catch (linkError) {
          // 如果已存在关联，忽略错误
          request.log.warn(
            { userId, deviceId: result.device.deviceId, error: linkError },
            "[devices] 设备关联已存在"
          );
        }

        request.log.info(
          { userId, deviceId: result.device.deviceId, requestId: body.requestId },
          "[devices] 配对批准成功"
        );

        // 4. 获取设备 token
        const deviceToken = result.device.tokens?.[result.device.role || "user"]?.token;

        return {
          success: true,
          data: {
            device: {
              deviceId: result.device.deviceId,
              userId,
              displayName: result.device.displayName,
              platform: result.device.platform,
              role: result.device.role,
              scopes: result.device.scopes || [],
              createdAt: new Date(result.device.createdAtMs).toISOString(),
              approvedAt: new Date(result.device.approvedAtMs).toISOString(),
            },
            deviceToken,
          },
        };
      } catch (error) {
        request.log.error(
          { userId, requestId: body.requestId, error },
          "[devices] 配对批准失败"
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "配对批准失败",
          code: "PAIR_APPROVE_ERROR",
        });
      }
    }
  );

  /**
   * POST /api/devices/pair-reject - 拒绝设备配对
   */
  server.post(
    "/api/devices/pair-reject",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserIdFromRequest(request);
      const body = request.body as {
        requestId: string;
        reason?: string;
      };

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: "未授权",
          code: "UNAUTHORIZED",
        });
      }

      // 参数校验
      if (!body.requestId) {
        return reply.code(400).send({
          success: false,
          error: "配对请求 ID 不能为空",
          code: "VALIDATION_ERROR",
        });
      }

      request.log.info(
        { userId, requestId: body.requestId, reason: body.reason },
        "[devices] 拒绝设备配对"
      );

      try {
        const result = await rejectDevicePairing(body.requestId);

        if (!result) {
          return reply.code(404).send({
            success: false,
            error: "配对请求不存在或已过期",
            code: "REQUEST_NOT_FOUND",
          });
        }

        request.log.info(
          { userId, deviceId: result.deviceId, requestId: body.requestId },
          "[devices] 配对拒绝成功"
        );

        return {
          success: true,
        };
      } catch (error) {
        request.log.error(
          { userId, requestId: body.requestId, error },
          "[devices] 配对拒绝失败"
        );

        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "配对拒绝失败",
          code: "PAIR_REJECT_ERROR",
        });
      }
    }
  );
}
