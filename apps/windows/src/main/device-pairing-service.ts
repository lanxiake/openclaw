/**
 * DevicePairingService - 设备配对服务
 *
 * 负责 Windows 客户端与 Gateway 的配对流程
 * 包括：设备注册、配对请求、Token 管理
 */

import { randomUUID } from 'crypto'
import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import os from 'os'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[DevicePairing]', ...args),
  error: (...args: unknown[]) => console.error('[DevicePairing]', ...args),
  warn: (...args: unknown[]) => console.warn('[DevicePairing]', ...args),
  debug: (...args: unknown[]) => console.log('[DevicePairing:Debug]', ...args),
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备唯一标识 */
  deviceId: string
  /** 设备名称 */
  displayName: string
  /** 平台 */
  platform: string
  /** 客户端 ID */
  clientId: string
  /** 客户端模式 */
  clientMode: string
  /** 创建时间 */
  createdAt: number
}

/**
 * 配对状态
 */
export interface PairingState {
  /** 设备信息 */
  device: DeviceInfo
  /** 配对状态 */
  status: 'unpaired' | 'pending' | 'paired'
  /** Gateway URL */
  gatewayUrl?: string
  /** 认证 Token */
  token?: string
  /** 请求 ID (配对中) */
  requestId?: string
  /** 配对时间 */
  pairedAt?: number
}

/**
 * 配对结果
 */
export interface PairingResult {
  success: boolean
  message: string
  token?: string
}

/**
 * 设备配对服务类
 */
export class DevicePairingService {
  private state: PairingState | null = null
  private configPath: string

  constructor() {
    // 配置文件存储在用户数据目录
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'device-pairing.json')
  }

  /**
   * 初始化服务
   * 加载或创建设备信息
   */
  async initialize(): Promise<DeviceInfo> {
    log.info('初始化设备配对服务')

    try {
      // 尝试加载现有配置
      const existing = await this.loadState()
      if (existing) {
        this.state = existing
        log.info(`已加载设备信息: ${existing.device.deviceId}`)
        return existing.device
      }
    } catch (error) {
      log.warn('加载配置失败，将创建新设备:', error)
    }

    // 创建新设备
    const device = this.createDeviceInfo()
    this.state = {
      device,
      status: 'unpaired',
    }

    await this.saveState()
    log.info(`已创建新设备: ${device.deviceId}`)
    return device
  }

  /**
   * 创建设备信息
   */
  private createDeviceInfo(): DeviceInfo {
    const hostname = os.hostname()
    const platform = `${os.platform()} ${os.release()}`

    return {
      deviceId: randomUUID(),
      displayName: `${hostname} - OpenClaw Assistant`,
      platform,
      clientId: 'openclaw-windows',
      clientMode: 'assistant',
      createdAt: Date.now(),
    }
  }

  /**
   * 获取当前设备信息
   */
  getDevice(): DeviceInfo | null {
    return this.state?.device ?? null
  }

  /**
   * 获取配对状态
   */
  getPairingStatus(): PairingState | null {
    return this.state
  }

  /**
   * 检查是否已配对
   */
  isPaired(): boolean {
    return this.state?.status === 'paired' && !!this.state.token
  }

  /**
   * 获取认证 Token
   */
  getToken(): string | undefined {
    return this.state?.token
  }

  /**
   * 获取 Gateway URL
   */
  getGatewayUrl(): string | undefined {
    return this.state?.gatewayUrl
  }

  /**
   * 发起配对请求
   * 通过 Gateway RPC 发送配对请求
   *
   * @param gatewayUrl Gateway WebSocket URL
   * @param gatewayCall 调用 Gateway RPC 的函数
   */
  async requestPairing(
    gatewayUrl: string,
    gatewayCall: <T>(method: string, params?: unknown) => Promise<T>
  ): Promise<{ requestId: string; status: 'pending' }> {
    if (!this.state) {
      throw new Error('设备未初始化')
    }

    log.info(`请求配对到 Gateway: ${gatewayUrl}`)

    const device = this.state.device

    try {
      // 调用 Gateway 的配对请求方法
      const result = await gatewayCall<{
        status: 'pending'
        request: {
          requestId: string
          deviceId: string
        }
      }>('device.requestPairing', {
        deviceId: device.deviceId,
        displayName: device.displayName,
        platform: device.platform,
        clientId: device.clientId,
        clientMode: device.clientMode,
        publicKey: '', // Windows 客户端暂不使用公钥加密
      })

      // 更新状态为配对中
      this.state = {
        ...this.state,
        status: 'pending',
        gatewayUrl,
        requestId: result.request.requestId,
      }
      await this.saveState()

      log.info(`配对请求已发送，请求 ID: ${result.request.requestId}`)
      return {
        requestId: result.request.requestId,
        status: 'pending',
      }
    } catch (error) {
      log.error('配对请求失败:', error)
      throw error
    }
  }

  /**
   * 查询配对状态
   *
   * @param gatewayCall 调用 Gateway RPC 的函数
   */
  async checkPairingStatus(
    gatewayCall: <T>(method: string, params?: unknown) => Promise<T>
  ): Promise<PairingState['status']> {
    if (!this.state || !this.state.requestId) {
      return this.state?.status ?? 'unpaired'
    }

    try {
      const result = await gatewayCall<{
        status: 'pending' | 'approved' | 'rejected'
        token?: string
      }>('device.getPairingStatus', {
        requestId: this.state.requestId,
        deviceId: this.state.device.deviceId,
      })

      if (result.status === 'approved' && result.token) {
        // 配对成功
        this.state = {
          ...this.state,
          status: 'paired',
          token: result.token,
          pairedAt: Date.now(),
          requestId: undefined,
        }
        await this.saveState()
        log.info('配对成功，已获取 Token')
        return 'paired'
      }

      if (result.status === 'rejected') {
        // 配对被拒绝
        this.state = {
          ...this.state,
          status: 'unpaired',
          requestId: undefined,
        }
        await this.saveState()
        log.warn('配对请求被拒绝')
        return 'unpaired'
      }

      return 'pending'
    } catch (error) {
      log.error('查询配对状态失败:', error)
      throw error
    }
  }

  /**
   * 使用配对码完成配对
   * 用于快速配对场景
   *
   * @param pairingCode 配对码
   * @param gatewayUrl Gateway URL
   * @param gatewayCall 调用 Gateway RPC 的函数
   */
  async pairWithCode(
    pairingCode: string,
    gatewayUrl: string,
    gatewayCall: <T>(method: string, params?: unknown) => Promise<T>
  ): Promise<PairingResult> {
    if (!this.state) {
      throw new Error('设备未初始化')
    }

    log.info(`使用配对码配对: ${pairingCode.substring(0, 4)}...`)

    try {
      const result = await gatewayCall<{
        success: boolean
        token?: string
        message?: string
      }>('device.pairWithCode', {
        pairingCode,
        deviceId: this.state.device.deviceId,
        displayName: this.state.device.displayName,
        platform: this.state.device.platform,
        clientId: this.state.device.clientId,
        clientMode: this.state.device.clientMode,
      })

      if (result.success && result.token) {
        // 配对成功
        this.state = {
          ...this.state,
          status: 'paired',
          gatewayUrl,
          token: result.token,
          pairedAt: Date.now(),
        }
        await this.saveState()
        log.info('配对码配对成功')

        return {
          success: true,
          message: '配对成功',
          token: result.token,
        }
      }

      return {
        success: false,
        message: result.message ?? '配对失败',
      }
    } catch (error) {
      log.error('配对码配对失败:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '配对失败',
      }
    }
  }

  /**
   * 取消配对 / 解除绑定
   */
  async unpair(): Promise<void> {
    if (!this.state) {
      return
    }

    log.info('取消配对')

    this.state = {
      ...this.state,
      status: 'unpaired',
      token: undefined,
      requestId: undefined,
      pairedAt: undefined,
    }

    await this.saveState()
  }

  /**
   * 刷新 Token
   *
   * @param gatewayCall 调用 Gateway RPC 的函数
   */
  async refreshToken(
    gatewayCall: <T>(method: string, params?: unknown) => Promise<T>
  ): Promise<string | null> {
    if (!this.state || !this.state.token) {
      log.warn('无法刷新 Token：设备未配对')
      return null
    }

    try {
      const result = await gatewayCall<{
        token: string
      }>('device.refreshToken', {
        deviceId: this.state.device.deviceId,
        currentToken: this.state.token,
      })

      this.state = {
        ...this.state,
        token: result.token,
      }
      await this.saveState()

      log.info('Token 已刷新')
      return result.token
    } catch (error) {
      log.error('刷新 Token 失败:', error)
      throw error
    }
  }

  /**
   * 验证 Token 是否有效
   *
   * @param gatewayCall 调用 Gateway RPC 的函数
   */
  async verifyToken(
    gatewayCall: <T>(method: string, params?: unknown) => Promise<T>
  ): Promise<boolean> {
    if (!this.state || !this.state.token) {
      return false
    }

    try {
      const result = await gatewayCall<{
        valid: boolean
      }>('device.verifyToken', {
        deviceId: this.state.device.deviceId,
        token: this.state.token,
      })

      if (!result.valid) {
        // Token 无效，重置配对状态
        log.warn('Token 已失效')
        this.state = {
          ...this.state,
          status: 'unpaired',
          token: undefined,
        }
        await this.saveState()
      }

      return result.valid
    } catch (error) {
      log.error('验证 Token 失败:', error)
      return false
    }
  }

  /**
   * 加载状态
   */
  private async loadState(): Promise<PairingState | null> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8')
      return JSON.parse(data) as PairingState
    } catch {
      return null
    }
  }

  /**
   * 保存状态
   */
  private async saveState(): Promise<void> {
    if (!this.state) {
      return
    }

    try {
      // 确保目录存在
      const dir = join(this.configPath, '..')
      await fs.mkdir(dir, { recursive: true })

      // 写入配置文件
      await fs.writeFile(this.configPath, JSON.stringify(this.state, null, 2), 'utf-8')
      log.debug('配对状态已保存')
    } catch (error) {
      log.error('保存配对状态失败:', error)
      throw error
    }
  }

  /**
   * 重置设备 (生成新的设备 ID)
   */
  async resetDevice(): Promise<DeviceInfo> {
    log.info('重置设备')

    const device = this.createDeviceInfo()
    this.state = {
      device,
      status: 'unpaired',
    }

    await this.saveState()
    return device
  }

  /**
   * 更新设备名称
   */
  async updateDisplayName(displayName: string): Promise<void> {
    if (!this.state) {
      throw new Error('设备未初始化')
    }

    this.state = {
      ...this.state,
      device: {
        ...this.state.device,
        displayName,
      },
    }

    await this.saveState()
    log.info(`设备名称已更新: ${displayName}`)
  }
}
