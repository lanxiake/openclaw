/**
 * API Client 单元测试
 *
 * 测试 API Server HTTP 客户端的各项功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ApiClient,
  type LoginParams,
  type RegisterParams,
  type PairRequestParams,
} from './api-client'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ApiClient', () => {
  let client: ApiClient

  beforeEach(() => {
    client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
    })
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // 配置测试
  // ==========================================================================

  describe('配置', () => {
    it('应使用默认配置初始化', () => {
      const defaultClient = new ApiClient()
      expect(defaultClient.getBaseUrl()).toBe('http://localhost:3000')
      expect(defaultClient.getAccessToken()).toBeNull()
    })

    it('应正确设置和获取访问令牌', () => {
      expect(client.getAccessToken()).toBeNull()

      client.setAccessToken('test-token')
      expect(client.getAccessToken()).toBe('test-token')

      client.setAccessToken(null)
      expect(client.getAccessToken()).toBeNull()
    })

    it('应正确设置和获取基础 URL', () => {
      expect(client.getBaseUrl()).toBe('http://localhost:3000')

      client.setBaseUrl('http://api.example.com')
      expect(client.getBaseUrl()).toBe('http://api.example.com')
    })
  })

  // ==========================================================================
  // 认证接口测试
  // ==========================================================================

  describe('login', () => {
    it('应成功登录并返回用户信息和令牌', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user_123',
            username: 'testuser',
            email: 'test@example.com',
            displayName: 'Test User',
            createdAt: '2024-01-01T00:00:00Z',
          },
          accessToken: 'access_token_123',
          refreshToken: 'refresh_token_123',
          expiresIn: 3600,
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const params: LoginParams = {
        identifier: 'testuser',
        password: 'password123',
      }

      const result = await client.login(params)

      expect(result.success).toBe(true)
      expect(result.data?.user.id).toBe('user_123')
      expect(result.data?.accessToken).toBe('access_token_123')

      // 验证请求参数
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('应正确识别邮箱格式的 identifier', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      })

      await client.login({
        identifier: 'test@example.com',
        password: 'password123',
      })

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.email).toBe('test@example.com')
      expect(body.username).toBeUndefined()
    })

    it('应正确识别手机号格式的 identifier', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      })

      await client.login({
        identifier: '13800138000',
        password: 'password123',
      })

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.username).toBe('13800138000')
    })

    it('应处理登录失败', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Invalid credentials',
            code: 'LOGIN_FAILED',
          }),
      })

      const result = await client.login({
        identifier: 'testuser',
        password: 'wrongpassword',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
      expect(result.code).toBe('LOGIN_FAILED')
    })
  })

  describe('register', () => {
    it('应成功注册新用户', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user_456',
            username: 'newuser',
            email: 'new@example.com',
            displayName: 'New User',
            createdAt: '2024-01-01T00:00:00Z',
          },
          accessToken: 'access_token_456',
          refreshToken: 'refresh_token_456',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const params: RegisterParams = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      }

      const result = await client.register(params)

      expect(result.success).toBe(true)
      expect(result.data?.user.id).toBe('user_456')
    })

    it('应处理注册失败（用户已存在）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Username already exists',
            code: 'USER_EXISTS',
          }),
      })

      const result = await client.register({
        username: 'existinguser',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Username already exists')
    })
  })

  describe('refreshToken', () => {
    it('应成功刷新令牌', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: 'user_123', createdAt: '2024-01-01T00:00:00Z' },
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.refreshToken('old_refresh_token')

      expect(result.success).toBe(true)
      expect(result.data?.accessToken).toBe('new_access_token')
    })

    it('应处理刷新令牌过期', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Refresh token expired',
            code: 'TOKEN_EXPIRED',
          }),
      })

      const result = await client.refreshToken('expired_token')

      expect(result.success).toBe(false)
      expect(result.code).toBe('TOKEN_EXPIRED')
    })
  })

  describe('logout', () => {
    it('应成功登出', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      await expect(client.logout('refresh_token')).resolves.not.toThrow()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  // ==========================================================================
  // 设备配对接口测试
  // ==========================================================================

  describe('requestDevicePairing', () => {
    it('应成功发起配对请求', async () => {
      client.setAccessToken('valid_token')

      const mockResponse = {
        success: true,
        data: {
          requestId: 'req_123',
          status: 'pending',
          expiresAt: '2024-01-01T00:05:00Z',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const params: PairRequestParams = {
        deviceId: 'device_123',
        publicKey: 'public_key_data',
        displayName: 'My Windows PC',
        platform: 'Windows',
      }

      const result = await client.requestDevicePairing(params)

      expect(result.success).toBe(true)
      expect(result.data?.requestId).toBe('req_123')
      expect(result.data?.status).toBe('pending')

      // 验证带有 Authorization header
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].headers['Authorization']).toBe('Bearer valid_token')
    })

    it('应处理未认证错误', async () => {
      // 不设置 token

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
          }),
      })

      const result = await client.requestDevicePairing({
        deviceId: 'device_123',
        publicKey: 'public_key_data',
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe('UNAUTHORIZED')
    })
  })

  describe('checkPairingStatus', () => {
    it('应成功查询配对状态', async () => {
      client.setAccessToken('valid_token')

      const mockResponse = {
        success: true,
        data: {
          status: 'approved',
          device: {
            deviceId: 'device_123',
            userId: 'user_123',
            displayName: 'My Windows PC',
            platform: 'Windows',
          },
          deviceToken: 'device_token_xyz',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.checkPairingStatus('req_123')

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('approved')
      expect(result.data?.deviceToken).toBe('device_token_xyz')
    })
  })

  // ==========================================================================
  // 用户自服务接口测试
  // ==========================================================================

  describe('getCurrentUser', () => {
    it('应成功获取当前用户信息', async () => {
      client.setAccessToken('valid_token')

      const mockResponse = {
        success: true,
        data: {
          id: 'user_123',
          username: 'testuser',
          email: 'test@example.com',
          displayName: 'Test User',
          createdAt: '2024-01-01T00:00:00Z',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.getCurrentUser()

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('user_123')
    })
  })

  describe('getUserDevices', () => {
    it('应成功获取用户设备列表', async () => {
      client.setAccessToken('valid_token')

      const mockResponse = {
        success: true,
        data: [
          {
            deviceId: 'device_1',
            userId: 'user_123',
            alias: 'My Phone',
            isPrimary: true,
            linkedAt: '2024-01-01T00:00:00Z',
            platform: 'iOS',
          },
          {
            deviceId: 'device_2',
            userId: 'user_123',
            alias: 'My PC',
            isPrimary: false,
            linkedAt: '2024-01-02T00:00:00Z',
            platform: 'Windows',
          },
        ],
        meta: {
          total: 2,
          quota: 5,
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.getUserDevices()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.meta?.total).toBe(2)
    })
  })

  describe('updateUser', () => {
    it('应成功更新用户信息', async () => {
      client.setAccessToken('valid_token')

      const mockResponse = {
        success: true,
        data: {
          id: 'user_123',
          displayName: 'Updated Name',
          createdAt: '2024-01-01T00:00:00Z',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.updateUser({
        displayName: 'Updated Name',
      })

      expect(result.success).toBe(true)
      expect(result.data?.displayName).toBe('Updated Name')
    })
  })

  // ==========================================================================
  // 错误处理测试
  // ==========================================================================

  describe('错误处理', () => {
    it('应处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await client.login({
        identifier: 'testuser',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(result.code).toBe('NETWORK_ERROR')
    })

    it('应处理请求超时', async () => {
      // 创建一个短超时的客户端
      const shortTimeoutClient = new ApiClient({
        baseUrl: 'http://localhost:3000',
        timeout: 100,
      })

      // 模拟一个永不 resolve 的请求
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            }, 50)
          })
      )

      const result = await shortTimeoutClient.login({
        identifier: 'testuser',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      expect(result.code).toBe('TIMEOUT')
    })

    it('应处理 HTTP 500 错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR',
          }),
      })

      const result = await client.login({
        identifier: 'testuser',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Internal server error')
    })
  })
})
