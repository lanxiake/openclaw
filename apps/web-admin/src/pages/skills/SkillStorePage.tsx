import { useState } from 'react'
import { Search, Star, Download, Filter, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useStoreSkills,
  useFeaturedSkills,
  useInstallFromStore,
  useRefreshStore,
} from '@/hooks'
import { useToast } from '@/hooks/useToast'
import type { StoreSkill } from '@/services'

/**
 * 技能分类
 */
const categories = [
  { value: '', label: '全部' },
  { value: 'automation', label: '自动化' },
  { value: 'productivity', label: '效率工具' },
  { value: 'communication', label: '通讯' },
  { value: 'entertainment', label: '娱乐' },
  { value: 'utility', label: '实用工具' },
]

/**
 * 订阅类型筛选
 */
const subscriptionFilters = [
  { value: '', label: '全部' },
  { value: 'free', label: '免费' },
  { value: 'pro', label: '专业版' },
  { value: 'team', label: '团队版' },
]

/**
 * 技能卡片
 */
function SkillCard({
  skill,
  onInstall,
  isInstalling,
}: {
  skill: StoreSkill
  onInstall: (skillId: string) => void
  isInstalling: boolean
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="text-4xl">{skill.icon || '🔧'}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{skill.name}</CardTitle>
            {skill.featured && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                推荐
              </span>
            )}
          </div>
          <CardDescription className="line-clamp-2 mt-1">
            {skill.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              {skill.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {skill.downloads.toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            {skill.subscription === 'free' ? (
              <span className="text-green-600 font-medium">免费</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {skill.subscription === 'pro' ? '专业版' : '团队版'}
              </span>
            )}
          </div>
        </div>

        {skill.installed ? (
          <Button className="w-full mt-4" variant="secondary" disabled>
            {skill.hasUpdate ? '有更新' : '已安装'}
          </Button>
        ) : (
          <Button
            className="w-full mt-4"
            variant={skill.subscription === 'free' ? 'secondary' : 'default'}
            onClick={() => onInstall(skill.id)}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                安装中...
              </>
            ) : skill.subscription === 'free' ? (
              '安装'
            ) : (
              '订阅后安装'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 技能商店页面
 */
export default function SkillStorePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [subscription, setSubscription] = useState<'' | 'free' | 'pro' | 'team'>('')
  const [installingId, setInstallingId] = useState<string | null>(null)

  const { toast } = useToast()

  // 查询商店技能
  const {
    data: storeData,
    isLoading,
    error,
    refetch,
  } = useStoreSkills({
    category: category || undefined,
    subscription: subscription || undefined,
    search: search || undefined,
    limit: 50,
  })

  // 获取推荐技能
  const { data: featuredSkills } = useFeaturedSkills()

  // 安装技能
  const installMutation = useInstallFromStore()

  // 刷新商店
  const refreshMutation = useRefreshStore()

  /**
   * 安装技能
   */
  const handleInstall = async (skillId: string) => {
    setInstallingId(skillId)
    try {
      const result = await installMutation.mutateAsync(skillId)
      if (result.success) {
        toast({
          title: '安装成功',
          description: result.message || '技能已成功安装',
        })
      } else {
        toast({
          title: '安装失败',
          description: result.message || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '安装失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setInstallingId(null)
    }
  }

  /**
   * 刷新商店
   */
  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync()
      toast({
        title: '刷新成功',
        description: '商店数据已更新',
      })
    } catch {
      toast({
        title: '刷新失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    }
  }

  // 过滤后的技能列表
  const skills = storeData?.skills || []

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">技能商店</h1>
          <p className="text-muted-foreground">发现新技能，增强您的 AI 助理</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
          />
          刷新
        </Button>
      </div>

      {/* 推荐技能 */}
      {featuredSkills && featuredSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">推荐技能</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featuredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onInstall={handleInstall}
                isInstalling={installingId === skill.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索技能..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* 分类筛选 */}
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={category === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategory(cat.value)}
                className="whitespace-nowrap"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* 订阅类型筛选 */}
          <div className="flex gap-2 ml-auto">
            {subscriptionFilters.map((sub) => (
              <Button
                key={sub.value}
                variant={subscription === sub.value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSubscription(sub.value as typeof subscription)}
                className="whitespace-nowrap"
              >
                {sub.label}
              </Button>
            ))}
          </div>
        </div>
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

      {/* 技能列表 */}
      {!isLoading && !error && skills.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onInstall={handleInstall}
              isInstalling={installingId === skill.id}
            />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && skills.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Filter className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">没有找到技能</h3>
            <p className="text-muted-foreground">
              尝试更换搜索词或分类
            </p>
          </CardContent>
        </Card>
      )}

      {/* 加载更多 */}
      {storeData?.hasMore && (
        <div className="text-center">
          <Button variant="outline">加载更多</Button>
        </div>
      )}
    </div>
  )
}
