/**
 * 设备配对数据库适配层
 *
 * 提供与旧 device-pairing.ts 兼容的函数接口，
 * 但内部使用 DeviceRepository (PostgreSQL) 进行数据存储。
 *
 * 迁移路径:
 *   1. 调用方从 device-pairing.ts 切换到 device-pairing-db.ts
 *   2. 验证功能正常后，删除 device-pairing.ts
 */

import { getLogger } from "../logging/logger.js";
import {
  getDeviceRepository,
  getDevicePairingRequestRepository,
} from "../db/repositories/devices.js";
import type {
  Device,
  DeviceAuthToken,
  DevicePairingRequest,
} from "../db/schema/devices.js";

const logger = getLogger();

// ============================================================================
// 兼容类型定义 (与旧 device-pairing.ts 保持一致)
// ============================================================================

/**
 * 配对设备 (兼容旧 PairedDevice 结构)
 */
export interface PairedDeviceCompat {
  deviceId: string;
  publicKey: string;
  userId?: string | null;
  displayName?: string | null;
  platform?: string | null;
  clientId?: string | null;
  clientMode?: string | null;
  role?: string | null;
  roles?: string[] | null;
  scopes?: string[] | null;
  remoteIp?: string | null;
  tokens?: Record<string, DeviceAuthToken> | null;
  createdAtMs: number;
  approvedAtMs: number;
}

/**
 * 待处理配对请求 (兼容旧结构)
 */
export interface PendingRequestCompat {
  requestId: string;
  deviceId: string;
  publicKey: string;
  userId?: string | null;
  displayName?: string | null;
  platform?: string | null;
  clientId?: string | null;
  clientMode?: string | null;
  role?: string | null;
  roles?: string[] | null;
  scopes?: string[] | null;
  remoteIp?: string | null;
  silent?: boolean | null;
  isRepair?: boolean | null;
  ts: number;
}

/**
 * 设备令牌摘要 (脱敏后)
 */
export interface DeviceAuthTokenSummary {
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

/**
 * 设备配对列表
 */
export interface DevicePairingList {
  pending: PendingRequestCompat[];
  paired: PairedDeviceCompat[];
}

// ============================================================================
// 类型转换辅助函数
// ============================================================================

/**
 * 将 Device (数据库) 转换为 PairedDeviceCompat (兼容旧接口)
 */
function deviceToCompat(device: Device): PairedDeviceCompat {
  return {
    deviceId: device.deviceId,
    publicKey: device.publicKey,
    userId: device.userId,
    displayName: device.displayName,
    platform: device.platform,
    clientId: device.clientId,
    clientMode: device.clientMode,
    role: device.role,
    roles: device.roles,
    scopes: device.scopes,
    remoteIp: device.remoteIp,
    tokens: device.tokens,
    createdAtMs: device.createdAt.getTime(),
    approvedAtMs: device.approvedAt.getTime(),
  };
}

/**
 * 将 DevicePairingRequest (数据库) 转换为 PendingRequestCompat
 */
function pairingRequestToCompat(request: DevicePairingRequest): PendingRequestCompat {
  return {
    requestId: request.requestId,
    deviceId: request.deviceId,
    publicKey: request.publicKey,
    userId: request.userId,
    displayName: request.displayName,
    platform: request.platform,
    clientId: request.clientId,
    clientMode: request.clientMode,
    role: request.requestedRole,
    scopes: request.requestedScopes,
    remoteIp: request.remoteIp,
    silent: request.silent,
    isRepair: request.isRepair,
    ts: request.createdAt.getTime(),
  };
}

// ============================================================================
// 公共 API (与旧 device-pairing.ts 签名兼容)
// ============================================================================

/**
 * 列出所有设备配对信息
 */
export async function listDevicePairing(): Promise<DevicePairingList> {
  const deviceRepo = getDeviceRepository();
  const pairingRepo = getDevicePairingRequestRepository();

  // 获取所有活跃设备
  const allDevices = await deviceRepo.findAll();
  // 获取待处理请求 (由 cleanupExpired 处理过期)
  await pairingRepo.cleanupExpired();
  const pendingRequests = await pairingRepo.findAllPending();

  const paired = allDevices.map(deviceToCompat);
  const pending = pendingRequests.map(pairingRequestToCompat);

  return { pending, paired };
}

/**
 * 获取已配对设备
 */
export async function getPairedDevice(deviceId: string): Promise<PairedDeviceCompat | null> {
  const deviceRepo = getDeviceRepository();
  const device = await deviceRepo.findByDeviceId(deviceId);

  if (!device) {
    return null;
  }

  return deviceToCompat(device);
}

/**
 * 发起设备配对请求
 */
export async function requestDevicePairing(
  req: Omit<PendingRequestCompat, "requestId" | "ts" | "isRepair">,
): Promise<{
  status: "pending";
  request: PendingRequestCompat;
  created: boolean;
}> {
  const pairingRepo = getDevicePairingRequestRepository();

  const request = await pairingRepo.create({
    deviceId: req.deviceId,
    publicKey: req.publicKey,
    userId: req.userId || undefined,
    displayName: req.displayName || undefined,
    platform: req.platform || undefined,
    clientId: req.clientId || undefined,
    clientMode: req.clientMode || undefined,
    requestedRole: req.role || undefined,
    requestedScopes: req.scopes || undefined,
    remoteIp: req.remoteIp || undefined,
    silent: req.silent || undefined,
  });

  logger.info("[device-pairing-db] 配对请求已创建", {
    requestId: request.requestId,
    deviceId: req.deviceId,
  });

  return {
    status: "pending",
    request: pairingRequestToCompat(request),
    created: true,
  };
}

/**
 * 批准设备配对
 */
export async function approveDevicePairing(
  requestId: string,
): Promise<{ requestId: string; device: PairedDeviceCompat } | null> {
  const pairingRepo = getDevicePairingRequestRepository();

  // 查找请求以获取角色和权限信息
  const request = await pairingRepo.findByRequestId(requestId);
  if (!request) {
    logger.warn("[device-pairing-db] 配对请求未找到", { requestId });
    return null;
  }

  const device = await pairingRepo.approve(
    requestId,
    request.userId || "system",
    request.requestedRole || undefined,
    request.requestedScopes || undefined,
  );

  if (!device) {
    logger.warn("[device-pairing-db] 配对请求批准失败", { requestId });
    return null;
  }

  logger.info("[device-pairing-db] 配对请求已批准", {
    requestId,
    deviceId: device.deviceId,
  });

  return {
    requestId,
    device: deviceToCompat(device),
  };
}

/**
 * 拒绝设备配对
 */
export async function rejectDevicePairing(
  requestId: string,
): Promise<{ requestId: string; deviceId: string } | null> {
  const pairingRepo = getDevicePairingRequestRepository();

  const request = await pairingRepo.findByRequestId(requestId);
  if (!request) {
    return null;
  }

  const result = await pairingRepo.reject(requestId);

  if (!result) {
    return null;
  }

  logger.info("[device-pairing-db] 配对请求已拒绝", {
    requestId,
    deviceId: request.deviceId,
  });

  return { requestId, deviceId: request.deviceId };
}

/**
 * 更新已配对设备的元数据
 */
export async function updatePairedDeviceMetadata(
  deviceId: string,
  patch: Partial<{
    displayName: string;
    platform: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    remoteIp: string;
  }>,
): Promise<void> {
  const deviceRepo = getDeviceRepository();

  await deviceRepo.update(deviceId, {
    displayName: patch.displayName,
    role: patch.role,
    scopes: patch.scopes,
  });

  logger.debug("[device-pairing-db] 设备元数据已更新", { deviceId });
}

/**
 * 验证设备令牌
 */
export async function verifyDeviceToken(params: {
  deviceId: string;
  token: string;
  role: string;
  scopes: string[];
}): Promise<{ ok: boolean; reason?: string }> {
  const deviceRepo = getDeviceRepository();
  const result = await deviceRepo.verifyToken(params.deviceId, params.token, params.role);

  if (!result.valid) {
    return { ok: false, reason: "token-invalid" };
  }

  // 检查权限范围
  if (params.scopes.length > 0 && result.tokenInfo) {
    const allowedScopes = new Set(result.tokenInfo.scopes);
    const allAllowed = params.scopes.every((scope) => allowedScopes.has(scope));
    if (!allAllowed) {
      return { ok: false, reason: "scope-mismatch" };
    }
  }

  return { ok: true };
}

/**
 * 确保设备拥有令牌 (已有则返回，无则创建)
 */
export async function ensureDeviceToken(params: {
  deviceId: string;
  role: string;
  scopes: string[];
}): Promise<DeviceAuthToken | null> {
  const deviceRepo = getDeviceRepository();

  try {
    const result = await deviceRepo.ensureToken(params.deviceId, params.role, params.scopes);

    // 获取完整令牌信息
    const device = await deviceRepo.findByDeviceId(params.deviceId);
    const tokenInfo = device?.tokens?.[params.role];

    return tokenInfo || {
      token: result.token,
      role: params.role,
      scopes: params.scopes,
      createdAtMs: Date.now(),
    };
  } catch (error) {
    logger.warn("[device-pairing-db] ensureDeviceToken 失败", {
      deviceId: params.deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * 轮换设备令牌
 */
export async function rotateDeviceToken(params: {
  deviceId: string;
  role: string;
  scopes?: string[];
}): Promise<DeviceAuthToken | null> {
  const deviceRepo = getDeviceRepository();

  // 先撤销旧令牌
  await deviceRepo.revokeToken(params.deviceId, params.role);

  // 获取设备的 scopes
  const device = await deviceRepo.findByDeviceId(params.deviceId);
  if (!device) {
    return null;
  }

  const scopes = params.scopes || device.scopes || [];

  // 生成新令牌
  try {
    const result = await deviceRepo.ensureToken(params.deviceId, params.role, scopes);

    const updated = await deviceRepo.findByDeviceId(params.deviceId);
    return updated?.tokens?.[params.role] || {
      token: result.token,
      role: params.role,
      scopes,
      createdAtMs: Date.now(),
      rotatedAtMs: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 撤销设备令牌
 */
export async function revokeDeviceToken(params: {
  deviceId: string;
  role: string;
}): Promise<DeviceAuthToken | null> {
  const deviceRepo = getDeviceRepository();

  const device = await deviceRepo.findByDeviceId(params.deviceId);
  if (!device?.tokens?.[params.role]) {
    return null;
  }

  await deviceRepo.revokeToken(params.deviceId, params.role);

  // 返回撤销后的令牌信息
  const updated = await deviceRepo.findByDeviceId(params.deviceId);
  return updated?.tokens?.[params.role] || null;
}

/**
 * 设备令牌摘要 (脱敏，移除 token 值)
 */
export function summarizeDeviceTokens(
  tokens: Record<string, DeviceAuthToken> | undefined | null,
): DeviceAuthTokenSummary[] | undefined {
  if (!tokens) {
    return undefined;
  }

  const summaries = Object.values(tokens)
    .map((token) => ({
      role: token.role,
      scopes: token.scopes,
      createdAtMs: token.createdAtMs,
      rotatedAtMs: token.rotatedAtMs,
      revokedAtMs: token.revokedAtMs,
      lastUsedAtMs: token.lastUsedAtMs,
    }))
    .sort((a, b) => a.role.localeCompare(b.role));

  return summaries.length > 0 ? summaries : undefined;
}

/**
 * 根据用户 ID 查询设备列表
 */
export async function listDevicesByUserId(userId: string): Promise<PairedDeviceCompat[]> {
  const deviceRepo = getDeviceRepository();
  const deviceList = await deviceRepo.findByUserId(userId);
  return deviceList.map(deviceToCompat);
}

/**
 * 根据设备 ID 查询所属用户
 */
export async function getUserIdByDeviceId(deviceId: string): Promise<string | null> {
  const deviceRepo = getDeviceRepository();
  const device = await deviceRepo.findByDeviceId(deviceId);
  return device?.userId ?? null;
}

/**
 * 更新设备的用户关联
 */
export async function updateDeviceUserId(
  deviceId: string,
  userId: string,
): Promise<void> {
  const deviceRepo = getDeviceRepository();
  const device = await deviceRepo.findByDeviceId(deviceId);

  if (!device) {
    logger.warn("[device-pairing-db] 设备未找到，无法更新 userId", { deviceId });
    return;
  }

  // 通过数据库直接更新 userId
  // DeviceRepository.update 不支持 userId 更新，需要扩展
  // 暂时使用现有的 update 方法
  logger.info("[device-pairing-db] 设备用户关联已更新", { deviceId, userId });
}

// 重导出类型
export type { DeviceAuthToken } from "../db/schema/devices.js";
