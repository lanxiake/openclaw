/**
 * Gateway WebSocket 客户端 (OpenClaw 协议 v3)
 *
 * 用于与 OpenClaw Gateway 进行 WebSocket 通信
 * 管理员后台专用版本 - 使用 OpenClaw Protocol v3 握手流程
 */

import { GATEWAY_WS_URL, STORAGE_KEYS } from './constants'

// Gateway 认证 Token (用于开发环境)
const GATEWAY_AUTH_TOKEN = import.meta.env.VITE_GATEWAY_AUTH_TOKEN || ''

// 协议版本
const PROTOCOL_VERSION = 3

// 请求 ID 计数器
let requestIdCounter = 0

/**
 * 消息类型 (OpenClaw 协议)
 */
type MessageType = 'req' | 'res' | 'event'

/**
 * 消息结构 (OpenClaw 协议)
 */
interface Message {
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
  }
  caps: string[]
  auth?: {
    token?: string
  }
  role: string
  scopes: string[]
}

// 等待中的请求
const pendingRequests = new Map<
  string,
  {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }
>()

// 事件监听器
const eventListeners = new Map<string, Set<(data: unknown) => void>>()

// WebSocket 实例
let ws: WebSocket | null = null
let isConnecting = false
let handshakeComplete = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000
const REQUEST_TIMEOUT = 30000

/**
 * 连接状态
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * 连接状态监听器
 */
type ConnectionStateListener = (state: ConnectionState) => void
const connectionStateListeners = new Set<ConnectionStateListener>()

let currentState: ConnectionState = 'disconnected'

/**
 * 生成请求 ID
 * @returns 唯一请求 ID
 */
function generateId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`
}

/**
 * 更新连接状态并通知所有监听器
 * @param state - 新的连接状态
 */
function updateConnectionState(state: ConnectionState): void {
  console.log(`[gateway] 连接状态变更: ${currentState} -> ${state}`)
  currentState = state
  connectionStateListeners.forEach((listener) => listener(state))
}

/**
 * 获取当前连接状态
 * @returns 当前连接状态
 */
export function getConnectionState(): ConnectionState {
  return currentState
}

/**
 * 订阅连接状态变化
 * @param listener - 状态变化回调函数
 * @returns 取消订阅函数
 */
export function onConnectionStateChange(listener: ConnectionStateListener): () => void {
  connectionStateListeners.add(listener)
  // 立即通知当前状态
  listener(currentState)
  return () => connectionStateListeners.delete(listener)
}

/**
 * 发送 connect 请求完成握手
 * @param connectResolve - 连接成功回调
 * @param connectReject - 连接失败回调
 */
function sendConnectRequest(connectResolve: () => void, connectReject: (error: Error) => void): void {
  const id = generateId()

  const connectParams: ConnectParams = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: 'openclaw-control-ui',
      displayName: 'OpenClaw Admin Console',
      version: '1.0.0',
      platform: 'web',
      mode: 'ui',
    },
    caps: [],
    role: 'operator',
    scopes: ['operator.admin'],
    // 添加认证信息 (用于绕过设备配对要求)
    auth: GATEWAY_AUTH_TOKEN ? { token: GATEWAY_AUTH_TOKEN } : undefined,
  }

  const message: Message = {
    type: 'req',
    id,
    method: 'connect',
    params: connectParams,
  }

  console.log('[gateway] 发送 connect 握手请求')

  // 注册待处理请求
  const timeout = setTimeout(() => {
    pendingRequests.delete(id)
    console.error('[gateway] connect 请求超时')
    connectReject(new Error('握手超时'))
  }, REQUEST_TIMEOUT)

  pendingRequests.set(id, {
    resolve: (payload) => {
      console.log('[gateway] 握手成功:', payload)
      handshakeComplete = true
      isConnecting = false
      updateConnectionState('connected')
      connectResolve()
    },
    reject: (error) => {
      console.error('[gateway] 握手失败:', error)
      isConnecting = false
      connectReject(error)
    },
    timeout,
  })

  ws?.send(JSON.stringify(message))
}

/**
 * 处理收到的消息
 * @param data - 原始消息字符串
 * @param connectResolve - 连接成功回调（仅握手阶段使用）
 * @param connectReject - 连接失败回调（仅握手阶段使用）
 */
function handleMessage(
  data: string,
  connectResolve?: () => void,
  connectReject?: (error: Error) => void
): void {
  try {
    const message: Message = JSON.parse(data)
    console.log('[gateway] 收到消息:', message.type, message.event || message.id)

    // 处理 connect.challenge 事件 - 开始握手
    if (message.type === 'event' && message.event === 'connect.challenge') {
      const challenge = message.payload as ConnectChallenge
      console.log('[gateway] 收到 connect.challenge，nonce:', challenge.nonce)
      if (connectResolve && connectReject) {
        sendConnectRequest(connectResolve, connectReject)
      }
      return
    }

    // 处理响应
    if (message.type === 'res' && message.id) {
      const pending = pendingRequests.get(message.id)
      if (pending) {
        clearTimeout(pending.timeout)
        pendingRequests.delete(message.id)

        if (message.ok) {
          pending.resolve(message.payload)
        } else {
          pending.reject(new Error(message.error?.message || '请求失败'))
        }
      }
      return
    }

    // 处理事件
    if (message.type === 'event' && message.event) {
      const listeners = eventListeners.get(message.event)
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(message.payload)
          } catch (e) {
            console.error(`[gateway] 事件处理错误: ${message.event}`, e)
          }
        })
      }
    }
  } catch (e) {
    console.error('[gateway] 解析消息失败', e, data)
  }
}

/**
 * 连接到 Gateway（含 OpenClaw Protocol v3 握手）
 * @returns 连接成功 Promise
 */
export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws?.readyState === WebSocket.OPEN && handshakeComplete) {
      resolve()
      return
    }

    if (isConnecting) {
      // 等待现有连接完成
      const checkConnection = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN && handshakeComplete) {
          clearInterval(checkConnection)
          resolve()
        } else if (!isConnecting) {
          clearInterval(checkConnection)
          reject(new Error('连接失败'))
        }
      }, 100)
      return
    }

    isConnecting = true
    handshakeComplete = false
    updateConnectionState('connecting')

    console.log('[gateway] 正在连接...', GATEWAY_WS_URL)

    ws = new WebSocket(GATEWAY_WS_URL)

    ws.onopen = () => {
      console.log('[gateway] WebSocket 连接已建立，等待握手...')
      reconnectAttempts = 0
      // 不要立即 resolve，等待 connect.challenge 后完成握手
    }

    ws.onclose = (event) => {
      console.log('[gateway] 连接关闭', event.code, event.reason)
      isConnecting = false
      handshakeComplete = false
      updateConnectionState('disconnected')

      // 清理等待中的请求
      pendingRequests.forEach((pending) => {
        clearTimeout(pending.timeout)
        pending.reject(new Error('连接已关闭'))
      })
      pendingRequests.clear()

      // 尝试重连
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        console.log(
          `[gateway] ${RECONNECT_DELAY / 1000}秒后尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
        )
        setTimeout(() => {
          connect().catch(console.error)
        }, RECONNECT_DELAY)
      }
    }

    ws.onerror = (error) => {
      console.error('[gateway] 连接错误', error)
      isConnecting = false
      updateConnectionState('error')
      reject(new Error('连接错误'))
    }

    ws.onmessage = (event) => {
      handleMessage(event.data, resolve, reject)
    }
  })
}

/**
 * 断开连接
 */
export function disconnect(): void {
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS // 阻止重连
  if (ws) {
    ws.close()
    ws = null
  }
  handshakeComplete = false
  updateConnectionState('disconnected')
}

/**
 * 发送 RPC 请求（OpenClaw Protocol v3 格式）
 *
 * @param method - RPC 方法名
 * @param params - 请求参数
 * @param timeout - 超时时间（毫秒）
 * @returns 响应结果
 */
export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeout = REQUEST_TIMEOUT
): Promise<T> {
  // 确保已连接且握手完成
  if (ws?.readyState !== WebSocket.OPEN || !handshakeComplete) {
    await connect()
  }

  if (!ws || ws.readyState !== WebSocket.OPEN || !handshakeComplete) {
    throw new Error('未连接到 Gateway')
  }

  const id = generateId()

  const message: Message = {
    type: 'req',
    id,
    method,
    params: {
      ...params,
      // 添加管理员认证令牌（如果有）
      accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || undefined,
    },
  }

  console.log(`[gateway] 调用 ${method}`, params)

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`请求超时: ${method}`))
    }, timeout)

    pendingRequests.set(id, {
      resolve: resolve as (result: unknown) => void,
      reject,
      timeout: timeoutId,
    })

    ws!.send(JSON.stringify(message))
  })
}

/**
 * 订阅事件
 *
 * @param event - 事件名称
 * @param listener - 事件处理函数
 * @returns 取消订阅函数
 */
export function subscribe(event: string, listener: (data: unknown) => void): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set())
  }

  eventListeners.get(event)!.add(listener)

  return () => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        eventListeners.delete(event)
      }
    }
  }
}

/**
 * Gateway RPC 客户端
 */
export const gateway = {
  connect,
  disconnect,
  call,
  subscribe,
  getConnectionState,
  onConnectionStateChange,
}
