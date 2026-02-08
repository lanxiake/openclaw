/**
 * Gateway WebSocket JSON-RPC 客户端
 *
 * 用于与 OpenClaw Gateway 进行 WebSocket 通信
 * 管理员后台专用版本
 */

import { GATEWAY_WS_URL, STORAGE_KEYS } from './constants'

// 请求 ID 计数器
let requestIdCounter = 0

// 等待中的请求
const pendingRequests = new Map<
  number,
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
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 3000

/**
 * JSON-RPC 请求结构
 */
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: Record<string, unknown>
}

/**
 * JSON-RPC 响应结构
 */
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * JSON-RPC 通知结构（无 id）
 */
interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params: unknown
}

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
 * 更新连接状态
 */
function updateConnectionState(state: ConnectionState): void {
  console.log(`[gateway] 连接状态变更: ${currentState} -> ${state}`)
  currentState = state
  connectionStateListeners.forEach((listener) => listener(state))
}

/**
 * 获取当前连接状态
 */
export function getConnectionState(): ConnectionState {
  return currentState
}

/**
 * 订阅连接状态变化
 */
export function onConnectionStateChange(listener: ConnectionStateListener): () => void {
  connectionStateListeners.add(listener)
  // 立即通知当前状态
  listener(currentState)
  return () => connectionStateListeners.delete(listener)
}

/**
 * 连接到 Gateway
 */
export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws?.readyState === WebSocket.OPEN) {
      resolve()
      return
    }

    if (isConnecting) {
      // 等待现有连接完成
      const checkConnection = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
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
    updateConnectionState('connecting')

    console.log('[gateway] 正在连接...', GATEWAY_WS_URL)

    ws = new WebSocket(GATEWAY_WS_URL)

    ws.onopen = () => {
      console.log('[gateway] 连接成功')
      isConnecting = false
      reconnectAttempts = 0
      updateConnectionState('connected')
      resolve()
    }

    ws.onclose = (event) => {
      console.log('[gateway] 连接关闭', event.code, event.reason)
      isConnecting = false
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
      handleMessage(event.data)
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
  updateConnectionState('disconnected')
}

/**
 * 处理收到的消息
 */
function handleMessage(data: string): void {
  try {
    const message = JSON.parse(data)

    // 检查是否是响应（有 id）
    if ('id' in message && message.id !== undefined) {
      const response = message as JsonRpcResponse
      const pending = pendingRequests.get(response.id)

      if (pending) {
        clearTimeout(pending.timeout)
        pendingRequests.delete(response.id)

        if (response.error) {
          console.error(`[gateway] RPC 错误:`, response.error)
          pending.reject(new Error(response.error.message))
        } else {
          pending.resolve(response.result)
        }
      }
    } else if ('method' in message) {
      // 是通知/事件
      const notification = message as JsonRpcNotification
      const listeners = eventListeners.get(notification.method)

      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(notification.params)
          } catch (e) {
            console.error(`[gateway] 事件处理错误: ${notification.method}`, e)
          }
        })
      }
    }
  } catch (e) {
    console.error('[gateway] 解析消息失败', e, data)
  }
}

/**
 * 发送 RPC 请求
 *
 * @param method - RPC 方法名
 * @param params - 请求参数
 * @param timeout - 超时时间（毫秒）
 * @returns 响应结果
 */
export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeout = 30000
): Promise<T> {
  // 确保已连接
  if (ws?.readyState !== WebSocket.OPEN) {
    await connect()
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('未连接到 Gateway')
  }

  const id = ++requestIdCounter

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
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

    ws!.send(JSON.stringify(request))
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
