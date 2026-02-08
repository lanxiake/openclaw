/**
 * 系统配置 Hooks
 *
 * 提供系统配置相关的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gateway } from '@/lib/gateway-client'
import type {
  SiteConfig,
  FeatureFlags,
  SecurityConfig,
  NotificationTemplate,
  SystemConfig,
} from '@/types/config'

/**
 * 获取站点配置
 */
export function useSiteConfig() {
  return useQuery({
    queryKey: ['admin', 'config', 'site'],
    queryFn: async (): Promise<SiteConfig> => {
      const response = await gateway.call<{
        success: boolean
        config?: SiteConfig
        error?: string
      }>('admin.config.site.get', {})

      if (!response.success || !response.config) {
        throw new Error(response.error || '获取站点配置失败')
      }

      return response.config
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  })
}

/**
 * 更新站点配置
 */
export function useUpdateSiteConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<SiteConfig>) => {
      const response = await gateway.call<{
        success: boolean
        config?: SiteConfig
        message?: string
        error?: string
      }>('admin.config.site.set', { config })

      if (!response.success) {
        throw new Error(response.error || '更新站点配置失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'site'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'all'] })
    },
  })
}

/**
 * 获取功能开关
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'config', 'features'],
    queryFn: async (): Promise<FeatureFlags> => {
      const response = await gateway.call<{
        success: boolean
        config?: FeatureFlags
        error?: string
      }>('admin.config.features.get', {})

      if (!response.success || !response.config) {
        throw new Error(response.error || '获取功能开关失败')
      }

      return response.config
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 更新功能开关
 */
export function useUpdateFeatureFlags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<FeatureFlags>) => {
      const response = await gateway.call<{
        success: boolean
        config?: FeatureFlags
        message?: string
        error?: string
      }>('admin.config.features.set', { config })

      if (!response.success) {
        throw new Error(response.error || '更新功能开关失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'features'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'all'] })
    },
  })
}

/**
 * 获取安全配置
 */
export function useSecurityConfig() {
  return useQuery({
    queryKey: ['admin', 'config', 'security'],
    queryFn: async (): Promise<SecurityConfig> => {
      const response = await gateway.call<{
        success: boolean
        config?: SecurityConfig
        error?: string
      }>('admin.config.security.get', {})

      if (!response.success || !response.config) {
        throw new Error(response.error || '获取安全配置失败')
      }

      return response.config
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 更新安全配置
 */
export function useUpdateSecurityConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<SecurityConfig>) => {
      const response = await gateway.call<{
        success: boolean
        config?: SecurityConfig
        message?: string
        error?: string
      }>('admin.config.security.set', { config })

      if (!response.success) {
        throw new Error(response.error || '更新安全配置失败')
      }

      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'security'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'all'] })
    },
  })
}

/**
 * 获取通知模板列表
 */
export function useNotificationTemplates(channel?: 'email' | 'sms' | 'push' | 'all') {
  return useQuery({
    queryKey: ['admin', 'config', 'notifications', channel],
    queryFn: async (): Promise<{ templates: NotificationTemplate[]; total: number }> => {
      const response = await gateway.call<{
        success: boolean
        templates?: NotificationTemplate[]
        total?: number
        error?: string
      }>('admin.config.notifications.list', { channel: channel || 'all' })

      if (!response.success) {
        throw new Error(response.error || '获取通知模板列表失败')
      }

      return {
        templates: response.templates ?? [],
        total: response.total ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取单个通知模板
 */
export function useNotificationTemplate(templateId: string) {
  return useQuery({
    queryKey: ['admin', 'config', 'notifications', 'detail', templateId],
    queryFn: async (): Promise<NotificationTemplate> => {
      const response = await gateway.call<{
        success: boolean
        template?: NotificationTemplate
        error?: string
      }>('admin.config.notifications.get', { templateId })

      if (!response.success || !response.template) {
        throw new Error(response.error || '获取通知模板失败')
      }

      return response.template
    },
    enabled: !!templateId,
  })
}

/**
 * 更新通知模板
 */
export function useUpdateNotificationTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      templateId: string
      subject?: string
      content: string
      enabled?: boolean
    }) => {
      const response = await gateway.call<{
        success: boolean
        template?: NotificationTemplate
        message?: string
        error?: string
      }>('admin.config.notifications.update', params)

      if (!response.success) {
        throw new Error(response.error || '更新通知模板失败')
      }

      return response
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'notifications'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'config', 'notifications', 'detail', variables.templateId],
      })
    },
  })
}

/**
 * 测试通知模板
 */
export function useTestNotificationTemplate() {
  return useMutation({
    mutationFn: async (params: {
      templateId: string
      testData: Record<string, string>
    }) => {
      const response = await gateway.call<{
        success: boolean
        preview?: {
          subject?: string
          content: string
          channel: string
        }
        message?: string
        error?: string
      }>('admin.config.notifications.test', params)

      if (!response.success) {
        throw new Error(response.error || '测试通知模板失败')
      }

      return response
    },
  })
}

/**
 * 获取所有配置
 */
export function useAllConfig() {
  return useQuery({
    queryKey: ['admin', 'config', 'all'],
    queryFn: async (): Promise<SystemConfig> => {
      const response = await gateway.call<{
        success: boolean
        config?: SystemConfig
        error?: string
      }>('admin.config.all', {})

      if (!response.success || !response.config) {
        throw new Error(response.error || '获取所有配置失败')
      }

      return response.config
    },
    staleTime: 5 * 60 * 1000,
  })
}
