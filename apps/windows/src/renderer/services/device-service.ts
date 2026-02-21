/**
 * 设备管理服务
 *
 * 封装设备绑定、配对、管理相关的 API 调用
 */

/**
 * 设备信息
 */
export interface Device {
  deviceId: string
  userId: string
  alias?: string
  isPrimary: boolean
  linkedAt: string
  lastActiveAt?: string
  displayName?: string
  platform?: string
  role?: string
  scopes: string[]
}

/**
 * 设备配对请求
 */
export interface DevicePairRequest {
  requestId: string
  status: 'pending' | 'approved' | 'rejected'
  expiresAt: string
}

/**
 * 设备配对结果
 */
export interface DevicePairResult {
  device: Device
  deviceToken: string
}

/**
 * 设备管理服务
 */
export class DeviceService {
  private baseUrl: string
  private accessToken: string | null = null

  constructor(baseUrl = 'http://127.0.0.1:3000') {
    this.baseUrl = baseUrl
  }

  /**
   * 设置访问令牌
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  /**
   * 获取认证头（含 Content-Type）
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }
    return headers
  }

  /**
   * 获取仅含认证信息的请求头（不含 Content-Type，用于无 body 的请求如 DELETE）
   */
  private getAuthOnlyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }
    return headers
  }

  /**
   * 获取当前用户的设备列表
   */
  async getDevices(): Promise<{ success: boolean; devices?: Device[]; error?: string }> {
    console.log('[device-service] 获取设备列表')
    console.log('[device-service] accessToken:', this.accessToken ? `${this.accessToken.substring(0, 20)}...` : '无')

    try {
      const headers = this.getAuthOnlyHeaders()
      console.log('[device-service] 请求头:', headers)

      const response = await fetch(`${this.baseUrl}/api/devices`, {
        method: 'GET',
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[device-service] 响应错误:', { status: response.status, data })
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        devices: data.data?.devices || [],
      }
    } catch (error) {
      console.error('[device-service] 获取设备列表失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      }
    }
  }

  /**
   * 发起设备配对请求
   */
  async requestPairing(params: {
    deviceId: string
    publicKey: string
    displayName?: string
    platform?: string
  }): Promise<{ success: boolean; request?: DevicePairRequest; error?: string }> {
    console.log('[device-service] 发起设备配对请求', { deviceId: params.deviceId })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/pair-request`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          deviceId: params.deviceId,
          publicKey: params.publicKey,
          displayName: params.displayName,
          platform: params.platform,
          role: 'user',
          scopes: ['user.basic'],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        request: data.data,
      }
    } catch (error) {
      console.error('[device-service] 发起配对请求失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '请求失败',
      }
    }
  }

  /**
   * 批准设备配对
   */
  async approvePairing(requestId: string): Promise<{
    success: boolean
    result?: DevicePairResult
    error?: string
  }> {
    console.log('[device-service] 批准设备配对', { requestId })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/pair-approve`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ requestId }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        result: data.data,
      }
    } catch (error) {
      console.error('[device-service] 批准配对失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '批准失败',
      }
    }
  }

  /**
   * 拒绝设备配对
   */
  async rejectPairing(requestId: string, reason?: string): Promise<{
    success: boolean
    error?: string
  }> {
    console.log('[device-service] 拒绝设备配对', { requestId })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/pair-reject`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ requestId, reason }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[device-service] 拒绝配对失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '拒绝失败',
      }
    }
  }

  /**
   * 更新设备信息
   */
  async updateDevice(
    deviceId: string,
    updates: { alias?: string; isPrimary?: boolean }
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    console.log('[device-service] 更新设备信息', { deviceId, updates })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        device: data.data?.device,
      }
    } catch (error) {
      console.error('[device-service] 更新设备失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新失败',
      }
    }
  }

  /**
   * 删除设备
   */
  async deleteDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
    console.log('[device-service] 删除设备', { deviceId })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: this.getAuthOnlyHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[device-service] 删除设备失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      }
    }
  }
  /**
   * 获取设备的 Gateway 连接 Token
   */
  async getDeviceToken(deviceId: string): Promise<{
    success: boolean
    data?: { deviceId: string; token: string; role: string; scopes: string[] }
    error?: string
  }> {
    console.log('[device-service] 获取设备 Token', { deviceId })

    try {
      const response = await fetch(`${this.baseUrl}/api/devices/${deviceId}/token`, {
        method: 'GET',
        headers: this.getAuthOnlyHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[device-service] 获取设备 Token 失败:', { status: response.status, data })
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      }

      console.log('[device-service] 设备 Token 获取成功')
      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error('[device-service] 获取设备 Token 请求失败', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      }
    }
  }
}

// 导出单例
export const deviceService = new DeviceService()
