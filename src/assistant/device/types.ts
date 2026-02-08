/**
 * 设备服务类型定义
 *
 * 整合用户设备关联和现有 device-pairing 系统
 */

/**
 * 设备信息 (来自 device-pairing.ts)
 */
export interface DeviceInfo {
  /** 设备 ID */
  deviceId: string;
  /** 设备显示名称 */
  displayName?: string;
  /** 平台 (windows, macos, linux) */
  platform?: string;
  /** 客户端 ID */
  clientId?: string;
  /** 客户端模式 */
  clientMode?: string;
  /** 角色 */
  role?: string;
  /** 权限范围 */
  scopes?: string[];
  /** 远程 IP */
  remoteIp?: string;
  /** 创建时间 */
  createdAtMs: number;
  /** 批准时间 */
  approvedAtMs: number;
}

/**
 * 用户设备关联信息
 */
export interface UserDeviceInfo {
  /** 关联 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 设备 ID */
  deviceId: string;
  /** 设备别名 (用户自定义) */
  alias?: string;
  /** 是否为主设备 */
  isPrimary: boolean;
  /** 关联时间 */
  linkedAt: Date;
  /** 最后活跃时间 */
  lastActiveAt?: Date;
  /** 设备详细信息 (来自 device-pairing) */
  deviceInfo?: DeviceInfo;
}

/**
 * 绑定设备请求
 */
export interface LinkDeviceRequest {
  /** 用户 ID */
  userId: string;
  /** 设备 ID */
  deviceId: string;
  /** 设备别名 */
  alias?: string;
  /** 是否设为主设备 */
  setAsPrimary?: boolean;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 解绑设备请求
 */
export interface UnlinkDeviceRequest {
  /** 用户 ID */
  userId: string;
  /** 设备 ID */
  deviceId: string;
  /** 客户端 IP */
  ipAddress?: string;
  /** User Agent */
  userAgent?: string;
}

/**
 * 设备操作结果
 */
export interface DeviceOperationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  device?: UserDeviceInfo;
}

/**
 * 设备配额信息
 */
export interface DeviceQuotaInfo {
  /** 当前绑定设备数 */
  currentCount: number;
  /** 最大允许设备数 */
  maxDevices: number;
  /** 是否可以绑定更多设备 */
  canLinkMore: boolean;
}

/**
 * 设备列表结果
 */
export interface DeviceListResult {
  success: boolean;
  devices: UserDeviceInfo[];
  quota: DeviceQuotaInfo;
}
