/**
 * 设备管理 API 路由
 *
 * 提供设备列表查询、更新和撤销功能
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getUserDeviceRepository } from "../../../../../src/db/index.js";
import { listDevicesByUserId, getPairedDevice } from "../../../../../src/infra/device-pairing.js";

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
}
