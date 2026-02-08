import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Trash2, MoreVertical, Loader2, RefreshCw, Power, PowerOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useAllSkills,
  useToggleSkill,
  useUninstallSkill,
  useReloadSkills,
  useSkillStats,
} from '@/hooks'
import { useToast } from '@/hooks/useToast'
import type { Skill } from '@/services'

/**
 * 技能卡片
 */
function SkillCard({
  skill,
  onToggle,
  onUninstall,
  isToggling,
  isUninstalling,
}: {
  skill: Skill
  onToggle: (skillId: string) => void
  onUninstall: (skillId: string) => void
  isToggling: boolean
  isUninstalling: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const isEnabled = skill.status === 'loaded'

  return (
    <Card className={skill.status === 'disabled' ? 'opacity-60' : ''}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{skill.icon || '🔧'}</div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{skill.name}</CardTitle>
              {skill.status === 'error' && (
                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                  错误
                </span>
              )}
              {skill.status === 'disabled' && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  已禁用
                </span>
              )}
            </div>
            <CardDescription className="line-clamp-1 mt-1">
              {skill.description}
            </CardDescription>
          </div>
        </div>

        {/* 菜单 */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-40 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setShowMenu(false)
                    onToggle(skill.id)
                  }}
                  disabled={isToggling}
                >
                  {isEnabled ? (
                    <>
                      <PowerOff className="w-4 h-4" />
                      禁用
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4" />
                      启用
                    </>
                  )}
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Settings className="w-4 h-4" />
                  配置
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setShowMenu(false)
                    if (confirm(`确定要卸载「${skill.name}」吗？`)) {
                      onUninstall(skill.id)
                    }
                  }}
                  disabled={isUninstalling}
                >
                  <Trash2 className="w-4 h-4" />
                  卸载
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {skill.origin === 'builtin' ? '内置' : skill.origin === 'local' ? '本地' : '远程'}
          </span>
          <span>
            {skill.executionCount > 0
              ? `执行 ${skill.executionCount} 次`
              : '未使用'}
          </span>
        </div>
        {skill.error && (
          <div className="mt-2 text-xs text-red-600 truncate" title={skill.error}>
            {skill.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 我的技能页面
 */
export default function MySkillsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)

  // 获取所有技能
  const { data: skillsData, isLoading, error, refetch } = useAllSkills()

  // 获取统计信息
  const { data: stats } = useSkillStats()

  // 切换技能状态
  const toggleMutation = useToggleSkill()

  // 卸载技能
  const uninstallMutation = useUninstallSkill()

  // 重新加载技能
  const reloadMutation = useReloadSkills()

  const skills = skillsData?.skills || []

  // 分类技能
  const enabledSkills = skills.filter((s) => s.status === 'loaded')
  const disabledSkills = skills.filter((s) => s.status === 'disabled')
  const errorSkills = skills.filter((s) => s.status === 'error')

  /**
   * 切换技能状态
   */
  const handleToggle = async (skillId: string) => {
    setTogglingId(skillId)
    try {
      const result = await toggleMutation.mutateAsync(skillId)
      toast({
        title: result.enabled ? '已启用' : '已禁用',
        description: `技能状态已更新`,
      })
    } catch {
      toast({
        title: '操作失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  /**
   * 卸载技能
   */
  const handleUninstall = async (skillId: string) => {
    setUninstallingId(skillId)
    try {
      const result = await uninstallMutation.mutateAsync(skillId)
      if (result.success) {
        toast({
          title: '卸载成功',
          description: '技能已卸载',
        })
      } else {
        toast({
          title: '卸载失败',
          description: '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '卸载失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setUninstallingId(null)
    }
  }

  /**
   * 重新加载技能
   */
  const handleReload = async () => {
    try {
      const result = await reloadMutation.mutateAsync()
      toast({
        title: '重新加载完成',
        description: `已加载 ${result.loaded}/${result.total} 个技能`,
      })
    } catch {
      toast({
        title: '重新加载失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的技能</h1>
          <p className="text-muted-foreground">
            {stats
              ? `已加载 ${stats.loaded} 个，共 ${stats.total} 个技能`
              : `已安装 ${skills.length} 个技能`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleReload}
          disabled={reloadMutation.isPending}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${reloadMutation.isPending ? 'animate-spin' : ''}`}
          />
          重新加载
        </Button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-destructive mb-4">加载失败: {error.message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 有错误的技能 */}
      {!isLoading && !error && errorSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-red-600">
            加载失败的技能 ({errorSkills.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {errorSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
                onUninstall={handleUninstall}
                isToggling={togglingId === skill.id}
                isUninstalling={uninstallingId === skill.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已启用的技能 */}
      {!isLoading && !error && enabledSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Power className="w-5 h-5 text-green-500" />
            已启用 ({enabledSkills.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enabledSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
                onUninstall={handleUninstall}
                isToggling={togglingId === skill.id}
                isUninstalling={uninstallingId === skill.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已禁用的技能 */}
      {!isLoading && !error && disabledSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-gray-400" />
            已禁用 ({disabledSkills.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {disabledSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={handleToggle}
                onUninstall={handleUninstall}
                isToggling={togglingId === skill.id}
                isUninstalling={uninstallingId === skill.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && skills.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-medium mb-2">还没有安装技能</h3>
            <p className="text-muted-foreground mb-4">
              前往技能商店发现有趣的技能
            </p>
            <Button onClick={() => navigate('/skills/store')}>
              浏览技能商店
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
