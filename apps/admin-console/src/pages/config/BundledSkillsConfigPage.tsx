/**
 * Bundled 技能管理页面
 *
 * 管理员可以在此页面查看所有 bundled 技能，并控制哪些技能对用户可见。
 * 禁用的技能不会出现在 Agent 的提示词中。
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Search,
  Package,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import type { BundledSkillInfo } from '@openclaw/api-client/admin'

const QUERY_KEY = ['admin', 'bundled-skills'] as const

/**
 * 获取 bundled 技能列表
 */
function useBundledSkills() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const result = await apiClient.instance.getBundledSkills()
      return result
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 切换技能启用/禁用
 */
function useToggleBundledSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, enable }: { name: string; enable: boolean }) => {
      if (enable) {
        await apiClient.instance.enableBundledSkill(name)
      } else {
        await apiClient.instance.disableBundledSkill(name)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * Bundled 技能管理页面
 */
export default function BundledSkillsConfigPage() {
  const { data, isLoading, refetch, isFetching } = useBundledSkills()
  const toggleMutation = useToggleBundledSkill()

  /** 搜索关键字 */
  const [searchQuery, setSearchQuery] = useState('')
  /** 过滤模式: all | enabled | disabled */
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'disabled'>('all')

  const skills: BundledSkillInfo[] = data?.data ?? []
  const meta = data?.meta

  /**
   * 过滤后的技能列表
   */
  const filteredSkills = useMemo(() => {
    let result = skills

    // 按搜索关键字过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query)
      )
    }

    // 按启用/禁用状态过滤
    if (filterMode === 'enabled') {
      result = result.filter((skill) => !skill.isDisabled)
    } else if (filterMode === 'disabled') {
      result = result.filter((skill) => skill.isDisabled)
    }

    return result
  }, [skills, searchQuery, filterMode])

  /**
   * 切换技能启用/禁用状态
   */
  const handleToggle = (skill: BundledSkillInfo) => {
    toggleMutation.mutate({
      name: skill.name,
      enable: skill.isDisabled,
    })
  }

  /**
   * 解析技能的操作系统要求
   */
  const getOsLabel = (skill: BundledSkillInfo): string | null => {
    const os = skill.metadata?.os
    if (!Array.isArray(os) || os.length === 0) {
      return null
    }
    const labels: Record<string, string> = {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux',
    }
    return os.map((o) => labels[String(o)] ?? String(o)).join(', ')
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Link to="/config">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Bundled 技能管理</h1>
          <p className="text-muted-foreground">
            管理内置技能的启用/禁用状态，禁用的技能不会对用户可见
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* 统计概览 */}
      {meta && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{meta.total}</div>
              <p className="text-sm text-muted-foreground">技能总数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {meta.total - meta.disabledCount}
              </div>
              <p className="text-sm text-muted-foreground">已启用</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{meta.disabledCount}</div>
              <p className="text-sm text-muted-foreground">已禁用</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索技能名称或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('all')}
          >
            全部
          </Button>
          <Button
            variant={filterMode === 'enabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('enabled')}
          >
            <ToggleRight className="h-4 w-4 mr-1" />
            已启用
          </Button>
          <Button
            variant={filterMode === 'disabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterMode('disabled')}
          >
            <ToggleLeft className="h-4 w-4 mr-1" />
            已禁用
          </Button>
        </div>
      </div>

      {/* 技能列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery || filterMode !== 'all'
              ? '没有匹配的技能'
              : '未找到 bundled 技能目录'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredSkills.map((skill) => {
            const osLabel = getOsLabel(skill)
            const isToggling =
              toggleMutation.isPending &&
              toggleMutation.variables?.name === skill.name

            return (
              <Card
                key={skill.name}
                className={cn(
                  'transition-colors',
                  skill.isDisabled && 'opacity-60'
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* 技能图标 */}
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        skill.isDisabled ? 'bg-muted' : 'bg-primary/10'
                      )}
                    >
                      <Package
                        className={cn(
                          'h-5 w-5',
                          skill.isDisabled ? 'text-muted-foreground' : 'text-primary'
                        )}
                      />
                    </div>

                    {/* 技能信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{skill.name}</h3>
                        {osLabel && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {osLabel}
                          </Badge>
                        )}
                        {skill.metadata?.always === true && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            always
                          </Badge>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {skill.description}
                        </p>
                      )}
                    </div>

                    {/* 启用/禁用开关 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {skill.isDisabled ? '已禁用' : '已启用'}
                      </span>
                      <Switch
                        checked={!skill.isDisabled}
                        onCheckedChange={() => handleToggle(skill)}
                        disabled={isToggling}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4" />
            操作说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>禁用的技能不会出现在 Agent 提示词中，用户将无法使用该技能</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>修改后会在新的对话会话中生效，已有会话可能需要重新加载</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>标记为 &quot;always&quot; 的技能在 Agent 运行时会跳过部分环境检测</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>带有操作系统标签的技能仅在对应平台可用，禁用后在所有平台都不可见</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
