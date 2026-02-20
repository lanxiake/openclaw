// @vitest-environment jsdom

/**
 * useDashboard hook 单元测试
 *
 * 测试 Dashboard 数据聚合 hook 的核心行为：
 * - 初始化时加载订阅概览和技能统计
 * - 正确聚合多数据源（订阅、设备、技能）
 * - 加载状态管理
 * - 错误处理
 * - 手动刷新
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock subscription-service
vi.mock('../services/subscription-service', () => ({
  subscriptionService: {
    setAccessToken: vi.fn(),
    getSubscription: vi.fn(),
    getUsage: vi.fn(),
  },
}))

// Mock device-service
vi.mock('../services/device-service', () => ({
  deviceService: {
    setAccessToken: vi.fn(),
    getDevices: vi.fn(),
  },
}))

// Mock window.electronAPI（在 jsdom window 上添加属性，不覆盖 window 本身）
const mockGatewayCall = vi.fn()
;(window as any).electronAPI = {
  gateway: {
    call: mockGatewayCall,
  },
}

import { useDashboard } from './useDashboard'
import { subscriptionService } from '../services/subscription-service'
import { deviceService } from '../services/device-service'

const mockedSubscriptionService = vi.mocked(subscriptionService)
const mockedDeviceService = vi.mocked(deviceService)

describe('useDashboard', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-access-token')

    // 默认 mock 返回成功数据
    mockedSubscriptionService.getSubscription.mockResolvedValue({
      success: true,
      subscription: {
        id: 'sub-1',
        userId: 'user-1',
        planId: 'pro',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        autoRenew: true,
        billingCycle: 'monthly',
      },
      plan: {
        id: 'pro',
        name: 'pro',
        displayName: '专业版',
        price: 29,
        currency: 'CNY',
        billingCycle: 'monthly',
        features: {
          maxDevices: 5,
          maxSkills: 20,
          maxConversations: 100,
          maxMemorySize: 1024,
          prioritySupport: true,
          customBranding: false,
        },
        isActive: true,
      },
    })

    mockedSubscriptionService.getUsage.mockResolvedValue({
      success: true,
      usage: {
        devices: { current: 2, limit: 5 },
        skills: { current: 8, limit: 20 },
        conversations: { daily: 42, monthly: 300, limit: 100 },
        storage: { used: 256, limit: 1024 },
      },
    })

    mockedDeviceService.getDevices.mockResolvedValue({
      success: true,
      devices: [
        {
          deviceId: 'dev-1',
          userId: 'user-1',
          isPrimary: true,
          linkedAt: '2026-01-15',
          platform: 'windows',
          displayName: 'Windows PC',
          scopes: ['user.basic'],
        },
        {
          deviceId: 'dev-2',
          userId: 'user-1',
          isPrimary: false,
          linkedAt: '2026-02-01',
          platform: 'macos',
          displayName: 'MacBook Pro',
          scopes: ['user.basic'],
        },
      ],
    })

    // 技能列表通过 Gateway RPC 获取
    mockGatewayCall.mockResolvedValue({
      skills: [
        { id: 'skill-1', name: '翻译', status: 'loaded' },
        { id: 'skill-2', name: '搜索', status: 'loaded' },
        { id: 'skill-3', name: '天气', status: 'error' },
      ],
    })
  })

  afterEach(() => {
    getItemSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('初始状态应为 loading', () => {
    const { result } = renderHook(() => useDashboard())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('加载完成后应聚合所有数据', async () => {
    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 验证订阅信息
    expect(result.current.subscription).not.toBeNull()
    expect(result.current.subscription?.planId).toBe('pro')
    expect(result.current.planName).toBe('专业版')

    // 验证使用量
    expect(result.current.usage).not.toBeNull()
    expect(result.current.usage?.devices.current).toBe(2)
    expect(result.current.usage?.devices.limit).toBe(5)

    // 验证设备数
    expect(result.current.deviceCount).toBe(2)

    // 验证技能统计
    expect(result.current.skillStats.total).toBe(3)
    expect(result.current.skillStats.loaded).toBe(2)
    expect(result.current.skillStats.errors).toBe(1)
  })

  it('未登录时应设置错误状态', async () => {
    getItemSpy.mockReturnValue(null)

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('未登录')
  })

  it('API 失败时应设置错误状态', async () => {
    mockedSubscriptionService.getSubscription.mockResolvedValue({
      success: false,
      error: '网络超时',
    })

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('网络超时')
  })

  it('Gateway 不可用时技能统计应为空', async () => {
    mockGatewayCall.mockRejectedValue(new Error('Gateway 未连接'))

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 技能统计应为默认值（不影响其他数据加载）
    expect(result.current.skillStats.total).toBe(0)
    expect(result.current.skillStats.loaded).toBe(0)
    expect(result.current.skillStats.errors).toBe(0)

    // 订阅和设备数据应正常
    expect(result.current.subscription).not.toBeNull()
    expect(result.current.deviceCount).toBe(2)
  })

  it('refresh 应重新加载所有数据', async () => {
    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 清除调用记录
    vi.clearAllMocks()
    getItemSpy.mockReturnValue('mock-access-token')

    // 更新 mock 数据
    mockedSubscriptionService.getSubscription.mockResolvedValue({
      success: true,
      subscription: {
        id: 'sub-1',
        userId: 'user-1',
        planId: 'team',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        autoRenew: true,
        billingCycle: 'yearly',
      },
      plan: {
        id: 'team',
        name: 'team',
        displayName: '团队版',
        price: 99,
        currency: 'CNY',
        billingCycle: 'yearly',
        features: {
          maxDevices: 10,
          maxSkills: 50,
          maxConversations: 500,
          maxMemorySize: 4096,
          prioritySupport: true,
          customBranding: true,
        },
        isActive: true,
      },
    })
    mockedSubscriptionService.getUsage.mockResolvedValue({
      success: true,
      usage: {
        devices: { current: 3, limit: 10 },
        skills: { current: 12, limit: 50 },
        conversations: { daily: 88, monthly: 600, limit: 500 },
        storage: { used: 512, limit: 4096 },
      },
    })
    mockedDeviceService.getDevices.mockResolvedValue({
      success: true,
      devices: [
        { deviceId: 'dev-1', userId: 'user-1', isPrimary: true, linkedAt: '2026-01-15', scopes: [] },
        { deviceId: 'dev-2', userId: 'user-1', isPrimary: false, linkedAt: '2026-02-01', scopes: [] },
        { deviceId: 'dev-3', userId: 'user-1', isPrimary: false, linkedAt: '2026-02-15', scopes: [] },
      ],
    })
    mockGatewayCall.mockResolvedValue({
      skills: [
        { id: 'skill-1', name: '翻译', status: 'loaded' },
        { id: 'skill-2', name: '搜索', status: 'loaded' },
        { id: 'skill-3', name: '天气', status: 'loaded' },
        { id: 'skill-4', name: '日历', status: 'loaded' },
      ],
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.planName).toBe('团队版')
    expect(result.current.deviceCount).toBe(3)
    expect(result.current.skillStats.total).toBe(4)
    expect(result.current.skillStats.loaded).toBe(4)
    expect(result.current.skillStats.errors).toBe(0)
  })

  it('应正确设置 accessToken 到各服务', async () => {
    renderHook(() => useDashboard())

    await waitFor(() => {
      expect(mockedSubscriptionService.setAccessToken).toHaveBeenCalledWith('mock-access-token')
      expect(mockedDeviceService.setAccessToken).toHaveBeenCalledWith('mock-access-token')
    })
  })

  it('订阅到期日期应正确计算剩余天数', async () => {
    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 验证 daysRemaining 存在且为数字
    expect(typeof result.current.daysRemaining).toBe('number')
  })

  it('无订阅时应返回 free 计划', async () => {
    mockedSubscriptionService.getSubscription.mockResolvedValue({
      success: true,
      subscription: undefined,
      plan: undefined,
    })

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.subscription).toBeNull()
    expect(result.current.planName).toBe('免费版')
  })
})
