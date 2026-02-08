/**
 * Hooks 统一导出
 */

// Gateway 连接
export { useGatewayConnection } from './useGateway'

// Toast
export { useToast, toast } from './useToast'

// 技能
export {
  useLoadedSkills,
  useAllSkills,
  useSkillDetail,
  useSkillStats,
  useExecuteSkill,
  useToggleSkill,
  useUninstallSkill,
  useReloadSkills,
  useStoreSkills,
  useStoreSkillDetail,
  useFeaturedSkills,
  usePopularSkills,
  useRecentSkills,
  useStoreStats,
  useSkillUpdates,
  useInstallFromStore,
  useSearchSkills,
  useRefreshStore,
  skillKeys,
} from './useSkills'

// 订阅
export {
  usePlans,
  usePlan,
  useCurrentSubscription,
  useSubscriptionOverview,
  useUsageRecords,
  useQuotaCheck,
  useCreateSubscription,
  useUpdateSubscription,
  useCancelSubscription,
  subscriptionKeys,
} from './useSubscription'

// 审计
export {
  useAuditLogs,
  useRecentAuditLogs,
  useAuditStats,
  useAuditConfig,
  useSetAuditConfig,
  useExportAuditLogs,
  useClearAuditLogs,
  auditKeys,
} from './useAudit'
