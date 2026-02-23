/**
 * useCredits Hook - 积分管理
 *
 * 提供积分余额、流水记录和批次信息的查询功能
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * 积分余额
 */
export interface CreditBalance {
  id: string
  userId: string
  /** 当前可用积分 */
  totalBalance: number
  /** 历史总获得积分 */
  totalEarned: number
  /** 历史总消费积分 */
  totalConsumed: number
  /** 历史总过期积分 */
  totalExpired: number
  createdAt: string
  updatedAt: string
}

/**
 * 积分流水记录
 */
export interface CreditTransaction {
  id: string
  userId: string
  batchId?: string
  /** 类型：earn（获得）| consume（消费）| expire（过期）| refund（退款）| admin_adjust（管理员调整） */
  type: string
  /** 变动量：正数获得，负数消费/过期 */
  amount: number
  /** 变动后余额 */
  balanceAfter: number
  /** 来源 */
  source: string
  sourceId?: string
  description?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

/**
 * 积分批次
 */
export interface CreditBatch {
  id: string
  /** 来源类型：register | invite | subscription | purchase | admin_grant */
  source: string
  /** 原始积分数 */
  originalAmount: number
  /** 剩余积分数 */
  remainingAmount: number
  /** 过期时间 */
  expiresAt: string
  description?: string
  createdAt: string
}

/**
 * 邀请统计
 */
export interface InviteStats {
  /** 已邀请人数 */
  count: number
  /** 已获得邀请积分 */
  totalCredits: number
  /** 邀请积分上限 */
  maxCredits: number
}

/**
 * useCredits 返回值
 */
interface UseCreditsReturn {
  /** 积分余额 */
  balance: CreditBalance | null
  /** 流水记录列表 */
  transactions: CreditTransaction[]
  /** 有效批次列表（含过期时间） */
  batches: CreditBatch[]
  /** 邀请统计 */
  inviteStats: InviteStats | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 刷新数据 */
  refresh: () => Promise<void>
  /** 加载更多流水 */
  loadMoreTransactions: () => Promise<void>
  /** 是否有更多流水 */
  hasMoreTransactions: boolean
  /** 刷新邀请统计 */
  fetchInviteStats: () => Promise<void>
}

/**
 * 积分管理 Hook
 */
export function useCredits(): UseCreditsReturn {
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [batches, setBatches] = useState<CreditBatch[]>([])
  const [inviteStats, setInviteStats] = useState<InviteStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [transactionOffset, setTransactionOffset] = useState(0)

  const PAGE_SIZE = 20

  /**
   * 获取积分余额
   *
   * 如果用户没有积分账户，服务端返回 data: null，此时设置默认零值。
   */
  const fetchBalance = useCallback(async () => {
    const response = await window.electronAPI.api.getCreditBalance() as {
      success: boolean
      data?: CreditBalance | null
      error?: string
    }

    if (response.success) {
      // 用户可能没有积分账户（data 为 null），设置默认零值
      setBalance(response.data ?? {
        id: '',
        userId: '',
        totalBalance: 0,
        totalEarned: 0,
        totalConsumed: 0,
        totalExpired: 0,
        createdAt: '',
        updatedAt: '',
      })
    } else {
      const errMsg = response.error || '获取积分余额失败'
      console.error('[useCredits] 获取积分余额失败:', errMsg)
      throw new Error(errMsg)
    }
  }, [])

  /**
   * 获取积分流水（首页）
   *
   * API Server 返回格式: { success, data: CreditTransaction[], meta: { count, hasMore, ... } }
   * data 直接是数组，meta 在顶层
   */
  const fetchTransactions = useCallback(async () => {
    const response = await window.electronAPI.api.getCreditHistory({
      limit: PAGE_SIZE,
      offset: 0,
    }) as {
      success: boolean
      data?: CreditTransaction[]
      meta?: { count: number; hasMore: boolean; limit: number; offset: number }
      error?: string
    }

    if (response.success) {
      setTransactions(response.data ?? [])
      setHasMoreTransactions(response.meta?.hasMore ?? false)
      setTransactionOffset(PAGE_SIZE)
    } else {
      const errMsg = response.error || '获取积分流水失败'
      console.error('[useCredits] 获取积分流水失败:', errMsg)
      throw new Error(errMsg)
    }
  }, [])

  /**
   * 获取积分批次
   */
  const fetchBatches = useCallback(async () => {
    const response = await window.electronAPI.api.getCreditBatches() as {
      success: boolean
      data?: { batches: CreditBatch[] }
      error?: string
    }

    if (response.success && response.data) {
      setBatches(response.data.batches)
    } else {
      const errMsg = response.error || '获取积分批次失败'
      console.error('[useCredits] 获取积分批次失败:', errMsg)
      throw new Error(errMsg)
    }
  }, [])

  /**
   * 获取邀请统计
   */
  const fetchInviteStats = useCallback(async () => {
    const response = await window.electronAPI.api.getInviteStats() as {
      success: boolean
      data?: InviteStats
      error?: string
    }

    if (response.success && response.data) {
      setInviteStats(response.data)
    } else {
      // 邀请统计获取失败不阻塞主流程
      console.warn('[useCredits] 获取邀请统计失败:', response.error)
    }
  }, [])

  /**
   * 刷新所有数据
   *
   * 每个请求独立 catch，避免一个失败导致其余数据也丢失。
   * batches 接口当前服务端未实现，单独处理且不影响主流程。
   */
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const errors: string[] = []

    // balance 和 transactions 独立请求，互不影响
    await Promise.allSettled([
      fetchBalance().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '获取积分余额失败'
        errors.push(msg)
      }),
      fetchTransactions().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '获取积分流水失败'
        errors.push(msg)
      }),
      fetchBatches().catch((err: unknown) => {
        // batches 接口可能未实现，静默处理
        console.warn('[useCredits] 获取积分批次失败（可能未实现）:', err instanceof Error ? err.message : err)
      }),
      fetchInviteStats().catch((err: unknown) => {
        // 邀请统计获取失败不阻塞
        console.warn('[useCredits] 获取邀请统计失败:', err instanceof Error ? err.message : err)
      }),
    ])

    if (errors.length > 0) {
      setError(errors.join('; '))
    }

    setIsLoading(false)
  }, [fetchBalance, fetchTransactions, fetchBatches, fetchInviteStats])

  /**
   * 加载更多流水
   */
  const loadMoreTransactions = useCallback(async () => {
    if (!hasMoreTransactions) {
      return
    }

    try {
      const response = await window.electronAPI.api.getCreditHistory({
        limit: PAGE_SIZE,
        offset: transactionOffset,
      }) as {
        success: boolean
        data?: CreditTransaction[]
        meta?: { count: number; hasMore: boolean; limit: number; offset: number }
        error?: string
      }

      if (response.success) {
        const newTransactions = response.data ?? []
        setTransactions(prev => [...prev, ...newTransactions])
        setHasMoreTransactions(response.meta?.hasMore ?? false)
        setTransactionOffset(prev => prev + PAGE_SIZE)
      }
    } catch (err) {
      console.error('[useCredits] 加载更多流水异常:', err)
    }
  }, [hasMoreTransactions, transactionOffset])

  /**
   * 初始化加载
   */
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    balance,
    transactions,
    batches,
    inviteStats,
    isLoading,
    error,
    refresh,
    loadMoreTransactions,
    hasMoreTransactions,
    fetchInviteStats,
  }
}
