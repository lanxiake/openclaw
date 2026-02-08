/**
 * GatewayClient - WebSocket 客户端
 *
 * 负责与 OpenClaw Gateway 服务器建立和管理 WebSocket 连接
 * 实现 OpenClaw 通信协议的握手流程
 */

import WebSocket from 'ws'
import { EventEmitter } from 'events'
import type { SkillExecuteRequest, SkillExecuteResult } from '../../../../src/gateway/protocol/skill-execution'
import { SKILL_EXECUTE_EVENT, SKILL_RESULT_METHOD } from '../../../../src/gateway/protocol/skill-execution'
import type { ClientSkillRuntime } from './skill-runtime'

// 日志输出
const log = {
  info: (...args: unknown[]) => console.log('[GatewayClient]', ...args),
  error: (...args: unknown[]) => console.error('[GatewayClient]', ...args),
  warn: (...args: unknown[]) => console.warn('[GatewayClient]', ...args),
  debug: (...args: unknown[]) => console.log('[GatewayClient:Debug]', ...args),
}

// 协议版本
const PROTOCOL_VERSION = 3

/**
 * 消息类型 (复用 OpenClaw 协议)
 */
export type MessageType = 'req' | 'res' | 'event'

/**
 * 消息结构 (复用 OpenClaw 协议)
 */
export interface Message {
  type: MessageType
  id?: string
  method?: string
  params?: unknown
  event?: string
  ok?: boolean
  payload?: unknown
  error?: {
    code: string
    message: string
  }
}

/**
 * 连接挑战事件
 */
interface ConnectChallenge {
  nonce: string
  ts: number
}

/**
 * 连接参数
 */
interface ConnectParams {
  minProtocol: number
  maxProtocol: number
  client: {
    id: string
    displayName?: string
    version: string
    platform: string
    mode: string
    instanceId?: string
  }
  caps: string[]
  auth?: {
    token?: string
    password?: string
  }
  role: string
  scopes: string[]
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
  'command:execute': (request: CommandExecuteRequest) => void
  'skill:execute': (request: SkillExecuteRequest) => void
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
 * 命令执行请求
 */
export interface CommandExecuteRequest {
  requestId: string
  command: string
  timeoutMs: number
  requireConfirm: boolean
}

/**
 * Gateway 客户端类
 *
 * 实现 OpenClaw Gateway 握手协议：
 * 1. 建立 WebSocket 连接
 * 2. 等待 connect.challenge 事件
 * 3. 发送 connect 请求
 * 4. 等待 connect 响应完成握手
 */
export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: Required<GatewayClientConfig>
  private pendingRequests = new Map<string, PendingRequest>()
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private _isConnected = false
  private handshakeComplete = false
  private connectNonce: string | null = null
  private skillRuntime: ClientSkillRuntime | null = null

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
   * 设置技能运行时
   */
  setSkillRuntime(runtime: ClientSkillRuntime): void {
    this.skillRuntime = runtime
    log.info('SkillRuntime 已设置')
  }

  /**
   * 获取技能运行时
   */
  getSkillRuntime(): ClientSkillRuntime | null {
    return this.skillRuntime
  }

  /**
   * 连接到 Gateway
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      log.info('已经连接到 Gateway')
      return
    }

    log.info(`正在连接到 Gateway: ${this.config.url}`)

    // 重置握手状态
    this.handshakeComplete = false
    this.connectNonce = null

    return new Promise((resolve, reject) => {
      try {
        const headers: Record<string, string> = {}
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`
        }

        this.ws = new WebSocket(this.config.url, { headers })

        this.ws.on('open', () => {
          log.info('WebSocket 连接已建立，等待握手...')
          this._isConnected = true
          this.reconnectAttempts = 0
          // 不要立即发送请求，等待 connect.challenge 事件
        })

        this.ws.on('message', (data) => {
          this.handleMessage(data, resolve, reject)
        })

        this.ws.on('close', (code, reason) => {
          log.info(`WebSocket 连接关闭: ${code} - ${reason}`)
          this._isConnected = false
          this.handshakeComplete = false
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
    this.handshakeComplete = false
  }

  /**
   * 发送 RPC 请求
   */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Gateway')
    }

    if (!this.handshakeComplete) {
      throw new Error('Handshake not complete')
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
   * 发送 connect 请求完成握手
   */
  private sendConnectRequest(): void {
    const id = this.generateId()

    // 使用 Gateway 接受的有效客户端 ID 和 mode
    // 参考 src/gateway/protocol/client-info.ts
    const connectParams: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: 'gateway-client', // 使用有效的客户端 ID
        displayName: 'OpenClaw Windows Assistant',
        version: '0.1.0',
        platform: 'win32',
        mode: 'ui', // 使用有效的客户端 mode
      },
      // 声明客户端能力
      caps: [
        'skill.local',    // 支持本地技能执行
        'file.ops',       // 支持文件操作
        'system.cmd',     // 支持系统命令
      ],
      auth: this.config.token ? { token: this.config.token } : undefined,
      role: 'operator',
      scopes: ['operator.admin'],
    }

    const message: Message = {
      type: 'req',
      id,
      method: 'connect',
      params: connectParams,
    }

    log.info('发送 connect 握手请求')
    log.debug('connect 参数:', connectParams)

    // 注册待处理请求
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(id)
      log.error('connect 请求超时')
    }, this.config.requestTimeout)

    this.pendingRequests.set(id, {
      resolve: (payload) => {
        log.info('握手成功:', payload)
        this.handshakeComplete = true
        this.startHeartbeat()
        this.emit('connected')
      },
      reject: (error) => {
        log.error('握手失败:', error)
        this.ws?.close()
      },
      timeout,
    })

    this.send(message)
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
  private handleMessage(
    data: WebSocket.Data,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void
  ): void {
    try {
      const message: Message = JSON.parse(data.toString())
      log.debug('收到消息:', message)

      // 处理 connect.challenge 事件 - 开始握手
      if (message.type === 'event' && message.event === 'connect.challenge') {
        const challenge = message.payload as ConnectChallenge
        log.info('收到 connect.challenge，nonce:', challenge.nonce)
        this.connectNonce = challenge.nonce
        this.sendConnectRequest()
        return
      }

      // 处理响应
      if (message.type === 'res' && message.id) {
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.id)

          if (message.ok) {
            pending.resolve(message.payload)
            // 如果这是 connect 请求的响应，触发 connectResolve
            if (connectResolve && this.handshakeComplete) {
              connectResolve()
            }
          } else {
            const error = new Error(message.error?.message ?? 'Unknown error')
            pending.reject(error)
            // 如果这是 connect 请求的响应失败，触发 connectReject
            if (connectReject && !this.handshakeComplete) {
              connectReject(error)
            }
          }
          return
        }
      }

      // 只有握手完成后才处理其他事件
      if (!this.handshakeComplete) {
        return
      }

      // 处理事件
      if (message.type === 'event') {
        // 操作确认请求
        if (message.event === 'confirm.request') {
          this.emit('confirm:request', message.payload as ConfirmRequest)
          return
        }

        // 命令执行请求
        if (message.event === 'command.execute.request') {
          log.info('收到命令执行请求:', message.payload)
          this.emit('command:execute', message.payload as CommandExecuteRequest)
          return
        }

        // 技能执行请求
        if (message.event === SKILL_EXECUTE_EVENT) {
          log.info('收到技能执行请求:', message.payload)
          const request = message.payload as SkillExecuteRequest
          this.emit('skill:execute', request)
          // 如果有 SkillRuntime，自动执行技能
          this.handleSkillExecuteRequest(request)
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
   * 处理技能执行请求
   */
  private async handleSkillExecuteRequest(request: SkillExecuteRequest): Promise<void> {
    if (!this.skillRuntime) {
      log.warn('SkillRuntime 未设置，无法执行技能')
      // 返回错误结果
      const errorResult: SkillExecuteResult = {
        requestId: request.requestId,
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'SkillRuntime not initialized',
        },
        executionTimeMs: 0,
      }
      await this.sendSkillResult(errorResult)
      return
    }

    try {
      log.info(`开始执行技能: ${request.skillId}`)
      const result = await this.skillRuntime.executeSkill(request)
      log.info(`技能执行完成: ${request.skillId}`, result)
      await this.sendSkillResult(result)
    } catch (error) {
      log.error(`技能执行失败: ${request.skillId}`, error)
      const errorResult: SkillExecuteResult = {
        requestId: request.requestId,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        executionTimeMs: 0,
      }
      await this.sendSkillResult(errorResult)
    }
  }

  /**
   * 发送技能执行结果到 Gateway
   */
  private async sendSkillResult(result: SkillExecuteResult): Promise<void> {
    try {
      await this.call(SKILL_RESULT_METHOD, result)
      log.info(`技能结果已发送: ${result.requestId}`)
    } catch (error) {
      log.error(`发送技能结果失败: ${result.requestId}`, error)
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && this.handshakeComplete) {
        // 使用 Gateway 支持的 heartbeat 方法
        this.call('heartbeat', { ts: Date.now() }).catch((error) => {
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
   * 检查是否已连接并完成握手
   */
  isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 检查握手是否完成
   */
  isHandshakeComplete(): boolean {
    return this.handshakeComplete
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
  getStatus(): { connected: boolean; handshakeComplete: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected(),
      handshakeComplete: this.handshakeComplete,
      reconnectAttempts: this.reconnectAttempts,
    }
  }
}
