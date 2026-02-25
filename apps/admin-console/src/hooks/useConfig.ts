/**
 * 系统配置 Hooks
 *
 * 提供系统配置相关的 React Query Hooks
 * 使用 API Server REST API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
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
      console.log('[useConfig] 获取站点配置')
      const configs = await apiClient.instance.getConfigs('site')
      // 将配置数组转换为 SiteConfig 对象
      const siteConfig: SiteConfig = {} as SiteConfig
      for (const config of configs) {
        const key = config.key.replace('site.', '') as keyof SiteConfig
        siteConfig[key] = config.value as never
      }
      return siteConfig
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
      console.log('[useConfig] 更新站点配置:', config)
      // 逐个更新配置项
      for (const [key, value] of Object.entries(config)) {
        await apiClient.instance.updateConfig(`site.${key}`, value)
      }
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
      console.log('[useConfig] 获取功能开关')
      const configs = await apiClient.instance.getConfigs('features')
      const featureFlags: FeatureFlags = {} as FeatureFlags
      for (const config of configs) {
        const key = config.key.replace('features.', '') as keyof FeatureFlags
        featureFlags[key] = config.value as never
      }
      return featureFlags
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
      console.log('[useConfig] 更新功能开关:', config)
      for (const [key, value] of Object.entries(config)) {
        await apiClient.instance.updateConfig(`features.${key}`, value)
      }
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
      console.log('[useConfig] 获取安全配置')
      const configs = await apiClient.instance.getConfigs('security')
      const securityConfig: SecurityConfig = {} as SecurityConfig
      for (const config of configs) {
        const key = config.key.replace('security.', '') as keyof SecurityConfig
        securityConfig[key] = config.value as never
      }
      return securityConfig
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
      console.log('[useConfig] 更新安全配置:', config)
      for (const [key, value] of Object.entries(config)) {
        await apiClient.instance.updateConfig(`security.${key}`, value)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'security'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'all'] })
    },
  })
}

/**
 * 获取通知模板列表
 * 注意：通知模板功能需要在 API Server 中实现对应的路由
 */
export function useNotificationTemplates(channel?: 'email' | 'sms' | 'push' | 'all') {
  return useQuery({
    queryKey: ['admin', 'config', 'notifications', channel],
    queryFn: async (): Promise<{ templates: NotificationTemplate[]; total: number }> => {
      console.log('[useConfig] 获取通知模板列表:', channel)
      // TODO: 需要在 API Server 中实现通知模板 API
      // 暂时返回空数组
      return { templates: [], total: 0 }
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
      console.log('[useConfig] 获取通知模板:', templateId)
      // TODO: 需要在 API Server 中实现通知模板 API
      throw new Error('通知模板 API 尚未实现')
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
      console.log('[useConfig] 更新通知模板:', params.templateId)
      // TODO: 需要在 API Server 中实现通知模板 API
      throw new Error('通知模板 API 尚未实现')
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
      console.log('[useConfig] 测试通知模板:', params.templateId)
      // TODO: 需要在 API Server 中实现通知模板 API
      throw new Error('通知模板 API 尚未实现')
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
      console.log('[useConfig] 获取所有配置')
      const configs = await apiClient.instance.getConfigs()
      // 将配置数组转换为 SystemConfig 对象
      const systemConfig: SystemConfig = {
        site: {} as SiteConfig,
        features: {} as FeatureFlags,
        security: {} as SecurityConfig,
      }
      for (const config of configs) {
        const [category, key] = config.key.split('.')
        if (category === 'site') {
          ;(systemConfig.site as unknown as Record<string, unknown>)[key] = config.value
        } else if (category === 'features') {
          ;(systemConfig.features as unknown as Record<string, unknown>)[key] = config.value
        } else if (category === 'security') {
          ;(systemConfig.security as unknown as Record<string, unknown>)[key] = config.value
        }
      }
      return systemConfig
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 积分包定义
 */
export interface CreditPack {
  id: string
  name: string
  credits: number
  price: number
  expiryMonths: number
}

/**
 * 获取积分包配置
 */
export function useCreditPacks() {
  return useQuery({
    queryKey: ['admin', 'config', 'credits', 'packs'],
    queryFn: async (): Promise<CreditPack[]> => {
      const config = await apiClient.instance.getConfig('credits.packs')
      const value = config?.value
      if (Array.isArray(value)) {
        return value as CreditPack[]
      }
      return []
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 更新积分包配置
 */
export function useUpdateCreditPacks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (packs: CreditPack[]) => {
      await apiClient.instance.updateConfig('credits.packs', packs)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'credits', 'packs'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', 'all'] })
    },
  })
}
