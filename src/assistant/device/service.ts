/**
 * 设备服务
 *
 * 整合用户设备关联和现有 device-pairing 系统
 * 职责分离：用户管身份，设备管权限
 */

import { getLogger } from "../../shared/logging/logger.js";
import {
  getUserDeviceRepository,
  getUserRepository,
  getSubscriptionRepository,
  getPlanRepository,
  type UserDevice,
} from "../../db/index.js";
import { getPairedDevice, type PairedDevice } from "../../infra/device-pairing.js";
import { audit } from "../../db/index.js";
import type {
  DeviceInfo,
  UserDeviceInfo,
  LinkDeviceRequest,
  UnlinkDeviceRequest,
  DeviceOperationResult,
  DeviceQuotaInfo,
  DeviceListResult,
} from "./types.js";

const logger = getLogger();

/**
 * 默认设备配额配置 (当没有订阅或套餐未找到时使用)
 */
const DEFAULT_DEVICE_QUOTA = {
  /** 免费用户最大设备数 */
  free: 2,
  /** 基础版最大设备数 */
  basic: 3,
  /** 专业版最大设备数 */
  pro: 5,
  /** 企业版最大设备数 */
  enterprise: 10,
};

/**
 * 将 PairedDevice 转换为 DeviceInfo
 */
function pairedDeviceToDeviceInfo(device: PairedDevice): DeviceInfo {
  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    platform: device.platform,
    clientId: device.clientId,
    clientMode: device.clientMode,
    role: device.role,
    scopes: device.scopes,
    remoteIp: device.remoteIp,
    createdAtMs: device.createdAtMs,
    approvedAtMs: device.approvedAtMs,
  };
}

/**
 * 将 UserDevice 转换为 UserDeviceInfo
 */
async function userDeviceToUserDeviceInfo(
  userDevice: UserDevice,
  deviceInfo?: DeviceInfo,
): Promise<UserDeviceInfo> {
  return {
    id: userDevice.id,
    userId: userDevice.userId,
    deviceId: userDevice.deviceId,
    alias: userDevice.alias ?? undefined,
    isPrimary: userDevice.isPrimary,
    linkedAt: userDevice.linkedAt,
    lastActiveAt: userDevice.lastActiveAt ?? undefined,
    deviceInfo,
  };
}

/**
 * 获取用户订阅计划对应的设备配额
 *
 * 优先从用户当前订阅的套餐中获取 maxDevices
 * 如果没有有效订阅，返回免费版配额
 */
async function getDeviceQuotaForUser(userId: string): Promise<number> {
  const subscriptionRepo = getSubscriptionRepository();
  const planRepo = getPlanRepository();

  try {
    // 获取用户当前有效订阅
    const subscription = await subscriptionRepo.findActiveByUserId(userId);
    if (!subscription) {
      logger.debug("[device-service] No active subscription, using free quota", {
        userId,
      });
      return DEFAULT_DEVICE_QUOTA.free;
    }

    // 获取套餐信息
    const plan = await planRepo.findById(subscription.planId);
    if (!plan) {
      logger.warn("[device-service] Plan not found for subscription", {
        userId,
        planId: subscription.planId,
      });
      return DEFAULT_DEVICE_QUOTA.free;
    }

    // 返回套餐的设备配额
    logger.debug("[device-service] Using plan device quota", {
      userId,
      planCode: plan.code,
      maxDevices: plan.maxDevices,
    });
    return plan.maxDevices;
  } catch (error) {
    logger.error("[device-service] Error getting device quota from subscription", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // 出错时返回免费版配额
    return DEFAULT_DEVICE_QUOTA.free;
  }
}

/**
 * 获取设备配额信息
 */
export async function getDeviceQuota(userId: string): Promise<DeviceQuotaInfo> {
  const deviceRepo = getUserDeviceRepository();
  const devices = await deviceRepo.findByUserId(userId);
  const maxDevices = await getDeviceQuotaForUser(userId);

  return {
    currentCount: devices.length,
    maxDevices,
    canLinkMore: devices.length < maxDevices,
  };
}

/**
 * 检查设备是否已配对
 */
export async function checkDevicePaired(deviceId: string): Promise<boolean> {
  const pairedDevice = await getPairedDevice(deviceId);
  return pairedDevice !== null;
}

/**
 * 获取设备详细信息
 */
export async function getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
  const pairedDevice = await getPairedDevice(deviceId);
  if (!pairedDevice) {
    return null;
  }
  return pairedDeviceToDeviceInfo(pairedDevice);
}

/**
 * 绑定设备到用户
 *
 * 前置条件：
 * 1. 设备必须已经通过 device-pairing 配对
 * 2. 用户必须存在且激活
 * 3. 设备配额未满
 * 4. 设备未被其他用户绑定
 */
export async function linkDevice(request: LinkDeviceRequest): Promise<DeviceOperationResult> {
  const userRepo = getUserRepository();
  const deviceRepo = getUserDeviceRepository();

  const { userId, deviceId, alias, setAsPrimary, ipAddress, userAgent } = request;

  try {
    // 1. 检查用户是否存在
    const user = await userRepo.findById(userId);
    if (!user) {
      logger.warn("[device-service] Link failed: user not found", { userId });
      return {
        success: false,
        error: "用户不存在",
        errorCode: "USER_NOT_FOUND",
      };
    }

    if (!user.isActive) {
      logger.warn("[device-service] Link failed: user inactive", { userId });
      return {
        success: false,
        error: "用户账户已停用",
        errorCode: "USER_INACTIVE",
      };
    }

    // 2. 检查设备是否已配对
    const pairedDevice = await getPairedDevice(deviceId);
    if (!pairedDevice) {
      logger.warn("[device-service] Link failed: device not paired", {
        userId,
        deviceId,
      });
      return {
        success: false,
        error: "设备未配对，请先完成设备配对",
        errorCode: "DEVICE_NOT_PAIRED",
      };
    }

    // 3. 检查设备是否已被其他用户绑定
    const existingLink = await deviceRepo.findByDeviceId(deviceId);
    if (existingLink && existingLink.userId !== userId) {
      logger.warn("[device-service] Link failed: device already linked", {
        userId,
        deviceId,
        existingUserId: existingLink.userId,
      });
      return {
        success: false,
        error: "设备已被其他用户绑定",
        errorCode: "DEVICE_ALREADY_LINKED",
      };
    }

    // 如果已经绑定到同一用户，直接返回成功
    if (existingLink && existingLink.userId === userId) {
      const deviceInfo = pairedDeviceToDeviceInfo(pairedDevice);
      const userDeviceInfo = await userDeviceToUserDeviceInfo(existingLink, deviceInfo);

      logger.debug("[device-service] Device already linked to user", {
        userId,
        deviceId,
      });

      return {
        success: true,
        device: userDeviceInfo,
      };
    }

    // 4. 检查设备配额
    const quota = await getDeviceQuota(userId);
    if (!quota.canLinkMore) {
      logger.warn("[device-service] Link failed: quota exceeded", {
        userId,
        currentCount: quota.currentCount,
        maxDevices: quota.maxDevices,
      });
      return {
        success: false,
        error: `设备数量已达上限 (${quota.maxDevices})，请升级订阅或解绑其他设备`,
        errorCode: "DEVICE_QUOTA_EXCEEDED",
      };
    }

    // 5. 创建关联
    const userDevice = await deviceRepo.linkDevice(userId, deviceId, {
      alias,
      isPrimary: setAsPrimary,
    });

    // 6. 如果设置为主设备
    if (setAsPrimary) {
      await deviceRepo.setPrimaryDevice(userId, deviceId);
    }

    // 7. 记录审计日志
    await audit({
      userId,
      category: "device",
      action: "device.linked",
      ipAddress,
      userAgent,
      result: "success",
      details: {
        deviceId,
        platform: pairedDevice.platform,
        alias,
        isPrimary: setAsPrimary,
      },
    });

    logger.info("[device-service] Device linked successfully", {
      userId,
      deviceId,
      alias,
    });

    const deviceInfo = pairedDeviceToDeviceInfo(pairedDevice);
    const userDeviceInfo = await userDeviceToUserDeviceInfo(userDevice, deviceInfo);

    return {
      success: true,
      device: userDeviceInfo,
    };
  } catch (error) {
    logger.error("[device-service] Link error", {
      userId,
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await audit({
      userId,
      category: "device",
      action: "device.linked",
      ipAddress,
      userAgent,
      result: "failure",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      riskLevel: "medium",
    });

    return {
      success: false,
      error: "绑定设备失败，请稍后重试",
      errorCode: "LINK_ERROR",
    };
  }
}

/**
 * 解绑设备
 */
export async function unlinkDevice(request: UnlinkDeviceRequest): Promise<DeviceOperationResult> {
  const userRepo = getUserRepository();
  const deviceRepo = getUserDeviceRepository();

  const { userId, deviceId, ipAddress, userAgent } = request;

  try {
    // 1. 检查用户是否存在
    const user = await userRepo.findById(userId);
    if (!user) {
      logger.warn("[device-service] Unlink failed: user not found", { userId });
      return {
        success: false,
        error: "用户不存在",
        errorCode: "USER_NOT_FOUND",
      };
    }

    // 2. 检查设备关联是否存在
    const existingLink = await deviceRepo.findByDeviceId(deviceId);
    if (!existingLink) {
      logger.warn("[device-service] Unlink failed: device not linked", {
        userId,
        deviceId,
      });
      return {
        success: false,
        error: "设备未绑定",
        errorCode: "DEVICE_NOT_LINKED",
      };
    }

    // 3. 检查是否是该用户的设备
    if (existingLink.userId !== userId) {
      logger.warn("[device-service] Unlink failed: device belongs to other user", {
        userId,
        deviceId,
        actualUserId: existingLink.userId,
      });
      return {
        success: false,
        error: "无权操作此设备",
        errorCode: "PERMISSION_DENIED",
      };
    }

    // 4. 获取设备信息用于返回
    const pairedDevice = await getPairedDevice(deviceId);
    const deviceInfo = pairedDevice ? pairedDeviceToDeviceInfo(pairedDevice) : undefined;
    const userDeviceInfo = await userDeviceToUserDeviceInfo(existingLink, deviceInfo);

    // 5. 删除关联
    await deviceRepo.unlinkDevice(userId, deviceId);

    // 6. 记录审计日志
    await audit({
      userId,
      category: "device",
      action: "device.unlinked",
      ipAddress,
      userAgent,
      result: "success",
      riskLevel: "medium",
      details: {
        deviceId,
        platform: pairedDevice?.platform,
        wasPrimary: existingLink.isPrimary,
      },
    });

    logger.info("[device-service] Device unlinked successfully", {
      userId,
      deviceId,
    });

    return {
      success: true,
      device: userDeviceInfo,
    };
  } catch (error) {
    logger.error("[device-service] Unlink error", {
      userId,
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await audit({
      userId,
      category: "device",
      action: "device.unlinked",
      ipAddress,
      userAgent,
      result: "failure",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      riskLevel: "high",
    });

    return {
      success: false,
      error: "解绑设备失败，请稍后重试",
      errorCode: "UNLINK_ERROR",
    };
  }
}

/**
 * 获取用户的设备列表
 */
export async function listUserDevices(userId: string): Promise<DeviceListResult> {
  const deviceRepo = getUserDeviceRepository();

  try {
    const userDevices = await deviceRepo.findByUserId(userId);
    const quota = await getDeviceQuota(userId);

    // 获取每个设备的详细信息
    const devicesWithInfo: UserDeviceInfo[] = [];
    for (const ud of userDevices) {
      const pairedDevice = await getPairedDevice(ud.deviceId);
      const deviceInfo = pairedDevice ? pairedDeviceToDeviceInfo(pairedDevice) : undefined;
      devicesWithInfo.push(await userDeviceToUserDeviceInfo(ud, deviceInfo));
    }

    return {
      success: true,
      devices: devicesWithInfo,
      quota,
    };
  } catch (error) {
    logger.error("[device-service] List devices error", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: true,
      devices: [],
      quota: {
        currentCount: 0,
        maxDevices: DEFAULT_DEVICE_QUOTA.free,
        canLinkMore: true,
      },
    };
  }
}

/**
 * 更新设备别名
 */
export async function updateDeviceAlias(
  userId: string,
  deviceId: string,
  alias: string,
): Promise<DeviceOperationResult> {
  const deviceRepo = getUserDeviceRepository();

  try {
    const existingLink = await deviceRepo.findByDeviceId(deviceId);
    if (!existingLink || existingLink.userId !== userId) {
      return {
        success: false,
        error: "设备未绑定或无权操作",
        errorCode: "DEVICE_NOT_FOUND",
      };
    }

    // 更新别名 - 需要扩展 repository
    // TODO: 添加 updateAlias 方法到 UserDeviceRepository

    logger.info("[device-service] Device alias updated", {
      userId,
      deviceId,
      alias,
    });

    const pairedDevice = await getPairedDevice(deviceId);
    const deviceInfo = pairedDevice ? pairedDeviceToDeviceInfo(pairedDevice) : undefined;

    return {
      success: true,
      device: await userDeviceToUserDeviceInfo({ ...existingLink, alias }, deviceInfo),
    };
  } catch (error) {
    logger.error("[device-service] Update alias error", {
      userId,
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: "更新设备别名失败",
      errorCode: "UPDATE_ERROR",
    };
  }
}

/**
 * 设置主设备
 */
export async function setPrimaryDevice(
  userId: string,
  deviceId: string,
): Promise<DeviceOperationResult> {
  const deviceRepo = getUserDeviceRepository();

  try {
    const existingLink = await deviceRepo.findByDeviceId(deviceId);
    if (!existingLink || existingLink.userId !== userId) {
      return {
        success: false,
        error: "设备未绑定或无权操作",
        errorCode: "DEVICE_NOT_FOUND",
      };
    }

    await deviceRepo.setPrimaryDevice(userId, deviceId);

    logger.info("[device-service] Primary device set", {
      userId,
      deviceId,
    });

    const pairedDevice = await getPairedDevice(deviceId);
    const deviceInfo = pairedDevice ? pairedDeviceToDeviceInfo(pairedDevice) : undefined;

    return {
      success: true,
      device: await userDeviceToUserDeviceInfo({ ...existingLink, isPrimary: true }, deviceInfo),
    };
  } catch (error) {
    logger.error("[device-service] Set primary error", {
      userId,
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: "设置主设备失败",
      errorCode: "UPDATE_ERROR",
    };
  }
}

/**
 * 更新设备最后活跃时间
 */
export async function updateDeviceActivity(userId: string, deviceId: string): Promise<void> {
  const deviceRepo = getUserDeviceRepository();

  try {
    await deviceRepo.updateLastActive(userId, deviceId);
  } catch (error) {
    logger.debug("[device-service] Update activity error", {
      userId,
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // 不抛出错误，活跃时间更新失败不影响主流程
  }
}

/**
 * 根据设备 ID 获取关联的用户 ID
 */
export async function getUserIdByDeviceId(deviceId: string): Promise<string | null> {
  const deviceRepo = getUserDeviceRepository();

  try {
    const link = await deviceRepo.findByDeviceId(deviceId);
    return link?.userId ?? null;
  } catch (error) {
    logger.error("[device-service] Get user by device error", {
      deviceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
