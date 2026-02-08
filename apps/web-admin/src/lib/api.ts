import { API_BASE_URL, STORAGE_KEYS } from './constants'

/**
 * API 响应类型
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/**
 * 获取存储的访问令牌
 */
function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * API 请求函数
 *
 * @param endpoint - API 端点
 * @param options - 请求选项
 * @returns 响应数据
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  console.log(`[api] ${options.method || 'GET'} ${endpoint}`)

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    console.error(`[api] 请求失败: ${endpoint}`, data)
    throw new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || '请求失败',
      response.status,
      data.error?.details
    )
  }

  return data
}

/**
 * API 客户端
 */
export const api = {
  /**
   * GET 请求
   */
  get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<ApiResponse<T>> {
    let url = endpoint
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url = `${endpoint}?${queryString}`
      }
    }
    return request<T>(url, { method: 'GET' })
  },

  /**
   * POST 请求
   */
  post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /**
   * PUT 请求
   */
  put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /**
   * PATCH 请求
   */
  patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /**
   * DELETE 请求
   */
  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return request<T>(endpoint, { method: 'DELETE' })
  },
}
