/**
 * 用户记忆管理 Tab 组件
 *
 * 包含子 Tab: 概览 | 事实 | 偏好 | Workspace 文件 | 审计日志
 */

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useMemoryOverview } from '@/hooks/useMemory'
import FactsPanel from './FactsPanel'
import PreferencesPanel from './PreferencesPanel'
import WorkspaceFilesPanel from './WorkspaceFilesPanel'
import AuditLogPanel from './AuditLogPanel'

interface MemoryTabProps {
  userId: string
}

/**
 * 用户记忆管理主 Tab 组件
 */
export default function MemoryTab({ userId }: MemoryTabProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { data: overview, isLoading: overviewLoading } = useMemoryOverview(userId)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="facts">
          事实
          {overview?.factsCount != null && overview.factsCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
              {overview.factsCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="preferences">偏好</TabsTrigger>
        <TabsTrigger value="workspace">
          Workspace 文件
          {overview?.workspaceFilesCount != null && overview.workspaceFilesCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
              {overview.workspaceFilesCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="audit">审计日志</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4 mt-4">
        <OverviewPanel overview={overview} isLoading={overviewLoading} />
      </TabsContent>

      <TabsContent value="facts" className="mt-4">
        <FactsPanel userId={userId} />
      </TabsContent>

      <TabsContent value="preferences" className="mt-4">
        <PreferencesPanel userId={userId} />
      </TabsContent>

      <TabsContent value="workspace" className="mt-4">
        <WorkspaceFilesPanel userId={userId} />
      </TabsContent>

      <TabsContent value="audit" className="mt-4">
        <AuditLogPanel userId={userId} />
      </TabsContent>
    </Tabs>
  )
}

/**
 * 概览面板 — 显示记忆统计摘要
 */
function OverviewPanel({
  overview,
  isLoading,
}: {
  overview?: {
    userId: string
    hasProfile: boolean
    factsCount: number
    hasPreferences: boolean
    workspaceFilesCount: number
    auditLogsCount: number
  }
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!overview) {
    return <div className="text-center py-8 text-muted-foreground">暂无记忆数据</div>
  }

  const stats = [
    {
      label: '用户档案',
      value: overview.hasProfile ? '已创建' : '未创建',
      variant: overview.hasProfile ? 'success' : 'secondary',
    },
    { label: '事实条目', value: overview.factsCount.toString() },
    {
      label: '偏好设置',
      value: overview.hasPreferences ? '已配置' : '未配置',
      variant: overview.hasPreferences ? 'success' : 'secondary',
    },
    { label: 'Workspace 文件', value: overview.workspaceFilesCount.toString() },
    { label: '审计日志', value: overview.auditLogsCount.toString() },
  ] as const

  return (
    <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center p-4 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold">
            {'variant' in stat ? (
              <Badge variant={stat.variant as 'success' | 'secondary'}>{stat.value}</Badge>
            ) : (
              stat.value
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
