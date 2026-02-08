/**
 * 设备平台
 */
export type DevicePlatform = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

/**
 * 设备角色
 */
export type DeviceRole = 'owner' | 'member' | 'guest'

/**
 * 设备状态
 */
export type DeviceStatus = 'online' | 'offline'

/**
 * 设备类型
 */
export interface Device {
  id: string
  displayName: string
  platform: DevicePlatform
  platformVersion?: string
  appVersion?: string
  role: DeviceRole
  scopes: string[]
  status: DeviceStatus
  lastActiveAt: string
  linkedAt: string
}

/**
 * 设备列表项
 */
export interface DeviceListItem {
  id: string
  displayName: string
  platform: DevicePlatform
  role: DeviceRole
  scopes: string[]
  status: DeviceStatus
  lastActiveAt: string
  linkedAt: string
}

/**
 * 设备详情
 */
export interface DeviceDetail extends Device {
  // 设备详情可扩展的额外字段
}
