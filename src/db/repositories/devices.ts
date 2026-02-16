/**
 * 设备数据访问层
 *
 * 提供设备 CRUD 操作 (PostgreSQL)
 */

import { eq, and, desc, gt, lt } from "drizzle-orm";

import { getDatabase, type Database } from "../connection.js";
import {
  devices,
  devicePairingRequests,
  type Device,
  type NewDevice,
  type DevicePairingRequest,
  type NewDevicePairingRequest,
  type DeviceAuthToken,
  type PairingRequestStatus,
} from "../schema/index.js";
import { generateId } from "../utils/id.js";
import { getLogger } from "../../logging/logger.js";

const logger = getLogger();

/** 配对请求有效期 (5 分钟) */
const PAIRING_REQUEST_TTL_MS = 5 * 60 * 1000;

/**
 * 生成设备令牌
 */
function generateDeviceToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * 设备仓库类
 */
export class DeviceRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 查找所有设备
   */
  async findAll(): Promise<Device[]> {
    return this.db.select().from(devices).orderBy(desc(devices.createdAt));
  }

  /**
   * 根据设备 ID 查找设备
   */
  async findByDeviceId(deviceId: string): Promise<Device | null> {
    const [device] = await this.db.select().from(devices).where(eq(devices.deviceId, deviceId));
    return device ?? null;
  }

  /**
   * 根据用户 ID 查找设备列表
   */
  async findByUserId(userId: string): Promise<Device[]> {
    return this.db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.isActive, true)))
      .orderBy(desc(devices.lastActiveAt));
  }

  /**
   * 根据 ID 查找设备
   */
  async findById(id: string): Promise<Device | null> {
    const [device] = await this.db.select().from(devices).where(eq(devices.id, id));
    return device ?? null;
  }

  /**
   * 创建设备
   */
  async create(data: Omit<NewDevice, "id" | "createdAt">): Promise<Device> {
    const id = generateId();
    const now = new Date();

    const [device] = await this.db
      .insert(devices)
      .values({
        ...data,
        id,
        createdAt: now,
      })
      .returning();

    logger.info("[device-repo] Device created", {
      id,
      deviceId: data.deviceId,
      userId: data.userId,
    });

    return device;
  }

  /**
   * 更新设备
   */
  async update(
    deviceId: string,
    data: Partial<
      Pick<
        Device,
        | "displayName"
        | "role"
        | "roles"
        | "scopes"
        | "tokens"
        | "lastActiveAt"
        | "isActive"
        | "revokedAt"
      >
    >,
  ): Promise<Device | null> {
    const [updated] = await this.db
      .update(devices)
      .set(data)
      .where(eq(devices.deviceId, deviceId))
      .returning();

    if (updated) {
      logger.info("[device-repo] Device updated", { deviceId, data });
    }

    return updated ?? null;
  }

  /**
   * 更新设备最后活跃时间
   */
  async updateLastActive(deviceId: string): Promise<void> {
    await this.db
      .update(devices)
      .set({ lastActiveAt: new Date() })
      .where(eq(devices.deviceId, deviceId));
  }

  /**
   * 撤销设备
   */
  async revoke(deviceId: string): Promise<void> {
    await this.db
      .update(devices)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(eq(devices.deviceId, deviceId));

    logger.info("[device-repo] Device revoked", { deviceId });
  }

  /**
   * 删除设备
   */
  async delete(deviceId: string): Promise<void> {
    await this.db.delete(devices).where(eq(devices.deviceId, deviceId));
    logger.info("[device-repo] Device deleted", { deviceId });
  }

  /**
   * 验证设备令牌
   */
  async verifyToken(
    deviceId: string,
    token: string,
    role?: string,
  ): Promise<{ valid: boolean; device?: Device; tokenInfo?: DeviceAuthToken }> {
    const device = await this.findByDeviceId(deviceId);

    if (!device || !device.isActive) {
      return { valid: false };
    }

    if (!device.tokens) {
      return { valid: false };
    }

    // 查找匹配的令牌
    const targetRole = role || device.role || "user";
    const tokenInfo = device.tokens[targetRole];

    if (!tokenInfo || tokenInfo.token !== token) {
      return { valid: false };
    }

    if (tokenInfo.revokedAtMs) {
      return { valid: false };
    }

    // 更新最后使用时间
    const updatedTokens = {
      ...device.tokens,
      [targetRole]: {
        ...tokenInfo,
        lastUsedAtMs: Date.now(),
      },
    };

    await this.update(deviceId, { tokens: updatedTokens, lastActiveAt: new Date() });

    return { valid: true, device, tokenInfo };
  }

  /**
   * 生成或轮换设备令牌
   */
  async ensureToken(
    deviceId: string,
    role: string,
    scopes: string[],
  ): Promise<{ token: string; isNew: boolean }> {
    const device = await this.findByDeviceId(deviceId);

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const now = Date.now();
    const existingToken = device.tokens?.[role];

    if (existingToken && !existingToken.revokedAtMs) {
      return { token: existingToken.token, isNew: false };
    }

    // 生成新令牌
    const newToken = generateDeviceToken();
    const tokenInfo: DeviceAuthToken = {
      token: newToken,
      role,
      scopes,
      createdAtMs: now,
      rotatedAtMs: existingToken ? now : undefined,
    };

    const updatedTokens = {
      ...device.tokens,
      [role]: tokenInfo,
    };

    await this.update(deviceId, { tokens: updatedTokens });

    logger.info("[device-repo] Token generated", { deviceId, role });

    return { token: newToken, isNew: true };
  }

  /**
   * 撤销设备令牌
   */
  async revokeToken(deviceId: string, role: string): Promise<void> {
    const device = await this.findByDeviceId(deviceId);

    if (!device || !device.tokens?.[role]) {
      return;
    }

    const updatedTokens = {
      ...device.tokens,
      [role]: {
        ...device.tokens[role],
        revokedAtMs: Date.now(),
      },
    };

    await this.update(deviceId, { tokens: updatedTokens });

    logger.info("[device-repo] Token revoked", { deviceId, role });
  }
}

/**
 * 设备配对请求仓库类
 */
export class DevicePairingRequestRepository {
  constructor(private db: Database = getDatabase()) {}

  /**
   * 创建配对请求
   */
  async create(
    data: Omit<NewDevicePairingRequest, "id" | "requestId" | "createdAt" | "expiresAt" | "status">,
  ): Promise<DevicePairingRequest> {
    const id = generateId();
    const requestId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAIRING_REQUEST_TTL_MS);

    // 检查是否已有待处理的请求
    const existing = await this.findPendingByDeviceId(data.deviceId);
    if (existing) {
      return existing;
    }

    // 检查是否为重新配对
    const deviceRepo = getDeviceRepository(this.db);
    const existingDevice = await deviceRepo.findByDeviceId(data.deviceId);
    const isRepair = existingDevice !== null;

    const [request] = await this.db
      .insert(devicePairingRequests)
      .values({
        ...data,
        id,
        requestId,
        isRepair,
        status: "pending",
        createdAt: now,
        expiresAt,
      })
      .returning();

    logger.info("[device-pairing-repo] Pairing request created", {
      requestId,
      deviceId: data.deviceId,
      userId: data.userId,
    });

    return request;
  }

  /**
   * 根据请求 ID 查找
   */
  async findByRequestId(requestId: string): Promise<DevicePairingRequest | null> {
    const [request] = await this.db
      .select()
      .from(devicePairingRequests)
      .where(eq(devicePairingRequests.requestId, requestId));
    return request ?? null;
  }

  /**
   * 根据设备 ID 查找待处理的请求
   */
  async findPendingByDeviceId(deviceId: string): Promise<DevicePairingRequest | null> {
    const now = new Date();
    const [request] = await this.db
      .select()
      .from(devicePairingRequests)
      .where(
        and(
          eq(devicePairingRequests.deviceId, deviceId),
          eq(devicePairingRequests.status, "pending"),
          gt(devicePairingRequests.expiresAt, now),
        ),
      );
    return request ?? null;
  }

  /**
   * 查找所有待处理请求 (未过期)
   */
  async findAllPending(): Promise<DevicePairingRequest[]> {
    const now = new Date();
    return this.db
      .select()
      .from(devicePairingRequests)
      .where(
        and(eq(devicePairingRequests.status, "pending"), gt(devicePairingRequests.expiresAt, now)),
      )
      .orderBy(desc(devicePairingRequests.createdAt));
  }

  /**
   * 批准配对请求
   */
  async approve(
    requestId: string,
    approvedBy: string,
    role?: string,
    scopes?: string[],
  ): Promise<Device | null> {
    const request = await this.findByRequestId(requestId);

    if (!request) {
      logger.warn("[device-pairing-repo] Request not found", { requestId });
      return null;
    }

    if (request.status !== "pending") {
      logger.warn("[device-pairing-repo] Request not pending", {
        requestId,
        status: request.status,
      });
      return null;
    }

    if (new Date() > request.expiresAt) {
      logger.warn("[device-pairing-repo] Request expired", { requestId });
      // 标记为过期
      await this.updateStatus(requestId, "expired");
      return null;
    }

    const now = new Date();
    const finalRole = role || request.requestedRole || "user";
    const finalScopes = scopes || request.requestedScopes || [];

    // 创建或更新设备
    const deviceRepo = getDeviceRepository(this.db);
    let device = await deviceRepo.findByDeviceId(request.deviceId);

    if (device) {
      // 更新现有设备
      const newToken = generateDeviceToken();
      const tokens = device.tokens || {};
      tokens[finalRole] = {
        token: newToken,
        role: finalRole,
        scopes: finalScopes,
        createdAtMs: Date.now(),
      };

      device = await deviceRepo.update(request.deviceId, {
        role: finalRole,
        roles: Array.from(new Set([...(device.roles || []), finalRole])),
        scopes: Array.from(new Set([...(device.scopes || []), ...finalScopes])),
        tokens,
        isActive: true,
        revokedAt: null,
      });
    } else {
      // 创建新设备
      const newToken = generateDeviceToken();
      const tokens: Record<string, DeviceAuthToken> = {
        [finalRole]: {
          token: newToken,
          role: finalRole,
          scopes: finalScopes,
          createdAtMs: Date.now(),
        },
      };

      device = await deviceRepo.create({
        deviceId: request.deviceId,
        publicKey: request.publicKey,
        userId: request.userId,
        displayName: request.displayName,
        platform: request.platform,
        clientId: request.clientId,
        clientMode: request.clientMode,
        role: finalRole,
        roles: [finalRole],
        scopes: finalScopes,
        tokens,
        remoteIp: request.remoteIp,
        isActive: true,
        approvedAt: now,
      });
    }

    // 更新请求状态
    await this.db
      .update(devicePairingRequests)
      .set({
        status: "approved",
        approvedBy,
        processedAt: now,
      })
      .where(eq(devicePairingRequests.requestId, requestId));

    logger.info("[device-pairing-repo] Request approved", {
      requestId,
      deviceId: request.deviceId,
      approvedBy,
    });

    return device;
  }

  /**
   * 拒绝配对请求
   */
  async reject(requestId: string, reason?: string): Promise<boolean> {
    const request = await this.findByRequestId(requestId);

    if (!request || request.status !== "pending") {
      return false;
    }

    await this.db
      .update(devicePairingRequests)
      .set({
        status: "rejected",
        reason,
        processedAt: new Date(),
      })
      .where(eq(devicePairingRequests.requestId, requestId));

    logger.info("[device-pairing-repo] Request rejected", { requestId, reason });

    return true;
  }

  /**
   * 更新请求状态
   */
  async updateStatus(requestId: string, status: PairingRequestStatus): Promise<void> {
    await this.db
      .update(devicePairingRequests)
      .set({
        status,
        processedAt: new Date(),
      })
      .where(eq(devicePairingRequests.requestId, requestId));
  }

  /**
   * 清理过期请求
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .update(devicePairingRequests)
      .set({ status: "expired", processedAt: now })
      .where(
        and(eq(devicePairingRequests.status, "pending"), lt(devicePairingRequests.expiresAt, now)),
      )
      .returning();

    if (result.length > 0) {
      logger.info("[device-pairing-repo] Cleaned up expired requests", {
        count: result.length,
      });
    }

    return result.length;
  }
}

// 工厂函数
export function getDeviceRepository(db?: Database): DeviceRepository {
  return new DeviceRepository(db);
}

export function getDevicePairingRequestRepository(db?: Database): DevicePairingRequestRepository {
  return new DevicePairingRequestRepository(db);
}
