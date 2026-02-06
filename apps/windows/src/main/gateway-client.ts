/**
 * GatewayClient - WebSocket 客户端
 *
 * 负责与 OpenClaw Gateway 服务器建立和管理 WebSocket 连接
 * 复用现有的 OpenClaw 通信协议
 */

import WebSocket from 'ws'
import { EventEmitter } from 'events'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[GatewayClient]', ...args),
  error: (...args: unknown[]) => console.error('[GatewayClient]', ...args),
  warn: (...args: unknown[]) => console.warn('[GatewayClient]', ...args),
  debug: (...args: unknown[]) => console.log('[GatewayClient:Debug]', ...args),
}

/**
 * 消息类型 (复用 OpenClaw 协议)
 */
export type MessageType = 'req' | 'resp' | 'event'

/**
 * 消息结构 (复用 OpenClaw 协议)
 */
export interface Message {
  type: MessageType
  id: string
  method?: string
  params?: unknown
  ok?: boolean
  payload?: unknown
  error?: {
    code: string
    message: string
  }
}

/**
 * Gateway 客户端配置
 */
export interface GatewayClientConfig {
  /** Gateway WebSocket URL */
  url: string
  /** 认证 Token */
  token?: string
  /** 重连间隔 (毫秒) */
  reconnectInterval?: number
  /** 最大重连次数 */
  maxReconnectAttempts?: number
  /** 心跳间隔 (毫秒) */
  heartbeatInterval?: number
  /** 请求超时 (毫秒) */
  requestTimeout?: number
}

/**
 * 待处理请求
 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * GatewayClient 事件
 */
export interface GatewayClientEvents {
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
  message: (message: Message) => void
  'confirm:request': (request: ConfirmRequest) => void
}

/**
 * 操作确认请求
 */
export interface ConfirmRequest {
  requestId: string
  action: string
  description: string
  details?: unknown
  level: 'low' | 'medium' | 'high'
}

/**
 * Gateway 客户端类
 */
export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: Required<GatewayClientConfig>
  private pendingRequests = new Map<string, PendingRequest>()
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private _isConnected = false

  constructor(config: GatewayClientConfig) {
    super()
    this.config = {
      url: config.url,
      token: config.token ?? '',
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      requestTimeout: config.requestTimeout ?? 30000,
    }
  }

  /**
   * 连接到 Gateway
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      log.warn('已经连接到 Gateway')
      return
    }

    log.info(`正在连接到 Gateway: ${this.config.url}`)

    return new Promise((resolve, reject) => {
      try {
        const headers: Record<string, string> = {}
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`
        }

        this.ws = new WebSocket(this.config.url, { headers })

        this.ws.on('open', () => {
          log.info('WebSocket 连接已建立')
          this._isConnected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data) => {
          this.handleMessage(data)
        })

        this.ws.on('close', (code, reason) => {
          log.info(`WebSocket 连接关闭: ${code} - ${reason}`)
          this._isConnected = false
          this.stopHeartbeat()
          this.emit('disconnected')
          this.scheduleReconnect()
        })

        this.ws.on('error', (error) => {
          log.error('WebSocket 错误:', error)
          this.emit('error', error)
          reject(error)
        })
      } catch (error) {
        log.error('连接失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    log.info('断开 Gateway 连接')

    // 停止重连
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 停止心跳
    this.stopHeartbeat()

    // 拒绝所有待处理请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    // 关闭 WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this._isConnected = false
  }

  /**
   * 发送 RPC 请求
   */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Gateway')
    }

    const id = this.generateId()
    const message: Message = {
      type: 'req',
      id,
      method,
      params,
    }

    log.debug(`发送请求: ${method}`, params)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, this.config.requestTimeout)

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout })
      this.send(message)
    })
  }

  /**
   * 发送消息
   */
  private send(message: Message): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }

    const data = JSON.stringify(message)
    this.ws.send(data)
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: Message = JSON.parse(data.toString())
      log.debug('收到消息:', message)

      // 处理响应
      if (message.type === 'resp' && message.id) {
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.id)

          if (message.ok) {
            pending.resolve(message.payload)
          } else {
            pending.reject(new Error(message.error?.message ?? 'Unknown error'))
          }
          return
        }
      }

      // 处理事件
      if (message.type === 'event') {
        // 操作确认请求
        if (message.method === 'confirm.request') {
          this.emit('confirm:request', message.payload as ConfirmRequest)
          return
        }

        // 其他事件
        this.emit('message', message)
      }
    } catch (error) {
      log.error('解析消息失败:', error)
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.call('heartbeat', { timestamp: Date.now() }).catch((error) => {
          log.warn('心跳失败:', error)
        })
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      log.error('达到最大重连次数，停止重连')
      return
    }

    this.reconnectAttempts++
    log.info(`${this.config.reconnectInterval}ms 后尝试第 ${this.reconnectAttempts} 次重连`)

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        log.error('重连失败:', error)
      })
    }, this.config.reconnectInterval)
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 设置 Gateway URL
   */
  setUrl(url: string): void {
    this.config.url = url
  }

  /**
   * 设置认证 Token
   */
  setToken(token: string): void {
    this.config.token = token
  }

  /**
   * 获取连接状态
   */
  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
    }
  }
}
