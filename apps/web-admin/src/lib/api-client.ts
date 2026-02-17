/**
 * API Server HTTP 客户端
 *
 * 用于与 OpenClaw API Server 进行 REST API 通信
 */

// API Server URL
const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3000'

/**
 * API 响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

/**
 * HTTP 请求配置
 */
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

/**
 * 发送 HTTP 请求
 *
 * @param endpoint - API 端点路径 (如 '/api/admin/auth/login')
 * @param config - 请求配置
 * @returns API 响应
 */
async function request<T = unknown>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body, timeout = 30000 } = config

  const url = `${API_SERVER_URL}${endpoint}`

  console.log(`[api-client] ${method} ${url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 解析响应
    const data = await response.json()

    // 如果响应不是 2xx，视为错误
    if (!response.ok) {
      console.error(`[api-client] ${method} ${url} 失败:`, data)
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        code: data.code,
      }
    }

    console.log(`[api-client] ${method} ${url} 成功`)
    return data as ApiResponse<T>
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[api-client] ${method} ${url} 超时`)
        return {
          success: false,
          error: '请求超时',
          code: 'TIMEOUT',
        }
      }

      console.error(`[api-client] ${method} ${url} 错误:`, error.message)
      return {
        success: false,
        error: error.message,
        code: 'NETWORK_ERROR',
      }
    }

    return {
      success: false,
      error: '未知错误',
      code: 'UNKNOWN_ERROR',
    }
  }
}

/**
 * API 客户端
 */
export const apiClient = {
  /**
   * GET 请求
   */
  get<T = unknown>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'GET', headers })
  },

  /**
   * POST 请求
   */
  post<T = unknown>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'POST', body, headers })
  },

  /**
   * PUT 请求
   */
  put<T = unknown>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'PUT', body, headers })
  },

  /**
   * DELETE 请求
   */
  delete<T = unknown>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'DELETE', headers })
  },

  /**
   * PATCH 请求
   */
  patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'PATCH', body, headers })
  },
}
